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
  { id: "bastonetes", name: "Bastonetes", unit: "%" },
  { id: "segmentados", name: "Segmentados", unit: "%" },
  { id: "linfocitos", name: "Linfócitos", unit: "%" },
  { id: "monocitos", name: "Monócitos", unit: "%" },
  { id: "eosinofilos", name: "Eosinófilos", unit: "%" },
  { id: "basofilos", name: "Basófilos", unit: "%" },
  { id: "plaquetas", name: "Plaquetas", unit: "mil/µL" },
  { id: "vpm", name: "VPM (Volume Plaquetário Médio)", unit: "fL" },
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
  { id: "colesterol_nao_hdl", name: "Colesterol Não-HDL", unit: "mg/dL" },
  { id: "apo_a1", name: "Apolipoproteína A-1", unit: "mg/dL" },
  { id: "apo_b", name: "Apolipoproteína B", unit: "mg/dL" },
  { id: "lipoproteina_a", name: "Lipoproteína (a)", unit: "nmol/L" },
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
  { id: "igf1", name: "IGF-1 (Somatomedina C)", unit: "ng/mL" },
  { id: "igfbp3", name: "IGFBP-3", unit: "µg/mL" },
  { id: "acth", name: "ACTH", unit: "pg/mL" },
  { id: "cortisol_livre_urina", name: "Cortisol Livre (urina 24h)", unit: "µg/24h" },
  { id: "aldosterona", name: "Aldosterona", unit: "ng/dL" },
  { id: "dihidrotestosterona", name: "Dihidrotestosterona", unit: "pg/mL" },
  { id: "vitamina_d", name: "Vitamina D (25-OH)", unit: "ng/mL" },
  { id: "vitamina_d_125", name: "1,25-Dihidroxi Vitamina D", unit: "pg/mL" },
  { id: "vitamina_b12", name: "Vitamina B12", unit: "pg/mL" },
  { id: "acido_folico", name: "Ácido Fólico", unit: "ng/mL" },
  { id: "vitamina_a", name: "Vitamina A (Retinol)", unit: "mg/L" },
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
  { id: "chumbo", name: "Chumbo", unit: "µg/dL" },
  { id: "tgo_ast", name: "TGO (AST)", unit: "U/L" },
  { id: "tgp_alt", name: "TGP (ALT)", unit: "U/L" },
  { id: "ggt", name: "GGT", unit: "U/L" },
  { id: "fosfatase_alcalina", name: "Fosfatase Alcalina", unit: "U/L" },
  { id: "bilirrubina_total", name: "Bilirrubina Total", unit: "mg/dL" },
  { id: "bilirrubina_direta", name: "Bilirrubina Direta", unit: "mg/dL" },
  { id: "bilirrubina_indireta", name: "Bilirrubina Indireta", unit: "mg/dL" },
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
  { id: "calcio_ionico", name: "Cálcio Iônico", unit: "mmol/L" },
  { id: "fosforo", name: "Fósforo", unit: "mg/dL" },
  { id: "cloro", name: "Cloro", unit: "mEq/L" },
  { id: "bicarbonato", name: "Bicarbonato", unit: "mEq/L" },
  { id: "pth", name: "PTH", unit: "pg/mL" },
  { id: "pcr", name: "PCR", unit: "mg/L" },
  { id: "vhs", name: "VHS", unit: "mm/h" },
  { id: "homocisteina", name: "Homocisteína", unit: "µmol/L" },
  { id: "fibrinogenio", name: "Fibrinogênio", unit: "mg/dL" },
  { id: "amilase", name: "Amilase", unit: "U/L" },
  { id: "lipase", name: "Lipase", unit: "U/L" },
  { id: "fan", name: "FAN (Fator Anti-Núcleo)", unit: "" },
  { id: "eletroforese_albumina", name: "Albumina (eletroforese)", unit: "%" },
  { id: "eletroforese_alfa1", name: "Alfa 1 (eletroforese)", unit: "%" },
  { id: "eletroforese_alfa2", name: "Alfa 2 (eletroforese)", unit: "%" },
  { id: "eletroforese_beta1", name: "Beta 1 (eletroforese)", unit: "%" },
  { id: "eletroforese_beta2", name: "Beta 2 (eletroforese)", unit: "%" },
  { id: "eletroforese_gama", name: "Gama (eletroforese)", unit: "%" },
  { id: "relacao_ag", name: "Relação A/G", unit: "" },
];

