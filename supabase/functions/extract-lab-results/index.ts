import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// All marker IDs and names for the prompt
const MARKER_LIST = [
  { id: "hemoglobina", name: "Hemoglobina", unit: "g/dL" },
  { id: "hematocrito", name: "Hematócrito", unit: "%" },
  { id: "eritrocitos", name: "Eritrócitos", unit: "milhões/µL" },
  { id: "vcm", name: "VCM", unit: "fL" },
  { id: "hcm", name: "HCM", unit: "pg" },
  { id: "chcm", name: "CHCM", unit: "g/dL" },
  { id: "rdw", name: "RDW", unit: "%" },
  { id: "leucocitos", name: "Leucócitos", unit: "/µL" },
  { id: "neutrofilos", name: "Neutrófilos", unit: "%" },
  { id: "linfocitos", name: "Linfócitos", unit: "%" },
  { id: "monocitos", name: "Monócitos", unit: "%" },
  { id: "eosinofilos", name: "Eosinófilos", unit: "%" },
  { id: "basofilos", name: "Basófilos", unit: "%" },
  { id: "plaquetas", name: "Plaquetas", unit: "mil/µL" },
  { id: "ferro_serico", name: "Ferro Sérico", unit: "µg/dL" },
  { id: "ferritina", name: "Ferritina", unit: "ng/mL" },
  { id: "transferrina", name: "Transferrina", unit: "mg/dL" },
  { id: "sat_transferrina", name: "Sat. Transferrina", unit: "%" },
  { id: "tibc", name: "TIBC", unit: "µg/dL" },
  { id: "glicose_jejum", name: "Glicose Jejum", unit: "mg/dL" },
  { id: "hba1c", name: "HbA1c", unit: "%" },
  { id: "insulina_jejum", name: "Insulina Jejum", unit: "µU/mL" },
  { id: "homa_ir", name: "HOMA-IR", unit: "" },
  { id: "colesterol_total", name: "Colesterol Total", unit: "mg/dL" },
  { id: "hdl", name: "HDL", unit: "mg/dL" },
  { id: "ldl", name: "LDL", unit: "mg/dL" },
  { id: "vldl", name: "VLDL", unit: "mg/dL" },
  { id: "triglicerides", name: "Triglicerídeos", unit: "mg/dL" },
  { id: "relacao_ct_hdl", name: "CT/HDL", unit: "" },
  { id: "relacao_tg_hdl", name: "TG/HDL", unit: "" },
  { id: "tsh", name: "TSH", unit: "mUI/L" },
  { id: "t4_livre", name: "T4 Livre", unit: "ng/dL" },
  { id: "t3_livre", name: "T3 Livre", unit: "pg/mL" },
  { id: "t3_reverso", name: "T3 Reverso", unit: "ng/dL" },
  { id: "anti_tpo", name: "Anti-TPO", unit: "UI/mL" },
  { id: "anti_tg", name: "Anti-TG", unit: "UI/mL" },
  { id: "testosterona_total", name: "Testosterona Total", unit: "ng/dL" },
  { id: "testosterona_livre", name: "Testosterona Livre", unit: "pg/mL" },
  { id: "estradiol", name: "Estradiol", unit: "pg/mL" },
  { id: "progesterona", name: "Progesterona", unit: "ng/mL" },
  { id: "dhea_s", name: "DHEA-S", unit: "µg/dL" },
  { id: "cortisol", name: "Cortisol (manhã)", unit: "µg/dL" },
  { id: "shbg", name: "SHBG", unit: "nmol/L" },
  { id: "fsh", name: "FSH", unit: "mUI/mL" },
  { id: "lh", name: "LH", unit: "mUI/mL" },
  { id: "prolactina", name: "Prolactina", unit: "ng/mL" },
  { id: "vitamina_d", name: "Vitamina D (25-OH)", unit: "ng/mL" },
  { id: "vitamina_b12", name: "Vitamina B12", unit: "pg/mL" },
  { id: "acido_folico", name: "Ácido Fólico", unit: "ng/mL" },
  { id: "vitamina_a", name: "Vitamina A", unit: "µg/dL" },
  { id: "vitamina_e", name: "Vitamina E", unit: "mg/L" },
  { id: "vitamina_c", name: "Vitamina C", unit: "mg/dL" },
  { id: "vitamina_b6", name: "Vitamina B6", unit: "ng/mL" },
  { id: "vitamina_b1", name: "Vitamina B1", unit: "µg/dL" },
  { id: "magnesio", name: "Magnésio", unit: "mg/dL" },
  { id: "zinco", name: "Zinco", unit: "µg/dL" },
  { id: "selenio", name: "Selênio", unit: "µg/L" },
  { id: "cobre", name: "Cobre", unit: "µg/dL" },
  { id: "manganes", name: "Manganês", unit: "µg/L" },
  { id: "cromo", name: "Cromo", unit: "µg/L" },
  { id: "iodo_urinario", name: "Iodo Urinário", unit: "µg/L" },
  { id: "tgo_ast", name: "TGO (AST)", unit: "U/L" },
  { id: "tgp_alt", name: "TGP (ALT)", unit: "U/L" },
  { id: "ggt", name: "GGT", unit: "U/L" },
  { id: "fosfatase_alcalina", name: "Fosfatase Alcalina", unit: "U/L" },
  { id: "bilirrubina_total", name: "Bilirrubina Total", unit: "mg/dL" },
  { id: "bilirrubina_direta", name: "Bilirrubina Direta", unit: "mg/dL" },
  { id: "albumina", name: "Albumina", unit: "g/dL" },
  { id: "proteinas_totais", name: "Proteínas Totais", unit: "g/dL" },
  { id: "ldh", name: "LDH", unit: "U/L" },
  { id: "creatinina", name: "Creatinina", unit: "mg/dL" },
  { id: "ureia", name: "Ureia", unit: "mg/dL" },
  { id: "acido_urico", name: "Ácido Úrico", unit: "mg/dL" },
  { id: "tfg", name: "TFG (CKD-EPI)", unit: "mL/min" },
  { id: "cistatina_c", name: "Cistatina C", unit: "mg/L" },
  { id: "sodio", name: "Sódio", unit: "mEq/L" },
  { id: "potassio", name: "Potássio", unit: "mEq/L" },
  { id: "calcio_total", name: "Cálcio Total", unit: "mg/dL" },
  { id: "calcio_ionico", name: "Cálcio Iônico", unit: "mg/dL" },
  { id: "fosforo", name: "Fósforo", unit: "mg/dL" },
  { id: "cloro", name: "Cloro", unit: "mEq/L" },
  { id: "bicarbonato", name: "Bicarbonato", unit: "mEq/L" },
  { id: "pth", name: "PTH", unit: "pg/mL" },
  { id: "pcr", name: "PCR", unit: "mg/L" },
  { id: "vhs", name: "VHS", unit: "mm/h" },
  { id: "homocisteina", name: "Homocisteína", unit: "µmol/L" },
];

