import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PARSER_VERSION = "imaging-v1.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text, file_name } = await req.json();

    if (!text || text.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Texto extraído do PDF muito curto para processar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é um assistente médico especializado em laudos de exames de imagem.
Sua tarefa é extrair e estruturar dados de laudos textuais de exames de imagem.
Regras:
- Extraia APENAS o que está claramente presente no texto.
- Campos ambíguos devem ficar vazios (string vazia).
- NÃO interprete imagens — apenas o texto do laudo.
- NÃO invente dados que não existem no texto.
- Preserve classificações exatamente como escritas (TI-RADS, BI-RADS, T-score, etc.).
- Para report_date, use formato YYYY-MM-DD se encontrar uma data no laudo.
- Para exam_type, use um dos valores: ultrassom_tireoide, ultrassom_abdome, ultrassom_pelve, ultrassom_mama, densitometria, ressonancia, tomografia, raio_x, mamografia, ecocardiograma, elastografia, outro.
- Para exam_region, descreva a região anatômica examinada.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Extraia os dados estruturados do seguinte laudo de exame de imagem:\n\n${text}` },
        ],
        temperature: 0.1,
        tools: [
          {
            type: "function",
            function: {
              name: "structure_imaging_report",
              description: "Retorna os campos estruturados extraídos do laudo de imagem.",
              parameters: {
                type: "object",
                properties: {
                  exam_type: { type: "string", description: "Tipo do exame (usar valores padronizados)" },
                  exam_region: { type: "string", description: "Região anatômica examinada" },
                  report_date: { type: "string", description: "Data do exame em formato YYYY-MM-DD" },
                  findings: { type: "string", description: "Achados principais do laudo" },
                  conclusion: { type: "string", description: "Conclusão do laudo" },
                  recommendations: { type: "string", description: "Recomendações do laudo" },
                  incidental_findings: { type: "string", description: "Achados incidentais" },
                  classifications: { type: "string", description: "Classificações (TI-RADS, BI-RADS, T-score, etc.)" },
                  source_lab: { type: "string", description: "Nome do laboratório ou clínica" },
                },
                required: ["exam_type"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "structure_imaging_report" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      throw new Error(`AI gateway error: ${response.status} — ${errText}`);
    }

    const aiResponse = await response.json();

    // Extract from tool_calls
    let fields: Record<string, string> = {};
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        fields = JSON.parse(toolCall.function.arguments);
      } catch {
        // Fallback: try content
        const content = aiResponse.choices?.[0]?.message?.content ?? "{}";
        const match = content.match(/\{[\s\S]*\}/);
        if (match) fields = JSON.parse(match[0]);
      }
    }

    // Clean empty values
    const cleanFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== null && v !== undefined && v !== "") {
        cleanFields[k] = String(v);
      }
    }

    console.log(
      `parse-imaging-report: extracted ${Object.keys(cleanFields).length} fields from "${file_name ?? "unknown"}"`
    );

    return new Response(
      JSON.stringify({
        fields: cleanFields,
        parser_version: PARSER_VERSION,
        field_count: Object.keys(cleanFields).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("parse-imaging-report error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
