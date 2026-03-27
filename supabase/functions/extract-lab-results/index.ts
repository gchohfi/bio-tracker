/**
 * index.ts — Orquestrador do pipeline de extração de exames laboratoriais.
 *
 * Fluxo canônico:
 *   1. EXTRACT     — Chamada IA (Gemini) + regexFallback
 *   2. NORMALIZE   — Operadores textuais, deduplicação
 *   3. INFER UNIT  — Detecção de unidade fonte/alvo
 *   4. CONVERT     — Aplicação de fator de conversão
 *   5. SCALE       — Ajustes de escala (OCR/parsing: decimal perdido, milhar)
 *   6. VALIDATE    — Sanity bounds, anti-alucinação
 *   7. DERIVE      — Cálculos derivados (HOMA-IR, ratios, etc.)
 *   7. ENRICH      — Referências (parseLabRefRanges, DHEA, VLDL, sanitize, overrides)
 *   8. STRUCTURAL  — Validação estrutural final + quality score
 *
 * Nenhuma lógica de negócio vive aqui — apenas orquestração.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { QUALITATIVE_IDS, VALID_MARKER_IDS } from "./constants.ts";
import { normalizeOperatorText, deduplicateResults, parseLabRefRanges } from "./normalize.ts";
import { inferSourceUnit } from "./unitInference.ts";
import { applyUnitConversions } from "./convert.ts";
import { applyScaleAdjustments } from "./scale.ts";
import { calculateDerivedValues, applyReferenceOverrides, enrichDheaReference, guardVldlReference } from "./derive.ts";
import { validateAndFixValues, sanitizeLabReferences, crossCheckAllMarkers, validateExtraction } from "./validate.ts";
import { systemPrompt, buildUserMessage, extractResultsTool } from "./prompt.ts";
import { regexFallback } from "./regexFallback.ts";
import { detectDocumentProfiles, extractHistoricalData, filterOutCurrentDate } from "./historicalExtract.ts";
import { normalizeHistoricalResults } from "./historicalNormalize.ts";

// ─── CORS ────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Helpers internos ────────────────────────────────────────────────────────

/** Filtra resultados da IA: marker_id válido + valor ou text_value conforme tipo. */
function filterValidResults(raw: any[]): any[] {
  return (raw || []).filter((r: any) => {
    if (!VALID_MARKER_IDS.has(r.marker_id)) return false;
    if (QUALITATIVE_IDS.has(r.marker_id)) {
      return typeof r.text_value === "string" && r.text_value.length > 0;
    }
    return typeof r.value === "number" && !isNaN(r.value);
  });
}

/** Extrai data de coleta do PDF via regex (alta e baixa confiança). */
function extractExamDate(pdfText: string, aiDate: string | null): string | null {
  let examDate = aiDate;

  // Step 1: Alta confiança — "Data de Coleta"
  const highConfPatterns = [
    /(?:Data\s+d[aeo]\s+[Cc]olet[ao]|Colet(?:a|ado)\s*(?:em)?)[:\s]*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i,
  ];
  for (const pat of highConfPatterns) {
    const m = pdfText.match(pat);
    if (m) {
      const [, dd, mm, yyyy] = m;
      const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
      const monthNum = parseInt(mm, 10);
      const dayNum = parseInt(dd, 10);
      if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
        const candidate = `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
        console.log(`[DATE] High-confidence "Data de Coleta": ${candidate} (overrides AI: ${examDate})`);
        return candidate;
      }
      if (dayNum >= 1 && dayNum <= 12 && monthNum >= 1 && monthNum <= 31) {
        const candidate = `${year}-${dd.padStart(2, "0")}-${mm.padStart(2, "0")}`;
        console.log(`[DATE] High-confidence SWAPPED d/m: ${candidate} (overrides AI: ${examDate})`);
        return candidate;
      }
    }
  }

  // Step 2: Baixa confiança — fallback
  if (!examDate) {
    const fallbackPatterns = [
      /(?:Data\s+d[oe]\s+[Ee]xame|Realizado\s+em)[:\s]*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i,
      /(?:Data\s+d[aeo]\s+[Ee]miss[aã]o|Emitido\s+em|Data\s+da\s+[Ff]icha|RECEBIDO.*?COLETADO)[:\s]*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i,
      /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})(?=\s+\d{1,2}:\d{2})/,
    ];
    for (const pattern of fallbackPatterns) {
      const match = pdfText.match(pattern);
      if (match) {
        const [, dd, mm, yyyy] = match;
        const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
        const monthNum = parseInt(mm, 10);
        const dayNum = parseInt(dd, 10);
        if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) continue;
        const candidate = `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
        if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
          examDate = candidate;
          console.log(`[DATE-REGEX] Fallback date from pattern: ${candidate}`);
          break;
        }
      }
    }
  }

  return examDate;
}

