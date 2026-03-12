import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const { patient_id, messages } = await req.json();
    if (!patient_id || !messages?.length) throw new Error("Missing patient_id or messages");

    // 1. Verify ownership + get patient profile
    const { data: patient, error: patErr } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patient_id)
      .eq("practitioner_id", user.id)
      .single();
    if (patErr || !patient) throw new Error("Patient not found or access denied");

    // 2. Assemble clinical context in parallel
    const [labRes, encountersRes, analysesRes, prescriptionsRes, anamneseRes] = await Promise.all([
      // Last 3 lab sessions with results
      supabase
        .from("lab_sessions")
        .select("id, session_date")
        .eq("patient_id", patient_id)
        .order("session_date", { ascending: false })
        .limit(3),
      // Last 3 encounters with SOAP notes
      supabase
        .from("clinical_encounters")
        .select("id, encounter_date, chief_complaint, status, clinical_evolution_notes(subjective, objective, assessment, plan, medications, exams_requested)")
        .eq("patient_id", patient_id)
        .order("encounter_date", { ascending: false })
        .limit(3),
      // Last 2 analyses
      supabase
        .from("patient_analyses")
        .select("id, created_at, summary, technical_analysis, patient_plan, specialty_name")
        .eq("patient_id", patient_id)
        .order("created_at", { ascending: false })
        .limit(2),
      // Last prescription
      supabase
        .from("clinical_prescriptions")
        .select("id, created_at, prescription_json, status, specialty_id")
        .eq("patient_id", patient_id)
        .order("created_at", { ascending: false })
        .limit(1),
      // Anamnese
      supabase
        .from("patient_anamneses")
        .select("anamnese_text, structured_data, specialty_id")
        .eq("patient_id", patient_id)
        .limit(1),
    ]);

    // Fetch lab results for the sessions
    let labContext = "";
    if (labRes.data?.length) {
      const sessionIds = labRes.data.map((s: any) => s.id);
      const { data: results } = await supabase
        .from("lab_results")
        .select("marker_id, value, text_value, session_id")
        .in("session_id", sessionIds);

      const sessionDateMap = new Map(labRes.data.map((s: any) => [s.id, s.session_date]));
      if (results?.length) {
        const grouped = new Map<string, string[]>();
        for (const r of results) {
          const date = sessionDateMap.get(r.session_id) || "?";
          const key = date;
          if (!grouped.has(key)) grouped.set(key, []);
          const val = r.text_value || (r.value != null ? String(r.value) : "sem valor");
          grouped.get(key)!.push(r.marker_id + ": " + val);
        }
        const parts: string[] = [];
        for (const [date, markers] of grouped) {
          parts.push("Sessão " + date + ":\n" + markers.join(", "));
        }
        labContext = parts.join("\n\n");
      }
    }

    // Format encounters
    let encountersContext = "";
    if (encountersRes.data?.length) {
      encountersContext = encountersRes.data.map((e: any) => {
        const notes = e.clinical_evolution_notes?.[0];
        let text = "Consulta " + e.encounter_date + " (" + e.status + ")";
        if (e.chief_complaint) text += "\nQueixa: " + e.chief_complaint;
        if (notes) {
          if (notes.subjective) text += "\nSubjetivo: " + notes.subjective;
          if (notes.objective) text += "\nObjetivo: " + notes.objective;
          if (notes.assessment) text += "\nAvaliação: " + notes.assessment;
          if (notes.plan) text += "\nPlano: " + notes.plan;
          if (notes.medications) text += "\nMedicamentos: " + notes.medications;
        }
        return text;
      }).join("\n---\n");
    }

    // Format analyses
    let analysesContext = "";
    if (analysesRes.data?.length) {
      analysesContext = analysesRes.data.map((a: any) => {
        let text = "Análise IA (" + a.created_at?.substring(0, 10) + ", " + (a.specialty_name || "geral") + ")";
        if (a.summary) text += "\nResumo: " + a.summary;
        if (a.technical_analysis) text += "\nAnálise técnica: " + a.technical_analysis.substring(0, 1500);
        if (a.patient_plan) text += "\nPlano: " + a.patient_plan.substring(0, 800);
        return text;
      }).join("\n---\n");
    }

    // Format prescriptions
    let prescriptionContext = "";
    if (prescriptionsRes.data?.length) {
      const p = prescriptionsRes.data[0] as any;
      const items = Array.isArray(p.prescription_json) ? p.prescription_json : [];
      if (items.length) {
        prescriptionContext = "Prescrição (" + p.created_at?.substring(0, 10) + ", " + p.status + "):\n" +
          items.map((i: any) => "- " + (i.name || i.item || JSON.stringify(i))).join("\n");
      }
    }

    // Format anamnese
    let anamneseContext = "";
    if (anamneseRes.data?.length) {
      const a = anamneseRes.data[0] as any;
      if (a.anamnese_text) anamneseContext = "Anamnese:\n" + a.anamnese_text.substring(0, 2000);
    }

    // Patient profile
    const age = patient.birth_date
      ? Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / 31557600000)
      : null;
    const profileText = [
      "Nome: " + patient.name,
      "Sexo: " + (patient.sex === "M" ? "Masculino" : "Feminino"),
      age != null ? "Idade: " + age + " anos" : null,
      patient.objectives?.length ? "Objetivos: " + patient.objectives.join(", ") : null,
      patient.main_complaints ? "Queixas: " + patient.main_complaints : null,
      patient.activity_level ? "Nível de atividade: " + patient.activity_level : null,
      patient.restrictions ? "Restrições: " + patient.restrictions : null,
    ].filter(Boolean).join("\n");

    // 3. Build system prompt
    const systemPrompt = `Você é um assistente clínico especializado. Responda perguntas sobre o prontuário do paciente abaixo com base EXCLUSIVAMENTE nos dados fornecidos.

REGRAS OBRIGATÓRIAS:
1. Responda SOMENTE com informações presentes nos dados do prontuário. Se não houver dados suficientes, diga explicitamente.
2. Cite SEMPRE a fonte da informação entre colchetes: [Exame DD/MM/AAAA], [Consulta DD/MM/AAAA], [Análise IA DD/MM/AAAA], [Prescrição DD/MM/AAAA], [Anamnese].
3. NÃO invente dados, valores ou datas que não estejam nos dados fornecidos.
4. NÃO prescreva medicamentos nem sugira tratamentos. Apenas reporte o que consta no prontuário.
5. Use linguagem técnica médica clara e objetiva.
6. Formate com markdown quando apropriado.

--- PERFIL DO PACIENTE ---
${profileText}

--- EXAMES LABORATORIAIS (últimas 3 sessões) ---
${labContext || "Sem exames registrados."}

--- CONSULTAS / EVOLUÇÃO CLÍNICA (últimas 3) ---
${encountersContext || "Sem consultas registradas."}

--- ANÁLISES DE IA (últimas 2) ---
${analysesContext || "Sem análises registradas."}

--- PRESCRIÇÃO MAIS RECENTE ---
${prescriptionContext || "Sem prescrição registrada."}

--- ANAMNESE ---
${anamneseContext || "Sem anamnese registrada."}`;

    // 4. Call Lovable AI with streaming
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + lovableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("patient-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