const systemPrompt = `You are a lab result extraction assistant. You receive raw text from a Brazilian lab report PDF.
Your task: extract ALL numeric values and map them to the known marker IDs. Be thorough — extract every single marker you can find.

Here are the known markers (id | name | unit):
${MARKER_LIST.map((m) => `${m.id} | ${m.name} | ${m.unit}`).join("\n")}

IMPORTANT — Common alternative names in Brazilian lab reports:
- "Hemácias" or "Glóbulos Vermelhos" → eritrocitos
- "Glóbulos Brancos" → leucocitos
- "Segmentados" or "Neutrófilos Segmentados" → neutrofilos
- "Colesterol HDL" or "HDL-Colesterol" → hdl
- "Colesterol LDL" or "LDL-Colesterol" → ldl
- "Colesterol não-HDL" → ignore (not in our list)
- "Triglicérides" or "Triglicerídios" → triglicerides
- "AST" or "TGO" or "Aspartato" → tgo_ast
- "ALT" or "TGP" or "Alanina" → tgp_alt
- "Gama GT" or "Gama Glutamil" → ggt
- "25-Hidroxivitamina D" or "25(OH)D" or "Vitamina D3" → vitamina_d
- "Ácido Fólico" or "Folato" → acido_folico
- "TSH Ultra-sensível" or "Tirotropina" → tsh
- "T4L" or "Tiroxina Livre" → t4_livre
- "T3L" or "Triiodotironina Livre" → t3_livre
- "SHBG" or "Globulina Ligadora" → shbg
- "PCR ultra-sensível" or "PCR-us" or "Proteína C Reativa" → pcr
- "VHS" or "Velocidade de Hemossedimentação" → vhs
- "Clearance" or "Filtração Glomerular" or "CKD-EPI" → tfg
- "PTH Intacto" or "Paratormônio" → pth
- "TIBC" or "Capacidade Total de Ligação do Ferro" → tibc
- "Saturação de Transferrina" or "Índice de Saturação" → sat_transferrina
- "Hemoglobina Glicada" or "A1C" → hba1c
- "HOMA" or "HOMA-IR" or "Índice HOMA" → homa_ir
- "Relação CT/HDL" or "Índice de Castelli" → relacao_ct_hdl
- "Relação TG/HDL" → relacao_tg_hdl

Rules:
- Extract EVERY marker you can find. Be aggressive — if a value looks like it matches a marker, include it.
- The report may have multiple pages separated by "--- Página X ---". Search ALL pages thoroughly.
- Vitamins, hormones, thyroid, iron, and mineral markers are often on later pages — don't stop early.
- Convert values to the expected unit if needed (e.g. thousands to units).
- For Plaquetas, the value in the PDF is usually in thousands (e.g. "250.000 /µL" → return 250).
- For Leucócitos, the value is usually absolute (e.g. "6.500 /µL" → return 6500).
- For Eritrócitos, the value is usually in millions (e.g. "4.80 milhões/µL" → return 4.80).
- Brazilian decimals use comma: "4,37" → 4.37. Convert commas to dots.
- Values with dot as thousands separator: "6.500" for leucocitos → 6500.
- Return ONLY numeric values, no text.
- If a marker appears multiple times, use the first occurrence.
- Look for values in tables, lists, and inline text formats.
- Values like "< 10" or "< 0,5" should use the number (10 or 0.5).
- Ignore reference ranges — only extract the patient's actual result value.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfText } = await req.json();
    if (!pdfText || typeof pdfText !== "string") {
      return new Response(JSON.stringify({ error: "pdfText is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Extract ALL lab results from this Brazilian lab report. Be thorough and extract every single marker you can identify. Pay special attention to vitamins, hormones, thyroid, iron, minerals, electrolytes, and liver/kidney markers — they are often in separate sections or pages:\n\n${pdfText.slice(0, 40000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_results",
              description: "Return extracted lab marker values mapped to their IDs",
              parameters: {
                type: "object",
                properties: {
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        marker_id: { type: "string", description: "The marker ID from the known list" },
                        value: { type: "number", description: "The numeric value extracted" },
                      },
                      required: ["marker_id", "value"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["results"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_results" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    // Validate marker IDs
    const validIds = new Set(MARKER_LIST.map((m) => m.id));
    const validResults = (parsed.results || []).filter(
      (r: any) => validIds.has(r.marker_id) && typeof r.value === "number" && !isNaN(r.value)
    );

    return new Response(JSON.stringify({ results: validResults }), {
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