/** Executa o pipeline de processamento em um array de resultados. */
function processPipeline(results: any[], patientSex?: string, patientAge?: number): any[] {
  // STEP 1: Normalize
  let r = normalizeOperatorText(results);
  r = deduplicateResults(r);

  // STEP 2: Infer unit + Convert
  r = inferSourceUnit(r);
  r = applyUnitConversions(r);

  // STEP 3: Scale adjustments (OCR/parsing fixes — corrige magnitude, não unidade)
  r = applyScaleAdjustments(r);

  // STEP 4: Validate (sanity bounds, anti-hallucination)
  r = validateAndFixValues(r, patientSex, patientAge);

  // STEP 4: Derive (HOMA-IR, ratios, bilirrubina indireta, etc.)
  r = calculateDerivedValues(r);

  return r;
}

/**
 * Post-extraction validation: detecta marcadores críticos presentes no PDF
 * mas omitidos pela LLM e pelo regex fallback.
 * Usa regex de alta confiança com unidade obrigatória para evitar falsos positivos.
 */
function detectCriticalOmissions(pdfText: string, currentResults: any[]): any[] {
  const found = new Set(currentResults.map((r: any) => r.marker_id));
  const rescued: any[] = [];

  const criticalPatterns: Array<{
    id: string;
    patterns: RegExp[];
    sanity?: { min: number; max: number };
  }> = [
    {
      id: 'anti_tpo',
      patterns: [
        /(?:Anti[- ]?TPO|ANTI[- ]?PEROXIDASE|Peroxidase\s+Tireoidiana|ANTICORPOS?\s+ANTI[- ]?PEROXIDASE)[\s\S]{0,300}?([\d]+[,.][\d]+|\d+)\s*(?:UI\/mL|U\/mL)/i,
      ],
      sanity: { min: 0, max: 2000 },
    },
    {
      id: 'anti_tg',
      patterns: [
        /(?:Anti[- ]?Tireoglobulina|ANTICORPOS?\s+ANTI[- ]?TIREOGLOBULINA|ANTITIROGLOBULINA|Anti[- ]?TG)[\s\S]{0,300}?([\d]+[,.][\d]+|\d+)\s*(?:UI\/mL|U\/mL)/i,
      ],
      sanity: { min: 0, max: 5000 },
    },
    {
      id: 'lipoproteina_a',
      patterns: [
        /(?:Lipoprote[íi]na\s*\(?[Aa]\)?|LP\s*\(?[Aa]\)?|Lp\s*\(?[Aa]\)?)[\s\S]{0,300}?([\d]+[,.][\d]+|\d+)\s*(?:nmol\/L|mg\/dL|mg\/L)/i,
      ],
      sanity: { min: 0, max: 1000 },
    },
  ];

  for (const { id, patterns, sanity } of criticalPatterns) {
    if (found.has(id)) continue;
    for (const pat of patterns) {
      const m = pdfText.match(pat);
      if (m && m[1]) {
        const num = parseFloat(m[1].replace(',', '.'));
        if (!isNaN(num) && (!sanity || (num >= sanity.min && num <= sanity.max))) {
          rescued.push({ marker_id: id, value: num });
          found.add(id);
          console.log("[POST-EXTRACT] Rescued " + id + ": " + num);
          break;
        }
      }
    }
  }

  return rescued;
}

