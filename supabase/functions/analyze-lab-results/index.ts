/**
 * analyze-lab-results/index.ts
 *
 * Thin entrypoint: request parsing → context assembly → prompt resolution →
 * LLM call → response parsing → V2 mapping → logging → response.
 *
 * All heavy logic lives in extracted modules.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Extracted modules ──
import type { AnalysisRequest, AnalysisResponse } from "./types.ts";
import { scoreActives, matchProtocolsByActives } from "./therapeutics.ts";
import { SYSTEM_PROMPT } from "./systemPrompt.ts";
import { fetchClinicalContext } from "./contextAssembly.ts";
import { buildUserPrompt } from "./promptBuilder.ts";
import { extractPartialAnalysis } from "./responseParsing.ts";
import { mapV1toV2 } from "./buildV2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ══════════════════════════════════════════════════════════════════════════════
// HANDLER
// ══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const startMs = Date.now();
    const body: AnalysisRequest = await req.json();

    if (!body.patient_name || !body.results || body.results.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: patient_name, results" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase config missing");
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── 1. Resolve system prompt by specialty ──
    const specialtyId = body.specialty_id ?? "medicina_funcional";
    let activeSystemPrompt = SYSTEM_PROMPT;
    let specialtyHasProtocols = true;
    try {
      const { data: promptData, error: promptError } = await serviceClient
        .from("analysis_prompts")
        .select("system_prompt, has_protocols")
        .eq("specialty_id", specialtyId)
        .eq("is_active", true)
        .single();
      if (!promptError && promptData?.system_prompt) {
        activeSystemPrompt = promptData.system_prompt;
        specialtyHasProtocols = promptData.has_protocols ?? false;
        console.log("Loaded prompt for specialty: " + specialtyId);
      } else {
        console.warn("Prompt not found for specialty '" + specialtyId + "', using default. Error: " + (promptError?.message ?? "none"));
      }
    } catch (promptLoadError) {
      console.warn("Failed to load prompt from DB, using default:", promptLoadError);
    }

    // ── 2. Fetch clinical context ──
    const encounterCtx = body.encounter_context ?? null;
    const { context: clinicalContext, loaded: contextLoaded } = await fetchClinicalContext(
      serviceClient,
      body.patient_id,
      specialtyId,
      body.patient_profile,
      body.results,
      encounterCtx,
    );

    // ── 3. Score therapeutics + match protocols ──
    const abnormalResults = body.results.filter(
      (r) => r.status === "low" || r.status === "high" || r.status === "critical_low" || r.status === "critical_high"
    );
    const objectives = body.patient_profile?.objectives ?? [];
    const scoredActives = scoreActives(abnormalResults, body.sex, objectives);

    const topActiveIds = specialtyHasProtocols ? scoredActives.slice(0, 8).map((sa) => sa.active.id) : [];
    const matchedProtocols = specialtyHasProtocols ? matchProtocolsByActives(topActiveIds, body.sex) : [];

    // ── 4. Build user prompt ──
    const effectiveMode = !specialtyHasProtocols ? "analysis_only" : (body.mode ?? "full");
    const bodyWithMode = { ...body, mode: effectiveMode } as AnalysisRequest;

    const userPrompt = buildUserPrompt(bodyWithMode, scoredActives, matchedProtocols, clinicalContext, specialtyId, encounterCtx);
    console.log(
      "Analyzing " + body.results.length + " markers for " + body.patient_name + " | specialty: " + specialtyId + " | " +
      "labs: " + contextLoaded.labs.total + " total, " + contextLoaded.labs.outOfRange + " OOR, " +
      contextLoaded.labs.clinicallyRelevantNormals + " relevant normals, " + contextLoaded.labs.trendsCount + " trends | " +
      abnormalResults.length + " abnormal | " + scoredActives.length + " actives scored | " +
      matchedProtocols.length + " protocols matched | has_protocols: " + specialtyHasProtocols +
      " | context: anamnesis=" + contextLoaded.anamnesis + " notes=" + contextLoaded.doctorNotes + " profile=" + contextLoaded.patientProfile + " bodyComp=" + contextLoaded.bodyComposition
    );

    // ── 5. Call LLM ──
    const MAX_TOKENS_BY_MODE: Record<string, number> = {
      analysis_only: 6000,
      protocols_only: 8000,
      full: 12000,
    };
    const maxTokens = MAX_TOKENS_BY_MODE[effectiveMode] ?? 12000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);

    let response: Response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          temperature: 0.25,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: activeSystemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
        console.error("AI gateway timeout after 90s");
        return new Response(JSON.stringify({ error: "A análise excedeu o tempo limite (90s). Tente novamente ou use o modo 'Análise Rápida'." }), {
          status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${response.status}: ${errText}`);
    }

    // ── 6. Parse response ──
    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    const finishReason = aiResponse.choices?.[0]?.finish_reason;
    const usage = aiResponse.usage;

    console.log(
      `AI response | finish_reason: ${finishReason} | ` +
      `completion_tokens: ${usage?.completion_tokens ?? "?"} | ` +
      `content_length: ${content?.length ?? 0}`
    );

    if (!content) throw new Error("Empty response from AI");

    if (finishReason === "length") {
      console.warn("⚠ Response was TRUNCATED (finish_reason=length). Attempting partial extraction.");
    }

    let analysis: AnalysisResponse;
    try {
      analysis = JSON.parse(content);
    } catch (parseError) {
      console.warn("JSON.parse failed, attempting robust extraction:", (parseError as Error).message);
      analysis = extractPartialAnalysis(content);
    }

    const isTruncated = finishReason === "length";
    const durationMs = Date.now() - startMs;

    // ── 7. Build V2 payload ──
    let analysisV2 = null;
    try {
      let specialtyName = specialtyId.replace(/_/g, " ");
      try {
        const { data: spData } = await serviceClient
          .from("analysis_prompts")
          .select("specialty_name")
          .eq("specialty_id", specialtyId)
          .single();
        if (spData?.specialty_name) specialtyName = spData.specialty_name;
      } catch { /* use fallback name */ }

      analysisV2 = mapV1toV2(
        analysis,
        clinicalContext,
        specialtyId,
        specialtyName,
        effectiveMode as "full" | "analysis_only" | "protocols_only",
        "google/gemini-2.5-flash",
      );
      console.log(
        `V2 built: ${analysisV2.red_flags.length} red_flags, ` +
        `${analysisV2.clinical_findings.length} findings, ` +
        `${analysisV2.diagnostic_hypotheses.length} hypotheses, ` +
        `${analysisV2.suggested_actions.length} actions`
      );
    } catch (v2Err) {
      console.warn("V2 build failed (non-blocking):", v2Err);
    }

    // ── 8. Fire-and-forget: log AI call ──
    try {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const logClient = createClient(supabaseUrl!, supabaseServiceKey!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: userData } = await logClient.auth.getUser();
        const practitionerId = userData?.user?.id;
        if (practitionerId) {
          logClient.from("ai_call_logs").insert({
            practitioner_id: practitionerId,
            patient_id: body.patient_id ?? null,
            specialty_id: specialtyId,
            mode: effectiveMode,
            input_tokens: usage?.prompt_tokens ?? null,
            output_tokens: usage?.completion_tokens ?? null,
            finish_reason: finishReason,
            success: true,
            duration_ms: durationMs,
          }).then((_res: unknown) => {}, (e: unknown) => console.warn("ai_call_logs insert failed:", e));
        }
      }
    } catch (logErr) {
      console.warn("ai_call_logs error (non-blocking):", logErr);
    }

    // ── 9. Return response ──
    return new Response(
      JSON.stringify({
        analysis,
        analysis_v2: analysisV2,
        specialty_id: specialtyId,
        _truncated: isTruncated,
        _context_loaded: { ...contextLoaded, anamneseSource: clinicalContext.anamneseSource ?? "none" },
        _diagnostics: {
          finish_reason: finishReason,
          completion_tokens: usage?.completion_tokens,
          content_length: content.length,
          max_tokens: maxTokens,
          mode: effectiveMode,
          duration_ms: durationMs,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-lab-results error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
