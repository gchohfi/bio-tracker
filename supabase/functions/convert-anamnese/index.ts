import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { anamnese_text } = await req.json();

    if (!anamnese_text || typeof anamnese_text !== "string" || anamnese_text.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Texto de anamnese muito curto ou ausente." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Voce e um assistente medico especializado em extrair dados clinicos estruturados de textos de anamnese.
Sua tarefa e analisar o texto livre de anamnese fornecido e extrair os campos estruturados usando a funcao fornecida.
Regras:
- Extraia APENAS informacoes explicitamente mencionadas no texto.
- NAO invente ou infira dados nao presentes.
- Para arrays (objetivos, sintomas, etc.), separe cada item individualmente.
- Para campos booleanos (tabagismo), use true/false.
- Para campos de escolha (qualidade_sono, nivel_estresse, etilismo), use os valores permitidos.
- Se um campo nao for mencionado, nao o inclua.
- Coloque texto restante que nao se encaixe em nenhum campo em "observacoes".`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + LOVABLE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: "Analise o seguinte texto de anamnese e extraia os campos estruturados:\n\n" + anamnese_text,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_structured_anamnese",
              description: "Extrai campos estruturados de um texto de anamnese clinica.",
              parameters: {
                type: "object",
                properties: {
                  queixa_principal: {
                    type: "string",
                    description: "Queixa principal do paciente",
                  },
                  objetivos: {
                    type: "array",
                    items: { type: "string" },
                    description: "Objetivos do paciente (emagrecimento, ganho muscular, etc.)",
                  },
                  sintomas: {
                    type: "array",
                    items: { type: "string" },
                    description: "Sintomas relevantes relatados",
                  },
                  sono_horas: {
                    type: "number",
                    description: "Horas de sono por noite",
                  },
                  qualidade_sono: {
                    type: "string",
                    enum: ["boa", "regular", "ruim"],
                    description: "Qualidade do sono",
                  },
                  nivel_estresse: {
                    type: "string",
                    enum: ["baixo", "moderado", "alto"],
                    description: "Nivel de estresse",
                  },
                  atividade_fisica: {
                    type: "string",
                    description: "Descricao da atividade fisica praticada",
                  },
                  tabagismo: {
                    type: "boolean",
                    description: "Se o paciente e tabagista",
                  },
                  etilismo: {
                    type: "string",
                    enum: ["não", "social", "moderado", "diário"],
                    description: "Padrao de consumo de alcool",
                  },
                  dieta_resumo: {
                    type: "string",
                    description: "Resumo do padrao alimentar",
                  },
                  comorbidades: {
                    type: "array",
                    items: { type: "string" },
                    description: "Comorbidades ou doencas previas",
                  },
                  cirurgias: {
                    type: "array",
                    items: { type: "string" },
                    description: "Cirurgias previas",
                  },
                  historico_familiar: {
                    type: "string",
                    description: "Historico familiar relevante",
                  },
                  medicacoes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Medicacoes em uso (nome e dose quando disponivel)",
                  },
                  suplementos: {
                    type: "array",
                    items: { type: "string" },
                    description: "Suplementos em uso",
                  },
                  alergias: {
                    type: "array",
                    items: { type: "string" },
                    description: "Alergias conhecidas",
                  },
                  restricoes_alimentares: {
                    type: "string",
                    description: "Restricoes alimentares (intolerancia, vegetariano, etc.)",
                  },
                  observacoes: {
                    type: "string",
                    description: "Informacoes restantes que nao se encaixam nos campos acima",
                  },
                },
                required: [],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "extract_structured_anamnese" },
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error: " + response.status);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== "extract_structured_anamnese") {
      throw new Error("AI did not return structured extraction");
    }

    let structured: Record<string, unknown>;
    try {
      structured = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("Failed to parse AI response");
    }

    // Clean up: remove empty arrays and empty strings
    for (const [key, value] of Object.entries(structured)) {
      if (Array.isArray(value) && value.length === 0) delete structured[key];
      if (typeof value === "string" && value.trim() === "") delete structured[key];
    }

    console.log(
      "Anamnese converted: " +
        Object.keys(structured).length +
        " fields extracted from " +
        anamnese_text.length +
        " chars"
    );

    return new Response(
      JSON.stringify({ structured_data: structured }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("convert-anamnese error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