// ─── Endpoint principal ──────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfText, patientSex, patientAge } = await req.json();
    if (!pdfText || typeof pdfText !== "string") {
      return new Response(JSON.stringify({ error: "pdfText is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const textToSend = pdfText.slice(0, 200000);
    console.log(`PDF text received: ${pdfText.length} chars, sending: ${textToSend.length} chars to AI`);

    // ── 1. EXTRACT: Chamada IA ──────────────────────────────────────────────
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0,
        max_tokens: 16384,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserMessage(textToSend, patientAge, patientSex) },
        ],
        tools: [extractResultsTool],
        tool_choice: { type: "function", function: { name: "extract_results" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    // ── 2-5. PIPELINE: Filter → Normalize → Infer → Convert → Validate → Derive
    let validResults = filterValidResults(parsed.results);
    validResults = processPipeline(validResults, patientSex, patientAge);

    // ── 6. REGEX FALLBACK: marcadores perdidos pela IA ──────────────────────
    const beforeFallbackIds = new Set<string>(validResults.map((r: any) => r.marker_id));
    validResults = regexFallback(pdfText, validResults);

    // ── 6b. POST-EXTRACTION VALIDATION: detecta omissões críticas ────────
    const criticalMissing = detectCriticalOmissions(pdfText, validResults);
    if (criticalMissing.length > 0) {
      console.log(`[POST-EXTRACT] Critical omissions detected: ${criticalMissing.map(r => r.marker_id).join(', ')}`);
      validResults = [...validResults, ...criticalMissing];
    }

    // Processar marcadores adicionados pelo fallback pelo mesmo pipeline
    const fallbackAdded = validResults.filter((r: any) => !beforeFallbackIds.has(r.marker_id));
    if (fallbackAdded.length > 0) {
      console.log(`Regex fallback added ${fallbackAdded.length} markers: ${fallbackAdded.map((r: any) => r.marker_id).join(', ')}`);
      const fallbackValidated = processPipeline(fallbackAdded, patientSex, patientAge);
      const fallbackValidatedIds = new Set(fallbackValidated.map((r: any) => r.marker_id));
      validResults = validResults.filter((r: any) => beforeFallbackIds.has(r.marker_id) || fallbackValidatedIds.has(r.marker_id));
      validResults = validResults.map((r: any) => {
        if (!beforeFallbackIds.has(r.marker_id)) {
          return fallbackValidated.find((fv: any) => fv.marker_id === r.marker_id) || r;
        }
        return r;
      });
      // Re-derive com set completo
      validResults = calculateDerivedValues(validResults);
    }

    // ── 7. ENRICH: Referências ──────────────────────────────────────────────
    validResults = parseLabRefRanges(validResults);
    validResults = enrichDheaReference(validResults, patientAge, patientSex);
    validResults = guardVldlReference(validResults);
    validResults = sanitizeLabReferences(validResults);
    validResults = crossCheckAllMarkers(validResults, pdfText, beforeFallbackIds);
    validResults = applyReferenceOverrides(validResults);

    // ── 8. STRUCTURAL VALIDATION ────────────────────────────────────────────
    const validation = validateExtraction(validResults);
    validResults = validation.results;

    // ── 9. DATE EXTRACTION ──────────────────────────────────────────────────
    const aiDate = (typeof parsed.exam_date === "string" && parsed.exam_date.match(/^\d{4}-\d{2}-\d{2}$/))
      ? parsed.exam_date : null;
    const examDate = extractExamDate(pdfText, aiDate);

    // ── 10. HISTORICAL EXTRACTION + NORMALIZATION ─────────────────────────
    let historicalResults: any[] = [];
    try {
      const blocks = detectDocumentProfiles(pdfText);
      if (blocks.length > 0) {
        console.log(`[HIST] Detected ${blocks.length} historical blocks: ${blocks.map(b => b.type).join(", ")}`);
        historicalResults = extractHistoricalData(pdfText, blocks);
        historicalResults = filterOutCurrentDate(historicalResults, examDate);
        // Normalize: operator text → infer unit → convert → scale → round
        historicalResults = normalizeHistoricalResults(historicalResults);
        console.log(`[HIST] Extracted ${historicalResults.length} marker timelines with ${historicalResults.reduce((sum: number, t: any) => sum + t.entries.length, 0)} total entries (normalized)`);
      }
    } catch (histError) {
      console.error("[HIST] Historical extraction error (non-fatal):", histError);
      // Historical extraction failure is non-fatal — currentResults still returned
    }

    // ── RESPONSE ────────────────────────────────────────────────────────────
    console.log(`Extracted ${validResults.length} valid markers:`, validResults.map((r: any) => r.marker_id).join(', '));
    console.log(`Quality score: ${validation.quality_score}, issues: ${validation.issues.length}`);
    if (examDate) console.log(`Exam date extracted: ${examDate}`);

    return new Response(JSON.stringify({
      results: validResults,
      historicalResults,
      exam_date: examDate,
      quality_score: validation.quality_score,
      issues: validation.issues,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-lab-results error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
