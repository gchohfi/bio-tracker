import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MarkerResult {
  marker_id: string;
  marker_name: string;
  value: number | null;
  text_value?: string;
  unit: string;
  functional_min?: number;
  functional_max?: number;
  status: "normal" | "low" | "high" | "critical_low" | "critical_high" | "qualitative";
  session_date: string;
}

interface AnalysisRequest {
  patient_name: string;
  sex: "M" | "F";
  birth_date?: string;
  sessions: Array<{ id: string; session_date: string }>;
  results: MarkerResult[];
}

interface AnalysisResponse {
  summary: string;
  
  patterns: string[];
  trends: string[];
  suggestions: string[];
  full_text: string;
}

const SYSTEM_PROMPT = `Você é um assistente clínico especializado em medicina funcional e integrativa, com profundo conhecimento em interpretação de exames laboratoriais. 

Sua função é analisar resultados de exames laboratoriais de pacientes e fornecer uma análise clínica estruturada, EQUILIBRADA e objetiva para uso profissional (nutricionistas, médicos, profissionais de saúde).

REGRAS IMPORTANTES:
1. Sempre use linguagem técnica e profissional em português brasileiro
2. Nunca faça diagnósticos definitivos — use termos como "sugere", "pode indicar", "merece acompanhamento"
3. SEJA EQUILIBRADO: destaque tanto os achados positivos quanto os que merecem atenção. Comece reconhecendo o que está adequado antes de mencionar alterações
4. NÃO SEJA ALARMISTA: evite linguagem negativa excessiva. Use tom neutro e analítico. Prefira "merece acompanhamento" a "preocupante", "discretamente alterado" a "anormal"
5. Valores levemente fora da faixa funcional devem ser tratados como variações discretas, não como problemas graves
6. Correlacione marcadores entre si quando houver relação clínica relevante
7. Considere o sexo e idade do paciente nas interpretações
8. Quando houver múltiplas sessões, identifique tendências (melhora, piora, estabilidade) — destaque melhorias quando existirem
9. Seja conciso mas completo — cada seção deve ter no máximo 3-5 pontos
10. Foque em achados acionáveis — o que o profissional pode fazer com essa informação
11. No resumo (summary), comece com uma visão geral equilibrada do estado do paciente, mencionando primeiro os pontos positivos

FORMATO DE SAÍDA (JSON estrito):
{
  "summary": "Parágrafo de 2-3 frases com visão equilibrada: primeiro os pontos positivos, depois os que merecem atenção",
  "patterns": ["Padrões clínicos identificados pela correlação entre marcadores — incluir padrões positivos também"],
  "trends": ["Tendências observadas entre sessões — destacar melhorias quando houver"],
  "suggestions": ["Sugestões de exames complementares ou ajustes — apenas quando clinicamente justificado"],
  "full_text": "Análise narrativa completa em 3-5 parágrafos para inclusão no relatório. Tom equilibrado e profissional."
}`;

function buildUserPrompt(req: AnalysisRequest): string {
  const age = req.birth_date
    ? Math.floor((Date.now() - new Date(req.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  const sexLabel = req.sex === "M" ? "Masculino" : "Feminino";
  const ageLabel = age ? `${age} anos` : "idade não informada";

  // Group results by session
  const sessionMap: Record<string, MarkerResult[]> = {};
  for (const r of req.results) {
    if (!sessionMap[r.session_date]) sessionMap[r.session_date] = [];
    sessionMap[r.session_date].push(r);
  }

  const sessionDates = Object.keys(sessionMap).sort();

  // Build abnormal markers list (prioritize alerts)
  const abnormal = req.results.filter(
    (r) => r.status === "low" || r.status === "high" || r.status === "critical_low" || r.status === "critical_high"
  );

  const normal = req.results.filter((r) => r.status === "normal");

  let prompt = `DADOS DO PACIENTE:
- Nome: ${req.patient_name}
- Sexo: ${sexLabel}
- Idade: ${ageLabel}
- Número de sessões: ${sessionDates.length}
- Datas das sessões: ${sessionDates.join(", ")}

MARCADORES FORA DA FAIXA FUNCIONAL (${abnormal.length} marcadores):
`;

  for (const r of abnormal) {
    const valueStr = r.value !== null ? `${r.value} ${r.unit}` : r.text_value ?? "—";
    const refStr = r.functional_min !== undefined && r.functional_max !== undefined
      ? `(ref funcional: ${r.functional_min}–${r.functional_max} ${r.unit})`
      : "";
    const statusLabels: Record<string, string> = {
      low: "↓ BAIXO",
      high: "↑ ALTO",
      critical_low: "⬇ CRÍTICO BAIXO",
      critical_high: "⬆ CRÍTICO ALTO",
    };
    const statusLabel = statusLabels[r.status] ?? r.status;
    prompt += `- ${r.marker_name}: ${valueStr} ${statusLabel} ${refStr} [${r.session_date}]\n`;
  }

  prompt += `\nMARCADORES DENTRO DA FAIXA FUNCIONAL (${normal.length} marcadores):\n`;
  for (const r of normal) {
    const valueStr = r.value !== null ? `${r.value} ${r.unit}` : r.text_value ?? "—";
    prompt += `- ${r.marker_name}: ${valueStr} [${r.session_date}]\n`;
  }

  // If multiple sessions, add trend data
  if (sessionDates.length > 1) {
    prompt += `\nDADOS DE TENDÊNCIA (múltiplas sessões):\n`;
    // Find markers present in multiple sessions
    const markerSessions: Record<string, Array<{ date: string; value: number }>> = {};
    for (const r of req.results) {
      if (r.value !== null) {
        if (!markerSessions[r.marker_name]) markerSessions[r.marker_name] = [];
        markerSessions[r.marker_name].push({ date: r.session_date, value: r.value });
      }
    }
    for (const [name, entries] of Object.entries(markerSessions)) {
      if (entries.length > 1) {
        const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const delta = ((last.value - first.value) / first.value * 100).toFixed(1);
        const trend = last.value > first.value ? "↑" : last.value < first.value ? "↓" : "→";
        prompt += `- ${name}: ${first.value} → ${last.value} (${trend} ${delta}%)\n`;
      }
    }
  }

  prompt += `\nPor favor, analise esses resultados e retorne um JSON com a análise clínica estruturada conforme o formato especificado.`;

  return prompt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: AnalysisRequest = await req.json();

    if (!body.patient_name || !body.results || body.results.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: patient_name, results" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userPrompt = buildUserPrompt(body);

    console.log(`Analyzing ${body.results.length} markers for ${body.patient_name}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText);
      throw new Error(`AI API returned ${response.status}: ${errText}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) throw new Error("Empty response from AI");

    let analysis: AnalysisResponse;
    try {
      analysis = JSON.parse(content);
    } catch {
      // If JSON parsing fails, wrap the text in the expected structure
      analysis = {
        summary: content.slice(0, 300),
        
        patterns: [],
        trends: [],
        suggestions: [],
        full_text: content,
      };
    }

    return new Response(
      JSON.stringify({ analysis }),
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