const systemPrompt = `You are a lab result extraction assistant. You receive raw text from a Brazilian lab report PDF.
Your task: extract ALL numeric values and map them to the known marker IDs. Be thorough — extract every single marker you can find.

Here are the known markers (id | name | unit):
${MARKER_LIST.map((m) => `${m.id} | ${m.name} | ${m.unit}`).join("\n")}

IMPORTANT — Common alternative names in Brazilian lab reports:
- "Hemácias" or "Glóbulos Vermelhos" → eritrocitos
- "Glóbulos Brancos" → leucocitos
- "Segmentados" or "Neutrófilos Segmentados" → segmentados (NOT neutrofilos)
- "Bastonetes" or "Bastões" → bastonetes
- "VPM" or "Volume Plaquetário Médio" or "MPV" → vpm
- "Colesterol HDL" or "HDL-Colesterol" or "HDL:" → hdl
- "Colesterol LDL" or "LDL-Colesterol" or "LDL:" → ldl
- "Colesterol não-HDL" or "NÃO-HDL" or "NÃO-HDL:" → colesterol_nao_hdl
- "Triglicérides" or "Triglicerídios" or "Triglicérides:" → triglicerides
- "Apolipoproteína A-1" or "Apo A1" or "Apo A-I" or "APOLIPOPROTEÍNA A-1" → apo_a1
- "Apolipoproteína B" or "Apo B" or "APOLIPOPROTEÍNA B" → apo_b
- "Lipoproteína (a)" or "Lp(a)" or "Lipoproteina A" or "LIPOPROTEINA A" → lipoproteina_a
- "AST" or "TGO" or "Aspartato" or "GOT" or "TRANSAMINASE GLUTÂMICO OXALACÉTICA" or "GOT/AST" → tgo_ast
- "ALT" or "TGP" or "Alanina" or "GPT" or "TRANSAMINASE GLUTÂMICO PIRÚVICA" or "GPT/ALT" → tgp_alt
- "Gama GT" or "Gama Glutamil" or "GAMA GT" → ggt
- "Bilirrubina Indireta" → bilirrubina_indireta
- "25-Hidroxivitamina D" or "25(OH)D" or "Vitamina D3" or "25 HIDROXI VITAMINA D" → vitamina_d
- "1,25-Dihidroxi Vitamina D" or "1,25(OH)2D" or "Calcitriol" or "1,25 DIHIDROXI VITAMINA D" → vitamina_d_125
- "Ácido Fólico" or "Folato" or "ACIDO FOLICO" → acido_folico
- "Ácido Ascórbico" or "Vitamina C" or "ACIDO ASCORBICO" → vitamina_c
- "Retinol" or "Vitamina A" or "VITAMINA A - RETINOL" → vitamina_a
- "TSH Ultra-sensível" or "Tirotropina" or "TSH" → tsh
- "T4L" or "Tiroxina Livre" or "T4 LIVRE" → t4_livre
- "T3L" or "Triiodotironina Livre" or "T3 LIVRE" → t3_livre
- "SHBG" or "Globulina Ligadora" or "S H B G" → shbg
- "PCR ultra-sensível" or "PCR-us" or "Proteína C Reativa" or "PROTEÍNA C REATIVA ULTRA-SENSÍVEL" → pcr
- "VHS" or "Velocidade de Hemossedimentação" or "VELOCIDADE DE HEMOSSEDIMENTAÇÃO" → vhs
- "Clearance" or "Filtração Glomerular" or "CKD-EPI" or "Estimativa da Taxa de Filtração Glomerular" → tfg
- "PTH Intacto" or "Paratormônio" or "PARATORMÔNIO PTH INTACTO" → pth
- "TIBC" or "Capacidade Total de Ligação do Ferro" or "Capacidade total de fixação do ferro" → tibc
- "Saturação de Transferrina" or "Índice de Saturação" or "Indice Saturação Transferrina" or "SATURAÇÃO DE TRANSFERRINA" → sat_transferrina
- "Hemoglobina Glicada" or "A1C" or "Hemoglobina Glicosilada" or "HEMOGLOBINA GLICOSILADA" or "HEMOGLOBINA GLICADA (A1C)" → hba1c
- "HOMA" or "HOMA-IR" or "Índice HOMA" → homa_ir
- "Relação CT/HDL" or "Índice de Castelli" → relacao_ct_hdl
- "Relação TG/HDL" → relacao_tg_hdl
- "Fibrinogênio" or "Fibrinogenio" or "FIBRINOGÊNIO" → fibrinogenio
- "Amilase" or "AMILASE" → amilase
- "Lipase" or "LIPASE" → lipase
- "IGF-1" or "Somatomedina C" or "IGF 1" or "IGF 1- SOMATOMEDINA C" → igf1
- "IGFBP-3" or "Proteína Ligadora-3 do IGF" or "IGFBP3" or "IGFBP-3 PROTEÍNA LIGADORA -3 DO IGF" → igfbp3
- "ACTH" or "Hormônio Adrenocorticotrófico" or "Adrenocorticotrofina" or "HORMÔNIO ADRENOCORTICOTRÓFICO A.C.T.H." → acth
- "Cortisol Livre" or "Cortisol urinário" (when unit is µg/24h or mcg/24 HORAS) → cortisol_livre_urina
- "Aldosterona" or "ALDOSTERONA" → aldosterona
- "Dihidrotestosterona" or "DHT" or "DIHIDROTESTOSTERONA" → dihidrotestosterona
- "SDHEA" or "Sulfato de Dehidroepiandrosterona" or "S-DHEA" or "SULFATO DE DEHIDROEPIANDROSTERONA (SDHEA)" → dhea_s
- "FAN" or "Fator Anti-Núcleo" or "Anticorpos Anticélula" or "FAN - FATOR ANTI-NÚCLEO" → fan (use 0 for NÃO REAGENTE, 1 for REAGENTE)
- "Eletroforese de Proteínas" → extract individual fractions: eletroforese_albumina, eletroforese_alfa1, eletroforese_alfa2, eletroforese_beta1, eletroforese_beta2, eletroforese_gama (use the % values)
- "Relação A/G" → relacao_ag
- "Proteínas Totais" or "PROTEÍNAS TOTAIS" → proteinas_totais
- "Chumbo" or "CHUMBO" → chumbo
- "Cálcio Ionizável" or "Cálcio Iônico" or "Cálcio ionizado" or "CÁLCIO IONIZÁVEL" → calcio_ionico (use mmol/L value)
- "HORMÔNIO LUTEINIZANTE" or "LH" → lh
- "Prolactina" or "PROLACTINA" → prolactina
- "Progesterona" or "PROGESTERONA" → progesterona
- "Estradiol" or "ESTRADIOL" → estradiol
- "Testosterona Total" or "TESTOSTERONA TOTAL" → testosterona_total
- "Testosterona Livre" or "TESTOSTERONA LIVRE" → testosterona_livre (IMPORTANT: if value is in ng/dL, multiply by 10 to convert to pg/mL)
- "Zinco" or "ZINCO" → zinco (value in mcg/dL = µg/dL)
- "Cobre" or "COBRE" → cobre (value in mcg/dL = µg/dL)
- "Selênio" or "SELÊNIO" → selenio (value in mcg/L = µg/L)
- "ANTICORPO ANTI TPO" or "Anti-TPO" → anti_tpo
- "ANTICORPOS ANTI TIREOGLOBULINA" or "Anti-TG" or "Anti-Tireoglobulina" → anti_tg
- "Capacidade livre de fixação do ferro" - this is NOT TIBC; ignore this value
- "Colesterol Total:" → colesterol_total
- "VLDL:" → vldl
- "Cálcio Total" or "CALCIO TOTAL" → calcio_total

Rules:
- Extract EVERY marker you can find. Be aggressive — if a value looks like it matches a marker, include it.
- The report may have multiple pages. Search ALL text thoroughly from start to end.
- Vitamins, hormones, thyroid, iron, and mineral markers are often at the end — don't stop early.
- CRITICAL: Extract sub-items within grouped panels. For example:
  - Hemograma: includes Bastonetes, Segmentados (within differential count), VPM (within platelet section)
  - Lipidograma: includes Colesterol Não-HDL, VLDL, each listed as sub-items
  - Bilirrubinas: Total, Direta, AND Indireta — all three
  - Renal: Creatinina, Ureia, Ácido Úrico, TFG (sometimes listed as "Estimativa" or "Clearance")
  - Ferro: Ferro Sérico, Ferritina, Transferrina, Sat. Transferrina, AND TIBC
- Convert values to the expected unit if needed.
- For Plaquetas, the value in the PDF is usually in thousands (e.g. "336 mil/mm3" → return 336).
- For Leucócitos, if value is small like "3,9" in thousands/mm³, return 3900. If value is already large like "6500", return 6500.
- For Eritrócitos, the value is usually in millions (e.g. "3,8 milhões/mm³" → return 3.8).
- Brazilian decimals use comma: "4,37" → 4.37. Convert commas to dots.
- Values with dot as thousands separator: "6.500" for leucocitos → 6500.
- Return ONLY numeric values, no text.
- If a marker appears multiple times, use the FIRST occurrence (the actual result, not historical).
- Look for values in tables, lists, and inline text formats.
- Values like "< 10" or "< 0,5" or "Inferior a 0,5" should use the number (10 or 0.5).
- "INFERIOR A X" → use X as value.
- "Superior a 90" for TFG → use 90.
- Ignore reference ranges — only extract the patient's actual result value.
- For FAN: NÃO REAGENTE = 0, REAGENTE = 1.
- For Cortisol: if from blood/morning → cortisol. If from "URINA 24 HORAS" with "mcg/24 HORAS" → cortisol_livre_urina.
- For Vitamina A/Retinol: the PDF may show mg/L — use that value directly.
- For Testosterona Livre: if the value unit is ng/dL, multiply by 10 to get pg/mL. Example: 0.67 ng/dL → 6.7 pg/mL.
- For Eletroforese: look for a table with Albumina %, Alfa 1 %, Alfa 2 %, Beta 1 %, Beta 2 %, Gama %, Relação A/G, Proteínas Totais.
- For PERFIL LIPÍDICO/LIPIDOGRAMA: extract Colesterol Total, HDL, LDL, VLDL, Triglicérides, NÃO-HDL from the results table.
- mcg = µg (microgram). mcg/dL = µg/dL, mcg/L = µg/L, mcg/24 HORAS = µg/24h.
- For Aldosterona: may appear as "ALDOSTERONA" or "Aldosterona Sérica".
- For Amilase and Lipase: pancreatic enzymes, often appear together.
- For Fosfatase Alcalina: may appear as "FOSFATASE ALCALINA" or "FA".
- For LDH: "Desidrogenase Láctica" or "LDH" or "DESIDROGENASE LÁTICA".
- For Cistatina C: "CISTATINA C" or "Cistatina C sérica".
- IMPORTANT: You must extract AT LEAST 80 markers if they are present. Count your results before returning.`;

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
    
    const textToSend = pdfText.slice(0, 120000);
    console.log(`PDF text received: ${pdfText.length} chars, sending: ${textToSend.length} chars to AI`);

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
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Extract ALL lab results from this Brazilian lab report. Target: ~85+ markers. Be exhaustive.

COMMONLY MISSED — search explicitly for each:
- Hemograma diferencial: Bastonetes, Segmentados, VPM
- Eletrólitos: Sódio, Potássio, Magnésio, Fósforo, Cloro, Bicarbonato
- Pancreáticos: Amilase, Lipase
- Adrenal: Aldosterona, ACTH, Cortisol Livre Urina 24h
- Minerais: Selênio, Cobre, Zinco, Manganês, Cromo, Iodo Urinário
- Lipídios avançados: Apo A-1, Apo B, Lipoproteína(a), Colesterol Não-HDL, CT/HDL, TG/HDL
- Ferro completo: Transferrina, TIBC, Sat. Transferrina
- Vitaminas: 25-OH Vitamina D (vitamina_d) AND 1,25-Dihidroxi Vitamina D (vitamina_d_125) — TWO SEPARATE markers
- Vitaminas B1, B6, E
- Hepático: Fosfatase Alcalina, LDH, Proteínas Totais, Bilirrubina Indireta
- Renal: TFG/CKD-EPI, Cistatina C
- Hormônios: Testosterona Livre, DHT/Dihidrotestosterona, IGF-1, IGFBP-3
- Imunologia: FAN (0=NÃO REAGENTE, 1=REAGENTE)
- Coagulação: Fibrinogênio
- VHS (Velocidade de Hemossedimentação)
- Eletroforese de Proteínas: Albumina %, Alfa 1 %, Alfa 2 %, Beta 1 %, Beta 2 %, Gama %, Relação A/G

Search the ENTIRE text from first to last line. Do NOT stop early.\n\n${textToSend}`,
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
    
    console.log(`Extracted ${validResults.length} valid markers:`, validResults.map((r: any) => r.marker_id).join(', '));

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
