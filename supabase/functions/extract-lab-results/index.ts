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
  { id: "ferro_metabolismo", name: "Ferro (painel Metabolismo do Ferro)", unit: "µg/dL" },
  { id: "fixacao_latente_ferro", name: "Capacidade de Fixação Latente do Ferro", unit: "µg/dL" },
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
  { id: "relacao_apob_apoa1", name: "ApoB/ApoA1", unit: "" },
  { id: "tsh", name: "TSH", unit: "mUI/L" },
  { id: "t4_livre", name: "T4 Livre", unit: "ng/dL" },
  { id: "t4_total", name: "T4 Total", unit: "µg/dL" },
  { id: "t3_livre", name: "T3 Livre", unit: "ng/dL" },
  { id: "t3_total", name: "T3 Total", unit: "ng/dL" },
  { id: "t3_reverso", name: "T3 Reverso", unit: "ng/dL" },
  { id: "anti_tpo", name: "Anti-TPO", unit: "UI/mL" },
  { id: "anti_tg", name: "Anti-TG", unit: "UI/mL" },
  { id: "trab", name: "TRAb", unit: "UI/L" },
  { id: "testosterona_total", name: "Testosterona Total", unit: "ng/dL" },
  { id: "testosterona_livre", name: "Testosterona Livre", unit: "ng/dL" },
  { id: "testosterona_biodisponivel", name: "Testosterona Biodisponível", unit: "ng/dL" },
  { id: "estradiol", name: "Estradiol", unit: "pg/mL" },
  { id: "estrona", name: "Estrona (E1)", unit: "pg/mL" },
  { id: "progesterona", name: "Progesterona", unit: "ng/mL" },
  { id: "dhea_s", name: "DHEA-S", unit: "µg/dL" },
  { id: "cortisol", name: "Cortisol (manhã)", unit: "µg/dL" },
  { id: "shbg", name: "SHBG", unit: "nmol/L" },
  { id: "fsh", name: "FSH", unit: "mUI/mL" },
  { id: "lh", name: "LH", unit: "mUI/mL" },
  { id: "prolactina", name: "Prolactina", unit: "ng/mL" },
  { id: "amh", name: "AMH (Hormônio Anti-Mülleriano)", unit: "ng/mL" },
  { id: "igf1", name: "IGF-1 (Somatomedina C)", unit: "ng/mL" },
  { id: "igfbp3", name: "IGFBP-3", unit: "µg/mL" },
  { id: "acth", name: "ACTH", unit: "pg/mL" },
  { id: "cortisol_livre_urina", name: "Cortisol Livre (urina 24h)", unit: "µg/24h" },
  { id: "aldosterona", name: "Aldosterona", unit: "ng/dL" },
  { id: "dihidrotestosterona", name: "Dihidrotestosterona", unit: "pg/mL" },
  { id: "androstenediona", name: "Androstenediona", unit: "ng/dL" },
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
  { id: "calcitonina", name: "Calcitonina", unit: "pg/mL" },
  { id: "pcr", name: "PCR", unit: "mg/L" },
  { id: "vhs", name: "VHS", unit: "mm/h" },
  { id: "homocisteina", name: "Homocisteína", unit: "µmol/L" },
  { id: "fibrinogenio", name: "Fibrinogênio", unit: "mg/dL" },
  { id: "dimeros_d", name: "Dímeros D", unit: "ng/mL" },
  { id: "amilase", name: "Amilase", unit: "U/L" },
  { id: "lipase", name: "Lipase", unit: "U/L" },
  { id: "mercurio", name: "Mercúrio", unit: "µg/L" },
  { id: "cadmio", name: "Cádmio", unit: "µg/L" },
  { id: "aluminio", name: "Alumínio", unit: "µg/L" },
  { id: "cobalto", name: "Cobalto", unit: "µg/L" },
  { id: "arsenico", name: "Arsênico", unit: "mcg/L" },
  { id: "niquel", name: "Níquel", unit: "µg/L" },
  { id: "fan", name: "FAN (Fator Anti-Núcleo)", unit: "", qualitative: true },
  { id: "fator_reumatoide", name: "Fator Reumatoide", unit: "UI/mL" },
  { id: "anti_endomisio_iga", name: "Anti-Endomísio IgA", unit: "", qualitative: true },
  { id: "anti_transglutaminase_iga", name: "Anti-Transglutaminase IgA", unit: "U" },
  { id: "g6pd", name: "G6PD (Glicose-6-Fosfato Desidrogenase)", unit: "U/g Hb" },
  // Sorologia Infecciosa
  { id: "hiv", name: "HIV 1/2 (Anticorpos e Antígeno)", unit: "", qualitative: true },
  { id: "hbsag", name: "HBsAg (Antígeno Austrália)", unit: "", qualitative: true },
  { id: "anti_hbs", name: "Anti-HBs (Hepatite B)", unit: "UI/L" },
  { id: "anti_hbc_total", name: "Anti-HBc Total (Hepatite B)", unit: "", qualitative: true },
  { id: "anti_hcv", name: "Anti-HCV (Hepatite C)", unit: "", qualitative: true },
  { id: "sifilis_treponemico", name: "Sífilis (Anti-T. Pallidum)", unit: "", qualitative: true },
  { id: "sifilis_vdrl", name: "Sífilis VDRL (Cardiolipina)", unit: "", qualitative: true },
  { id: "toxoplasma_igg", name: "Toxoplasma IgG", unit: "UI/mL" },
  { id: "toxoplasma_igm", name: "Toxoplasma IgM", unit: "", qualitative: true },
  { id: "vzv_igg", name: "Varicella-Zoster IgG", unit: "mIU/mL" },
  { id: "vzv_igm", name: "Varicella-Zoster IgM", unit: "", qualitative: true },
  { id: "hsv_igm", name: "Herpes Simplex 1+2 IgM", unit: "", qualitative: true },
  { id: "hsv1_igg", name: "Herpes Simplex 1 IgG", unit: "", qualitative: true },
  { id: "hsv2_igg", name: "Herpes Simplex 2 IgG", unit: "", qualitative: true },
  { id: "eletroforese_albumina", name: "Albumina (eletroforese)", unit: "%" },
  { id: "eletroforese_alfa1", name: "Alfa 1 (eletroforese)", unit: "%" },
  { id: "eletroforese_alfa2", name: "Alfa 2 (eletroforese)", unit: "%" },
  { id: "eletroforese_beta1", name: "Beta 1 (eletroforese)", unit: "%" },
  { id: "eletroforese_beta2", name: "Beta 2 (eletroforese)", unit: "%" },
  { id: "eletroforese_gama", name: "Gama (eletroforese)", unit: "%" },
  { id: "relacao_ag", name: "Relação A/G", unit: "" },
  // Marcadores Tumorais
  { id: "ca_19_9", name: "CA 19-9", unit: "U/mL" },
  { id: "ca_125", name: "CA-125", unit: "U/mL" },
  { id: "ca_72_4", name: "CA 72-4", unit: "U/mL" },
  { id: "ca_15_3", name: "CA 15-3", unit: "U/mL" },
  { id: "afp", name: "AFP (Alfafetoproteína)", unit: "ng/mL" },
  { id: "cea", name: "CEA (Antígeno Carcinoembrionário)", unit: "ng/mL" },
  // Qualitative markers - Urina Tipo 1
  { id: "urina_cor", name: "Cor (urina)", unit: "", qualitative: true },
  { id: "urina_aspecto", name: "Aspecto (urina)", unit: "", qualitative: true },
  { id: "urina_densidade", name: "Densidade (urina)", unit: "" },
  { id: "urina_ph", name: "pH Urinário", unit: "" },
  { id: "urina_proteinas", name: "Proteínas (urina)", unit: "", qualitative: true },
  { id: "urina_glicose", name: "Glicose (urina)", unit: "", qualitative: true },
  { id: "urina_hemoglobina", name: "Hemoglobina (urina)", unit: "", qualitative: true },
  { id: "urina_leucocitos", name: "Leucócitos (urina)", unit: "/campo", qualitative: true },
  { id: "urina_leucocitos_quant", name: "Leucócitos (urina quantitativo)", unit: "/mL" },
  { id: "urina_hemacias", name: "Hemácias (urina)", unit: "/campo", qualitative: true },
  { id: "urina_hemacias_quant", name: "Hemácias (urina quantitativo)", unit: "/mL" },
  { id: "urina_bacterias", name: "Bactérias (urina)", unit: "", qualitative: true },
  { id: "urina_celulas", name: "Células Epiteliais (urina)", unit: "", qualitative: true },
  { id: "urina_cilindros", name: "Cilindros (urina)", unit: "", qualitative: true },
  { id: "urina_cristais", name: "Cristais (urina)", unit: "", qualitative: true },
  { id: "urina_nitritos", name: "Nitritos (urina)", unit: "", qualitative: true },
  { id: "urina_bilirrubina", name: "Bilirrubina (urina)", unit: "", qualitative: true },
  { id: "urina_urobilinogenio", name: "Urobilinogênio (urina)", unit: "", qualitative: true },
  { id: "urina_cetona", name: "Cetonas (urina)", unit: "", qualitative: true },
  { id: "urina_muco", name: "Muco/Filamentos (urina)", unit: "", qualitative: true },
  { id: "urina_albumina", name: "Albumina (urina)", unit: "mg/L" },
  { id: "urina_creatinina", name: "Creatinina (urina)", unit: "mg/dL" },
  { id: "urina_acr", name: "Razão Albumina/Creatinina", unit: "mg/g" },
  // Qualitative markers - Coprológico
  { id: "copro_cor", name: "Cor (fezes)", unit: "", qualitative: true },
  { id: "copro_consistencia", name: "Consistência (fezes)", unit: "", qualitative: true },
  { id: "copro_muco", name: "Muco (fezes)", unit: "", qualitative: true },
  { id: "copro_sangue", name: "Sangue Oculto (fezes)", unit: "", qualitative: true },
  { id: "copro_leucocitos", name: "Leucócitos (fezes)", unit: "", qualitative: true },
  { id: "copro_hemacias", name: "Hemácias (fezes)", unit: "", qualitative: true },
  { id: "copro_parasitas", name: "Parasitas (fezes)", unit: "", qualitative: true },
  { id: "copro_gordura", name: "Gordura Fecal", unit: "", qualitative: true },
  { id: "copro_gordura_quant", name: "Gordura Fecal (%)", unit: "%" },
  { id: "copro_fibras", name: "Fibras Musculares (fezes)", unit: "", qualitative: true },
  { id: "copro_amido", name: "Amido (fezes)", unit: "", qualitative: true },
  { id: "copro_residuos", name: "Resíduos Alimentares (fezes)", unit: "", qualitative: true },
  { id: "copro_ac_graxos", name: "Ácidos Graxos (fezes)", unit: "", qualitative: true },
  { id: "copro_flora", name: "Flora Bacteriana (fezes)", unit: "", qualitative: true },
  { id: "copro_ph", name: "pH Fecal", unit: "" },
  // PSA
  { id: "psa_total", name: "PSA Total", unit: "ng/mL" },
  { id: "psa_livre", name: "PSA Livre", unit: "ng/mL" },
  { id: "psa_relacao", name: "PSA Livre/Total", unit: "%" },
  // Glicemia Média Estimada
  { id: "glicemia_media_estimada", name: "Glicemia Média Estimada", unit: "mg/dL" },
];

const QUALITATIVE_IDS = new Set(MARKER_LIST.filter(m => (m as any).qualitative).map(m => m.id));

const systemPrompt = `You are an expert lab result extraction assistant for Brazilian labs (Fleury, DASA, Hermes Pardini, Confiance, Einstein, Lavoisier, DB, Oswaldo Cruz, etc.).

Your task: extract ALL values (numeric AND qualitative) from the PDF text and map them to known marker IDs. Be EXHAUSTIVE.

CRITICAL ANTI-HALLUCINATION RULE: NEVER invent, fabricate, or assume results. Only extract a marker if it is EXPLICITLY PRESENT in the PDF text with a visible numeric or qualitative result clearly associated with it. If you are unsure whether a result exists in the document, do NOT include it. When in doubt, omit.

Known markers (id | name | unit):
${MARKER_LIST.map((m) => `${m.id} | ${m.name} | ${m.unit}`).join("\n")}

=== TEXT NORMALIZATION — APPLY BEFORE MATCHING ===
Before attempting to match any exam name:
1. Remove accents: á→a, é→e, ê→e, í→i, ó→o, ú→u, ã→a, õ→o, ç→c
2. Remove dots from abbreviations: A.C.T.H. → ACTH, V.P.M. → VPM, D.H.T. → DHT, V.H.S. → VHS
3. Replace Greek letters: α→ALFA, β→BETA, γ→GAMA
4. Ignore everything after comma or dash in exam names for matching: "FIBRINOGÊNIO, plasma" → match on "FIBRINOGÊNIO"; "FIBRINOGÊNIO - CLAUSS" → match on "FIBRINOGÊNIO"
5. Normalize hyphens/spaces: treat hyphens, en-dashes, em-dashes, and spaces as equivalent

=== PANEL/SUB-ITEM EXTRACTION (CRITICAL!) ===
Many exams are grouped under panels. You MUST extract EACH sub-item individually:

HEMOGRAMA panel → extract ALL: hemoglobina, hematocrito, eritrocitos, vcm, hcm, chcm, rdw, leucocitos, neutrofilos, bastonetes, segmentados, linfocitos, monocitos, eosinofilos, basofilos, plaquetas, vpm
- "Bastões" = "Bastonetes" = bastonetes
- "Segmentados" = segmentados (NOT neutrofilos total)
- VPM/MPV/V.P.M. = vpm (in plaquetograma section)

PERFIL LIPÍDICO panel → extract ALL: colesterol_total, hdl, ldl, vldl, triglicerides, colesterol_nao_hdl
BILIRRUBINAS panel → extract ALL THREE: bilirrubina_total, bilirrubina_direta, bilirrubina_indireta
PERFIL DE FERRO panel → extract ALL: ferro_serico, ferritina, transferrina, sat_transferrina, tibc, fixacao_latente_ferro
METABOLISMO DO FERRO panel (Fleury) → CRITICAL DISAMBIGUATION:
   - When "Ferro" appears INSIDE a section titled "Metabolismo do Ferro" → ferro_metabolismo (NOT ferro_serico)
   - When "Ferro" appears as a standalone exam (outside Metabolismo do Ferro section) → ferro_serico
   - Both can exist in the same PDF with DIFFERENT values — extract BOTH
ELETROFORESE DE PROTEÍNAS panel → extract ALL fractions: eletroforese_albumina, eletroforese_alfa1, eletroforese_alfa2, eletroforese_beta1, eletroforese_beta2, eletroforese_gama, relacao_ag
URINA TIPO 1 / EAS panel → extract ALL sub-items as qualitative
COPROLÓGICO / COPROGRAMA panel → extract ALL sub-items as qualitative

=== DISAMBIGUATION RULES (CRITICAL — DO NOT CONFUSE!) ===

1. Lipoproteína(a) vs Apolipoproteína A-1:
   - If name contains "APO" or "APOLIPOPROTE" → apo_a1 (unit: mg/dL)
   - If name is "LIPOPROTEÍNA(a)" or "Lp(a)" or "LPA" without "APO" → lipoproteina_a (unit: nmol/L)
   - These are COMPLETELY DIFFERENT tests!

2. Vitamina D — TWO separate markers:
   - "25-OH" / "25-HIDROXI" / "CALCIDIOL" → vitamina_d (ng/mL, storage form)
   - "1,25" / "1.25" / "CALCITRIOL" / "DIHIDROXI" → vitamina_d_125 (pg/mL, active form, 1000x smaller)
   - NEVER map both to the same marker!

3. Cortisol — TWO separate markers:
   - Blood/serum/morning → cortisol
   - "URINA 24H" / "URINA DE 24 HORAS" → cortisol_livre_urina
   - Check material type!

4. Albumina — TWO contexts:
   - Standalone "Albumina" → albumina (g/dL, hepatic)
   - Within "ELETROFORESE" section → eletroforese_albumina (%, protein electrophoresis)

5. Amilase:
   - "AMILASE" / "AMILASE TOTAL" / "AMILASE SÉRICA" / "α-AMILASE" / "ALFA-AMILASE" → amilase
   - "AMILASE PANCREÁTICA" → also map to amilase (close enough)

6. T3 Livre vs T3 Total:
   - "T3 Livre" / "T3L" / "Triiodotironina Livre" → t3_livre (unit: ng/dL)
   - "T3 Total" / "Triiodotironina Total" → t3_total (unit: ng/dL)

7. T4 Livre vs T4 Total:
   - "T4 Livre" / "T4L" / "Tiroxina Livre" → t4_livre (unit: ng/dL)
   - "T4 Total" / "Tiroxina Total" → t4_total (unit: µg/dL)

=== OPERATOR HANDLING (CRITICAL — "<" and ">" VALUES) ===
Many results come with comparison operators like "< 34", "< 1.0", "> 90".
These are CRITICAL to preserve — they indicate values below/above detection limits.

When you encounter a value with an operator:
1. EXTRACT the numeric part as "value"
2. ALSO set "text_value" to the FULL string including operator: e.g. "< 34", "< 1.0", "> 90"
3. Examples:
   - Anti-TPO: "< 34" → { marker_id: "anti_tpo", value: 34, text_value: "< 34" }
   - TRAb: "< 1.0" → { marker_id: "trab", value: 1.0, text_value: "< 1.0" }
   - Anti-TG: "< 1.3" → { marker_id: "anti_tg", value: 1.3, text_value: "< 1.3" }
   - Calcitonina: "< 1.0" → { marker_id: "calcitonina", value: 1.0, text_value: "< 1.0" }
   - CA 72-4: "< 2.5" → { marker_id: "ca_72_4", value: 2.5, text_value: "< 2.5" }
   - "Inferior a 10" → { value: 10, text_value: "< 10" }
   - "Superior a 90" → { value: 90, text_value: "> 90" }

=== COMPREHENSIVE NAME ALIASES ===

HEMOGRAMA:
- "Hemácias" / "Glóbulos Vermelhos" / "ERITROGRAMA" / "Contagem de Hemácias" / "HEMÁCIAS (ERITRÓCITOS)" / "RBC" → eritrocitos
- "Glóbulos Brancos" / "LEUCOGRAMA" / "WBC" / "Contagem de Leucócitos" / "SÉRIE BRANCA" → leucocitos
- "Neutrófilos Totais" / "NEUT" / "NEUTRÓFILOS (%)" → neutrofilos (use % value, NOT absolute)
- "Segmentados" / "Neutrófilos Segmentados" / "SEGS" → segmentados
- "Bastonetes" / "Bastões" / "BASTOES" / "Neutrófilos Bastonetes" / "BAND" / "STAB" → bastonetes
- "LINF" / "LYMPH" / "LINFÓCITOS (%)" → linfocitos
- "MONO" / "MONÓCITOS (%)" → monocitos
- "EOS" / "EOSINÓFILOS (%)" → eosinofilos
- "BASO" / "BASÓFILOS (%)" → basofilos
⚠️ LEUCOGRAM DIFFERENTIALS RULE (neutrofilos, linfocitos, monocitos, eosinofilos, basofilos, segmentados, bastonetes):
  - value: ALWAYS use the PERCENTAGE value (e.g. 35.0, not 1526)
  - unit: always "%"
  - lab_ref_range: use ONLY the percentage reference interval (e.g. "45,0 a 70,0"), NEVER the absolute count (/mm³ or /µL)
  - If the lab shows both % and absolute count columns, use ONLY the % column for both value and lab_ref_range
  - If only absolute count reference is available, set lab_ref_range to null/empty
- "PLAQUETOGRAMA" / "PLT" / "TROMBÓCITOS" / "Contagem de Plaquetas" → plaquetas
- "VPM" / "V.P.M." / "MPV" / "Volume Plaquetário Médio" / "MEAN PLATELET VOLUME" → vpm

COAGULAÇÃO:
- "FIBRINOGÊNIO" / "FIBRINOGENIO" / "FIBRINOGÊNIO FUNCIONAL" / "FIBRINOGÊNIO - CLAUSS" / "FIBRINOGÊNIO DERIVADO" / "Fator I" / "FIBRINOGÊNIO, PLASMA" / "FIBRINOGÊNIO CLAUSS" / "FIBRINOGÊNIO POR CLAUSS" → fibrinogenio
  Units: mg/dL. If g/L → ×100.
- "DÍMEROS D" / "D-DÍMERO" / "D-Dímero" / "D-DÍMEROS" / "DÍMERO D" / "FRAGMENTO D" → dimeros_d

PANCREÁTICOS:
- "AMILASE" / "α-AMILASE" / "ALFA-AMILASE" / "AMS" / "AMILASE PANCREÁTICA" → amilase
- "LIPASE" / "LPS" / "LIPASE SÉRICA" → lipase

LIPÍDIOS:
- "Colesterol HDL" / "HDL-Colesterol" / "HDL-C" / "COLESTEROL HDL DIRETO" → hdl
- "Colesterol LDL" / "LDL-Colesterol" / "LDL-C" / "COLESTEROL LDL CALCULADO" / "LDL (FRIEDEWALD)" → ldl
- "Colesterol não-HDL" / "NÃO-HDL" / "NÃO HDL" / "NON-HDL" → colesterol_nao_hdl
- "COLESTEROL, SORO" / "COLESTEROL SÉRICO" / "Colesterol Total" → colesterol_total
- "VLDL-C" / "COLESTEROL VLDL" / "VLDL" → vldl
- "TRIGLICÉRIDES" / "TRIGLICERÍDIOS" / "TG" / "TRIGLICERIDES, SORO" / "Triglicerídeos" → triglicerides
- "APOLIPOPROTEÍNA A-1" / "APO A1" / "APO A-1" / "APO A-I" / "APO A" / "APOPROTEÍNA A1" → apo_a1
- "APOLIPOPROTEÍNA B" / "APO B" / "APO B100" / "APO B-100" → apo_b
- "LIPOPROTEINA(a)" / "Lp(a)" / "LP(A)" / "LPA" / "LIPOPROTEÍNA (a) QUANTITATIVA" / "Lp(a) massa" → lipoproteina_a
  Units: nmol/L. If mg/dL → ×2.15.
- "CT/HDL" / "Índice de Castelli" → relacao_ct_hdl
- "TG/HDL" → relacao_tg_hdl
- "ApoB/ApoA1" / "Razão ApoB/ApoA1" / "Relação ApoB/ApoA-I" / "Apo B/Apo A1" / "Relação Apolipoproteína B / Apolipoproteína A-I" → relacao_apob_apoa1

TIREOIDE:
- "TSH Ultra-sensível" / "TSH ULTRASSENSÍVEL" / "Tirotropina" / "TIREOTROPINA" / "TSH" / "TSH 3a GERAÇÃO" / "TSH, SORO" / "HORMÔNIO TIROESTIMULANTE" / "HORMONIO TIROESTIMULANTE" / "TIROESTIMULANTE" / "HORMÔNIO TIROESTIMULANTE (TSH)" / "HORMONIO TIROESTIMULANTE (TSH)" → tsh
- "T4L" / "Tiroxina Livre" / "T4 LIVRE" / "TIROXINA LIVRE (T4L)" / "FT4" / "FREE T4" → t4_livre
- "T4 Total" / "Tiroxina Total" / "Tiroxina (T4) - Total" / "TIROXINA (T4) - TOTAL" / "TT4" / "TIROXINA (T4)" / "TIROXINA (T4), SORO" → t4_total
    ⚠️ "TIROXINA (T4)" without "LIVRE" = T4 Total. "TIROXINA (T4) LIVRE" = t4_livre!
- "T3L" / "Triiodotironina Livre" / "T3 LIVRE" / "TRIIODOTIRONINA LIVRE (T3L)" / "FT3" / "FREE T3" → t3_livre (unit: ng/dL — do NOT convert)
- "T3 Total" / "Triiodotironina Total" / "Triiodotironina (T3) - Total" / "TRIIODOTIRONINA (T3) - TOTAL" / "TT3" / "TRIIODOTIRONINA (T3)" / "TRIIODOTIRONINA (T3), SORO" → t3_total
    ⚠️ "TRIIODOTIRONINA (T3)" without "LIVRE" = T3 Total. "TRIIODOTIRONINA (T3) LIVRE" = t3_livre!
- "T3 Reverso" / "T3R" / "REVERSE T3" / "TRIIODOTIRONINA REVERSA" / "rT3" / "RT3" → t3_reverso
- "ANTICORPO ANTI TPO" / "Anti-TPO" / "ANTI TPO" / "ANTICORPOS ANTI-PEROXIDASE TIREOIDIANA" / "ANTI-PEROXIDASE" / "TPO-Ab" / "ATPO" / "ANTICORPOS ANTI-PEROXIDASE TIROIDIANA" / "ANTI-PEROXIDASE TIROIDIANA" → anti_tpo
- "ANTICORPOS ANTI TIREOGLOBULINA" / "Anti-TG" / "ANTICORPOS ANTI-TIREOGLOBULINA" / "ATG" / "TgAb" / "ANTI TIREOGLOBULINA" / "ANTITIROGLOBULINA" / "ANTICORPOS ANTITIROGLOBULINA" / "ANTI-TIROGLOBULINA" → anti_tg
- "TRAb" / "TRAB" / "Anticorpo Anti-Receptor de TSH" / "Anti-receptor de TSH" / "Anti receptor TSH" / "Anticorpos Anti Receptores de TSH" → trab

HORMÔNIOS:
- "Testosterona Total" / "TESTOSTERONA, SORO" / "TESTOSTERONA SÉRICA" → testosterona_total
- "Testosterona Livre" / "TESTOSTERONA LIVRE CALCULADA" / "TESTOSTERONA LIVRE, SORO" / "Testosterona Livre Calculada" / "FTE" → testosterona_livre (unit: ng/dL). If pmol/L → ÷34.7 (i.e., ×0.02882) to get ng/dL. Example: 15.3 pmol/L ÷ 34.7 = 0.441 ng/dL. IMPORTANT: always convert to ng/dL before returning, regardless of patient sex.
  ⚠️ Testosterona Livre has sex-specific references: Male ~5–21 ng/dL, Female ~0.1–0.5 ng/dL.
    If the patient value is > 5 ng/dL (male range) but the lab_ref_range max is ≤ 2.0 ng/dL (female range), the wrong sex reference was captured — set lab_ref_range to null.
- "Testosterona Biodisponível" / "TESTOSTERONA BIODISPONIVEL" / "Testosterona Biodisponível Calculada" → testosterona_biodisponivel (unit: ng/dL)
- "Estradiol" / "ESTRADIOL (E2)" / "17-BETA-ESTRADIOL" / "17β-ESTRADIOL" / "E2" → estradiol. If ng/dL → ×10 to get pg/mL.
- "Estrona" / "E1" / "Estrona (E1)" / "Estrona, soro" / "ESTRONA (E1)" → estrona
- "Progesterona" / "PROGESTERONA, SORO" / "P4" → progesterona. If ng/dL → ÷100 to get ng/mL.
- "DHEA-S" / "SDHEA" / "S-DHEA" / "Sulfato de Dehidroepiandrosterona" / "DHEA SULFATO" / "SULFATO DE DEIDROEPIANDROSTERONA" / "DEIDROEPIANDROSTERONA SULFATO" → dhea_s
- "Cortisol" / "CORTISOL MATINAL" / "CORTISOL SÉRICO" / "CORTISOL, SORO" / "CORTISOL BASAL" / "CORTISOL (8h)" / "CORTISOL MATUTINO" (blood) → cortisol
- "SHBG" / "Globulina Ligadora" / "S H B G" / "GLOBULINA LIGADORA DE HORMÔNIOS SEXUAIS" / "SEX HORMONE BINDING GLOBULIN" → shbg
- "FSH" / "HORMÔNIO FOLÍCULO ESTIMULANTE" / "HORMÔNIO FOLICULOESTIMULANTE" / "FOLITROPINA" → fsh
- "LH" / "HORMÔNIO LUTEINIZANTE" / "HORMÔNIO LUTEINIZANTE, SORO" / "LUTROPINA" → lh
- "Prolactina" / "PROLACTINA, SORO" / "PRL" → prolactina
- "AMH" / "Hormônio Anti-Mülleriano" / "Hormonio Anti-Mulleriano" / "Anti-Müllerian Hormone" / "HAM" / "HORMÔNIO ANTIMÜLLERIANO" / "HORMÔNIO ANTI MULLERIANO" → amh

EIXO GH:
- "IGF-1" / "IGF1" / "IGF I" / "IGF 1" / "SOMATOMEDINA C" / "SOMATOMEDINA-C" / "IGF 1- SOMATOMEDINA C" / "FATOR DE CRESCIMENTO INSULINA-SÍMILE" / "FATOR DE CRESCIMENTO INSULINO-SÍMILE TIPO 1" / "IGF-I" → igf1
  ⚠️ IGF-1 lab_ref_range is ALWAYS in ng/mL with values between 50 and 600. Labs often list reference by age group:
    Example: "20 a 29 anos: 127 a 424" / "30 a 39 anos: 88 a 400" / "40 a 44 anos: 71 a 382"
    In this format, capture ONLY the value interval (e.g. "71 a 382"), NEVER the age range ("40 a 44").
    If the extracted lab_ref_range max is < 50 (e.g. "40 a 44"), it is an age range — set lab_ref_range to null.
- "IGFBP-3" / "IGFBP3" / "IGF BP3" / "PROTEÍNA LIGADORA 3 DO IGF" / "PROTEINA LIGADORA DE IGF TIPO 3" / "IGFBP-3 PROTEÍNA LIGADORA -3 DO IGF" / "IGFBP-3 (PROTEÍNA LIGADORA -3 DO IGF)" / "PROTEÍNA TRANSPORTADORA 3 DO IGF" / "PROTEINA LIGADORA-3 DO FATOR DE CRESCIMENTO SIMILE A INSULINA" / "FATOR DE CRESCIMENTO SIMILE A INSULINA" / "PROTEINA LIGADORA-3 DO FATOR DE CRESCIMENTO" → igfbp3
  ⚠️ If in ng/mL → ÷1000 to get µg/mL. Example: 6120 ng/mL → 6.12 µg/mL.

EIXO ADRENAL:
- "ACTH" / "A.C.T.H." / "HORMÔNIO ADRENOCORTICOTRÓFICO" / "HORMÔNIO ADRENOCORTICOTRÓFICO A.C.T.H." / "CORTICOTROFINA" / "ADRENOCORTICOTREFINA" / "HORMÔNIO ADRENOCORTICOTRÓFICO (ACTH)" / "HORMÔNIO ADRENOCORTICOTRÓFICO, PLASMA" → acth
- "CORTISOL LIVRE, URINA DE 24 HORAS" / "CORTISOL LIVRE URINÁRIO" / "CORTISOL URINÁRIO" / "CORTISOL LIVRE - URINA 24H" / "CORTISOL, URINA" / "CLU" → cortisol_livre_urina
  ⚠️ Material is URINE not blood! mcg/24 HORAS = µg/24h.
- "ALDOSTERONA" / "ALDOSTERONA SÉRICA" / "ALDOSTERONA - SENTADO" / "ALDOSTERONA - DEITADO" / "ALDOSTERONA - EM PÉ" / "ALDOSTERONA, SORO" / "ALDOSTERONA PLASMÁTICA" → aldosterona
  Units: ng/dL. If pg/mL → ÷10.

ANDRÓGENOS:
- "DIHIDROTESTOSTERONA" / "DHT" / "D.H.T." / "5-ALFA-DIHIDROTESTOSTERONA" / "5α-DIHIDROTESTOSTERONA" / "DIIDROTESTOSTERONA" / "5α-DHT" / "5-ALFA-DHT" → dihidrotestosterona
  Units: pg/mL. If ng/dL → ×10.
- "ANDROSTENEDIONA" / "ANDROSTENEDIONA, SORO" / "DELTA 4 ANDROSTENEDIONA" / "Δ4-ANDROSTENEDIONA" / "4-ANDROSTENEDIONA" → androstenediona (ng/dL)

VITAMINAS:
- "25 HIDROXI VITAMINA D" / "25-OH" / "CALCIDIOL" / "25(OH)D" / "Vitamina D3" / "25-HIDROXIVITAMINA D" / "25-HIDROXI VITAMINA D3" / "VITAMINA D, 25-HIDROXI" / "25 OH VITAMINA D" → vitamina_d (ng/mL)
- "1,25 DIHIDROXI" / "1.25 DIHIDROXI" / "CALCITRIOL" / "1,25(OH)2D" / "1,25-DIHIDROXI-COLECALCIFEROL" / "1,25-DIHIDROXI VITAMINA D3" / "CALCITRIOL, SORO" / "1,25-DIHIDROXIVITAMINA D" / "DIHIDROXIVITAMINA D" / "1,25-DIHIDROXIVITAMINA D, SORO" → vitamina_d_125 (pg/mL)
- "Vitamina B12" / "CIANOCOBALAMINA" / "COBALAMINA" / "VITAMINA B12, SORO" → vitamina_b12. ng/L = pg/mL.
- "Ácido Fólico" / "Folato" / "ÁCIDO FÓLICO, SORO" / "FOLATO SÉRICO" / "VITAMINA B9" → acido_folico
- "Retinol" / "Vitamina A" / "RETINOL, SORO" / "RETINOL SÉRICO" / "VITAMINA A, SORO" → vitamina_a
- "Vitamina E" → vitamina_e
- "Ácido Ascórbico" / "Vitamina C" / "ÁCIDO ASCÓRBICO, PLASMA" / "VITAMINA C, SORO" / "ASCORBATO" → vitamina_c
- "Vitamina B6" → vitamina_b6
- "Vitamina B1" / "Tiamina" → vitamina_b1 ⚠️ ONLY if explicitly "B1" or "Tiamina" — NOT "B12", "B6", or other B vitamins
- "Homocisteína" / "HOMOCISTEÍNA, PLASMA" / "HOMOCISTEÍNA TOTAL" / "HCY" → homocisteina

MINERAIS:
- "Magnésio" / "MAGNÉSIO, SORO" / "MAGNÉSIO SÉRICO" / "Mg SÉRICO" → magnesio
- "Zinco" / "ZINCO, SORO" / "ZINCO SÉRICO" / "Zn" → zinco. If µg/mL → ×100 to get µg/dL.
- "Selênio" / "SELÊNIO, SORO" / "SELÊNIO SÉRICO" / "Se SÉRICO" → selenio
- "Cobre" → cobre
- "Manganês" → manganes
- "Cromo" / "CROMO, SORO" / "CROMO SÉRICO" / "Cr SÉRICO" → cromo
- "Iodo Urinário" → iodo_urinario

TOXICOLOGIA:
- "CHUMBO" / "PLUMBEMIA" / "Pb SANGUE" / "CHUMBO (Pb)" / "LEAD" / "CHUMBO SANGUE" / "DOSAGEM DE CHUMBO" → chumbo. If µg/L → ÷10 to get µg/dL.
- "MERCURIO" / "Mercúrio" / "MERCÚRIO, SANGUE" / "MERCÚRIO TOTAL" → mercurio. IMPORTANT: Do NOT extract "Hg" alone — it is too short and causes false positives (e.g. from "mmHg"). Only extract if the FULL word "Mercúrio" or "MERCURIO" appears as the marker name with an associated numeric result value.
- "CADMIO" / "Cádmio" / "CÁDMIO, SANGUE" → cadmio. Do NOT use "Cd" alone.
- "ALUMINIO" / "Alumínio" / "ALUMÍNIO, SORO" → aluminio. Do NOT use "Al" alone.
- "COBALTO" / "Cobalto" / "COBALTO, SORO" → cobalto (unit: µg/L). Do NOT use "Co" alone.
- "ARSENICO" / "Arsênico" / "ARSÊNICO" / "Dosagem de Arsênico" / "ARSÊNICO, URINA" → arsenico (unit: mcg/L). Do NOT use "As" alone. Use operator if "Inferior a X"
- "NIQUEL" / "Níquel" / "NÍQUEL" / "Dosagem de Níquel" / "NÍQUEL, SORO" → niquel (unit: µg/L). Do NOT use "Ni" alone.
IMPORTANT FOR TOXICOLOGY: Only extract toxicology markers when they appear as actual lab test results with a numeric value. Do NOT extract them from footnotes, disclaimers, reference lists, or lists of available tests. If a toxicology marker name appears only in a contextual/informational section without a clear numeric result, ignore it.
TOXICOLOGY HALLUCINATION WARNING: Toxicology markers (mercury/mercurio, aluminum/aluminio, cadmium/cadmio, lead/chumbo, arsenic/arsenico, nickel/niquel, cobalt/cobalto) are RARE in routine Brazilian lab exams. Only extract them if you see the EXACT full test name AND a clear numeric result value printed in the document. Do NOT hallucinate these markers based on their presence in the marker list. If the test was not ordered or not performed, it will not appear in the PDF.

HEPÁTICO:
- "AST" / "TGO" / "GOT" / "GOT/AST" / "TRANSAMINASE GLUTÂMICO OXALACÉTICA" / "ASPARTATO AMINOTRANSFERASE" / "AST/TGO" / "SGOT" → tgo_ast
- "ALT" / "TGP" / "GPT" / "GPT/ALT" / "TRANSAMINASE GLUTÂMICO PIRÚVICA" / "ALANINA AMINOTRANSFERASE" / "ALT/TGP" / "SGPT" → tgp_alt
- "Gama GT" / "γ-GT" / "GGT" / "Gama Glutamil" / "GAMA-GLUTAMILTRANSFERASE" / "GAMA-GLUTAMIL TRANSFERASE" / "γGT" / "G-GT" → ggt
- "Fosfatase Alcalina" / "FA" / "FOSFATASE ALCALINA, SORO" / "ALP" / "FAL" → fosfatase_alcalina
- "Bilirrubina Total" → bilirrubina_total
- "Bilirrubina Direta" / "Conjugada" → bilirrubina_direta
- "Bilirrubina Indireta" / "Não Conjugada" / "CALCULADA" → bilirrubina_indireta
- "Albumina" / "ALBUMINA, SORO" / "ALBUMINA SÉRICA" / "ALB" (standalone, not electrophoresis) → albumina
- "Proteínas Totais" → proteinas_totais
- "LDH" / "Desidrogenase Láctica" / "LACTATO DESIDROGENASE" / "DESIDROGENASE LÁTICA" / "LDH, SORO" → ldh

RENAL:
- "Creatinina" / "CREATININA, SORO" / "CREATININA SÉRICA" → creatinina
- "Ureia" / "UREIA, SORO" / "UREIA SÉRICA" / "BUN" → ureia
- "Ácido Úrico" / "ÁCIDO ÚRICO, SORO" / "URATO" → acido_urico
- "Clearance" / "Filtração Glomerular" / "CKD-EPI" / "TFG ESTIMADA" / "TFGe" / "eGFR" / "MDRD" / "TAXA DE FILTRAÇÃO GLOMERULAR ESTIMADA" / "TFGe CKD-EPI 2021" / "RITMO DE FILTRAÇÃO GLOMERULAR" / "RFG" / "GFR" → tfg
  Often appears as sub-item of creatinine.
- "Cistatina C" → cistatina_c

ELETRÓLITOS:
- "Sódio" / "SÓDIO, SORO" / "SÓDIO SÉRICO" / "Na" / "Na+" → sodio
- "Potássio" / "POTÁSSIO, SORO" / "POTÁSSIO SÉRICO" / "K" / "K+" → potassio
- "Cálcio Total" / "CÁLCIO, SORO" / "CÁLCIO SÉRICO" / "Ca" / "Ca TOTAL" → calcio_total
  ⚠️ Cálcio Total lab_ref_range is ALWAYS between 8.0 and 11.0 mg/dL. If the extracted lab_ref_range has max > 15 (e.g. "18 a 60"), it was captured from a nearby exam (e.g. PTH) — set lab_ref_range to null.
- "Cálcio Ionizável" / "Cálcio Iônico" / "Cálcio ionizado" / "CÁLCIO IONIZADO, SORO" / "Ca++" / "Ca2+" / "iCa" → calcio_ionico (mmol/L)
- "Fósforo" / "FÓSFORO, SORO" / "FÓSFORO SÉRICO" / "FOSFATO INORGÂNICO" / "Pi" / "FÓSFORO INORGÂNICO" / "FOSFORO INORGANICO" → fosforo
- "Cloro" / "CLORETO" → cloro
- "Bicarbonato" / "CO2 Total" → bicarbonato
- "PTH Intacto" / "Paratormônio" / "PARATORMÔNIO INTACTO" / "PTH INTACTO, SORO" / "PTHi" / "iPTH" / "PARATORMÔNIO MOLÉCULA INTACTA" / "PARATORMONIO" / "PARATORMÔNIO (PTH)" / "PARATORMONIO (PTH)" / "PARATORMÔNIO, MOLÉCULA INTACTA" / "PARATORMONIO (PTH), MOLECULA INTACTA" → pth
  ⚠️ PTH lab_ref_range is ALWAYS between 10 and 100 pg/mL. Labs often list reference by age group (e.g. "40 a 49 anos: 15 a 65").
    If the extracted lab_ref_range has min > 30 and max < 50 (e.g. "40 a 49"), it is an age range — set lab_ref_range to null.
- "Calcitonina" / "Calcitonina, soro" / "TIREOCALCITONINA" → calcitonina

FERRO:
- "Ferro Sérico" / "FERRO, SORO" / "Ferro (Fe)" / "FE SÉRICO" / "SIDEREMIA" (standalone exam) → ferro_serico
- "Ferro" INSIDE "Metabolismo do Ferro" panel section → ferro_metabolismo (DIFFERENT from ferro_serico!)
  ⚠️ CRITICAL: In Fleury PDFs, "Ferro" appears TWICE: once standalone (ferro_serico) and once inside the "Metabolismo do Ferro" panel (ferro_metabolismo). They can have DIFFERENT values. Extract BOTH.
- "Ferritina" / "FERRITINA SÉRICA" / "FERRITINA, SORO" → ferritina. microg/L = ng/mL.
- "Transferrina" / "TRANSFERRINA SÉRICA" / "TRANSFERRINA, SORO" → transferrina
- "Saturação de Transferrina" / "Índice de Saturação" / "ÍNDICE DE SATURAÇÃO DA TRANSFERRINA" / "IST" / "SATURAÇÃO DA TRANSFERRINA" → sat_transferrina
- "TIBC" / "Capacidade Total de Fixação do Ferro" / "CTFF" / "Capacidade Total de Ligação do Ferro" / "Capacidade Ferropéxica Total" / "CTLF" → tibc
  If µmol/L → ÷0.179.
- "Capacidade de Fixação Latente do Ferro" / "UIBC" / "Capacidade livre de fixação" / "CLFF" → fixacao_latente_ferro (NOT tibc)

GLICEMIA:
- "Glicose Jejum" / "GLICEMIA DE JEJUM" / "GLICEMIA" / "GLICOSE, PLASMA" / "GLICOSE, SORO" / "GLICOSE PLASMÁTICA" / "GLUCOSE" → glicose_jejum
- "HbA1c" / "HEMOGLOBINA GLICADA" / "HEMOGLOBINA GLICOSILADA" / "A1C" / "HB GLICADA" / "HEMOGLOBINA A1C" / "HEMOGLOBINA GLICOSILADA (HbA1c)" → hba1c
- "GLICEMIA MÉDIA ESTIMADA" / "Glicemia Média Estimada" / "eAG" / "Estimated Average Glucose" / "Glicose Média Estimada" / "GLICEMIA MEDIA ESTIMADA" → glicemia_media_estimada (unit: mg/dL). Often appears right below HbA1c in the same panel.
- "Insulina Jejum" / "INSULINA BASAL" / "INSULINA, SORO" / "INSULINA SÉRICA" / "INSULINEMIA" → insulina_jejum
- "HOMA-IR" / "ÍNDICE HOMA" / "HOMA" / "HOMA IR" / "HOMEOSTASIS MODEL ASSESSMENT" → homa_ir

INFLAMAÇÃO:
- "PCR ultra-sensível" / "PCR-us" / "Proteína C Reativa" / "hsCRP" / "PCR-AS" / "PROTEÍNA C REATIVA ULTRASSENSÍVEL" / "PROTEÍNA C REATIVA (ALTA SENSIBILIDADE)" / "PCR QUANTITATIVA" → pcr. If mg/dL → ×10 to get mg/L.
- "VHS" / "V.H.S." / "Velocidade de Hemossedimentação" / "VSG" / "ESR" / "VELOCIDADE DE SEDIMENTAÇÃO" / "Hemossedimentação" / "HEMOSSEDIMENTACAO" / "HEMOSSEDIMENTAÇÃO, SANGUE TOTAL" → vhs

IMUNOLOGIA:
- "FAN" / "FAN - FATOR ANTI-NÚCLEO" / "FATOR ANTINÚCLEO" / "ANA" / "FAN (HEP-2)" / "PESQUISA DE FAN" → fan
  QUALITATIVE! Use text_value. Set value=0.

MARCADORES TUMORAIS:
- "CA 19-9" / "CA 19.9" / "Antígeno CA 19-9" / "Antigeno Carboidrato 19-9" / "CA19-9" / "ANTÍGENO CARBOIDRATO 19.9" / "ANTÍGENO CA 19-9, SORO" → ca_19_9
- "CA-125" / "CA 125" / "Antígeno CA-125" / "Antigeno CA 125" / "ANTÍGENO DO CÂNCER 125" / "ANTÍGENO CA 125, SORO" → ca_125
- "CA 72-4" / "CA 72.4" / "Antígeno CA 72-4" / "CA72-4" / "ANTÍGENO ASSOCIADO A TUMOR 72-4" → ca_72_4
- "CA 15-3" / "CA 15.3" / "Antígeno CA 15-3" / "CA15-3" / "ANTÍGENO DO CÂNCER 15-3" → ca_15_3
- "AFP" / "Alfafetoproteína" / "Alfa-fetoproteína" / "Alfa Feto Proteína" / "Alpha-Fetoprotein" / "ALFA-1-FETOPROTEÍNA" / "α-FETOPROTEÍNA" / "ALFAFETOPROTEÍNA, SORO" → afp
- "CEA" / "Antígeno Carcinoembrionário" / "Antigeno Carcinoembrionario" / "Carcinoembryonic Antigen" / "ANTÍGENO CARCINOEMBRIOGÊNICO" / "CEA, SORO" → cea

ELETROFORESE DE PROTEÍNAS:
- Within the electrophoresis section, extract each fraction using % values:
  Albumina→eletroforese_albumina, Alfa-1→eletroforese_alfa1, Alfa-2→eletroforese_alfa2,
  Beta-1→eletroforese_beta1, Beta-2→eletroforese_beta2, Gamaglobulina→eletroforese_gama, A/G→relacao_ag
- CRITICAL: Expected % ranges for each fraction (use these to validate your extraction):
  eletroforese_albumina: 50–70% (ALWAYS the LARGEST value in the table)
  eletroforese_alfa1: 2–6%
  eletroforese_alfa2: 6–15%
  eletroforese_beta1: 3–9%
  eletroforese_beta2: 2–7%
  eletroforese_gama: 8–22%
  relacao_ag: 1.0–3.5 (ratio, not %)
- If the value you extracted for eletroforese_albumina is below 30%, you have the WRONG fraction. Re-read the table.
- Fleury format: two columns (% and g/dL) interleaved. The % column is the first numeric after the fraction name.

URINA TIPO 1 / EAS:
- "URINA TIPO 1" / "EAS" / "URINA ROTINA" / "PARCIAL DE URINA" / "URINÁLISE" / "URINA TIPO I" / "URINA TIPO I - JATO MEDIO" / "URINA TIPO I - JATO MÉDIO" → extract ALL sub-items as qualitative
- Sub-items: urina_cor, urina_aspecto, urina_densidade, urina_ph, urina_proteinas, urina_glicose, urina_hemoglobina, urina_leucocitos, urina_hemacias, urina_bacterias, urina_celulas, urina_cilindros, urina_cristais, urina_nitritos, urina_bilirrubina, urina_urobilinogenio, urina_cetona, urina_muco, urina_albumina, urina_creatinina
- urina_albumina: numeric value in mg/L (microalbuminuria section, e.g. 10 mg/L or 0.01 g/L → store as 10). If the value is in g/L (e.g. 0.01), multiply by 1000 to get mg/L. Do NOT confuse with serum albumin.
- urina_creatinina: numeric value in mg/dL from urine creatinine (e.g. 200 mg/dL). Do NOT confuse with serum creatinine.
- PSA: extract psa_total (ng/mL), psa_livre (ng/mL), and psa_relacao (% = PSA Livre/PSA Total × 100) when present.
- SEDIMENTO QUANTITATIVO section (Fleury): extract numeric /mL values:
  - "Leucócitos" with value in /mL → urina_leucocitos_quant (numeric, NOT qualitative)
  - "Hemácias" / "Eritrócitos" with value in /mL → urina_hemacias_quant (numeric, NOT qualitative)
  - These are DIFFERENT from the dipstick qualitative fields (urina_leucocitos, urina_hemacias)
- "Muco" / "Filamentos de Muco" / "Filamentos Mucóides" (in urina context) → urina_muco
- "Corpos Cetônicos" / "Cetonas" / "Acetona" → urina_cetona
- "Leucócito Esterase" / "Esterase Leucocitária" → urina_leucocitos
- "Sangue" / "Blood" (in urina fita context) → urina_hemoglobina
- ⚠️ "ERITRÓCITOS" inside urina section = urina_hemacias (NOT eritrocitos from hemograma!)
- ⚠️ "LEUCÓCITOS" inside urina section = urina_leucocitos (NOT leucocitos from hemograma!)
- ⚠️ In Fleury PDFs, all urina sub-items are inside ONE block, not separate exams. Extract EACH line.

COPROLÓGICO:
- "COPROLÓGICO FUNCIONAL" / "COPROGRAMA" / "EXAME DE FEZES" / "PROVA FUNCIONAL DAS FEZES" / "PARASITOLÓGICO DE FEZES" / "EPF" → extract ALL sub-items as qualitative
- Sub-items: copro_cor, copro_consistencia, copro_muco, copro_sangue, copro_leucocitos, copro_hemacias, copro_parasitas, copro_gordura, copro_fibras, copro_amido, copro_residuos, copro_ac_graxos, copro_flora, copro_ph
- "Resíduos Alimentares" / "Restos Alimentares" / "Resíduos Vegetais" → copro_residuos
- "Ácidos Graxos" / "Ácidos Gordurosos" → copro_ac_graxos
- "Flora Bacteriana" / "Flora Intestinal" → copro_flora
- "Hemácias" (in fezes context) / "Eritrócitos" (fezes) → copro_hemacias

=== EXTRACTION RULES ===
- Extract EVERY marker you can find. Be aggressive.
- Search ALL text from first to last line. Do NOT stop early.
- CRITICAL: Extract sub-items within grouped panels (hemograma, lipídios, bilirrubinas, ferro, eletroforese, urina, fezes).
- DO NOT extract from "LAUDO EVOLUTIVO" section (historical data). Only use individual result pages.
- Convert units as specified above.

=== BRAZILIAN NUMBER FORMAT (CRITICAL — DO NOT GET THIS WRONG!) ===
Brazilian labs use COMMA as decimal separator and PERIOD as thousands separator. You MUST parse correctly:

RULE 1: Comma followed by 1-2 digits at end = DECIMAL
  "1,01" → 1.01 | "6,12" → 6.12 | "0,31" → 0.31 | "4,65" → 4.65

RULE 2: Period followed by exactly 3 digits = THOUSANDS SEPARATOR (remove it)
  "4.650" → 4650 | "1.124" → 1124 | "6.560" → 6560

RULE 3: Period followed by 1-2 digits = DECIMAL (standard format)
  "0.07" → 0.07 | "3.1" → 3.1

RULE 4: Combined format "1.234,56" → 1234.56 (period=thousands, comma=decimal)

RULE 5: Context-aware validation — check if value makes sense for the marker:
  - Leucócitos: expect 1000-30000. If you get 4.65, it's probably 4650 (thousands separator was "4.650")
  - Progesterona: expect 0.1-40 ng/mL. If you get 101, it's probably 1.01 ("1,01" with comma decimal)
  - IGFBP-3: expect 1-15 µg/mL. If you get 6120, the lab reported in ng/mL (÷1000 → 6.12)
  - DHT: expect 5-2000 pg/mL. If you get 13 for female, check if it should be 130 ("130" or "13,0")
  - Plaquetas: expect 50-600 mil/µL. "336 mil/mm³" → 336.
  - Eritrócitos: expect 1-10 milhões/µL. "3,8 milhões" → 3.8.

CRITICAL: Do NOT set text_value for numeric markers unless they have an operator (< > <= >=). 
Only set text_value for: qualitative markers OR operator values.

=== LAB REFERENCE RANGE (lab_ref_text) — MANDATORY! ===
⚠️ THIS IS CRITICAL AND NON-OPTIONAL: For EVERY SINGLE marker you extract, you MUST ALSO capture the reference range printed in the lab report.
Set lab_ref_text to the EXACT text shown in the report for that marker's reference range.
You MUST set lab_ref_text for EVERY marker — DO NOT skip this field!
Examples:
- Hemoglobina feminino: lab_ref_text = "11.7 a 14.9"
- TSH: lab_ref_text = "0.27 a 4.20"
- Anti-TPO: lab_ref_text = "Inferior a 34"
- FAN: lab_ref_text = "Nao reagente"
- Glicose: lab_ref_text = "70 a 99"
- Leucócitos: lab_ref_text = "3.470 a 8.290"
- Eritrócitos feminino: lab_ref_text = "3,83 a 4,99"
- VPM: lab_ref_text = "9,2 a 12,6"
- Ferritina feminino: lab_ref_text = "15 a 149"
- Vitamina D: lab_ref_text = "Acima de 20"
If the lab shows sex-specific or age-specific ranges, use the one matching the patient (or the female range if unknown).
If no reference range is found for a marker, set lab_ref_text to "" (empty string) — but TRY HARD to find it.

- For T3 Livre: the standard unit is ng/dL. Do NOT convert. Most Brazilian labs report in ng/dL.
- CRITICAL: For values with operators ("<", ">", "<=", ">="): set BOTH "value" (numeric part) AND "text_value" (full string with operator).
- "Inferior a X" → value=X, text_value="< X"
- "Superior a X" → value=X, text_value="> X"
- "Inferior a X microgramas/L" → value=X, text_value="< X" (ignore the unit in text_value)
- "Superior a X ng/mL" → value=X, text_value="> X"
- For NUMERIC markers without operators: return number in 'value' ONLY. Do NOT set text_value.
- For QUALITATIVE markers (fan, urina_*, copro_*): return text in 'text_value', set value=0.
- If marker appears multiple times: use FIRST occurrence (actual result, not historical).
- mcg = µg = microg = microgramas. mcg/dL = µg/dL, mcg/L = µg/L = microg/L = microgramas/L. micromol/L = µmol/L.
- DO NOT filter by material type — extract from blood, urine, and stool sections.

=== DISAMBIGUATION RULES (Fleury-specific) ===

8. T4 Total vs T4 Livre (Fleury uses "TIROXINA (T4)" format):
   - "TIROXINA (T4) LIVRE" or "T4 LIVRE" or "T4L" or "FT4" → t4_livre
   - "TIROXINA (T4)" WITHOUT the word "LIVRE" or "FREE" → t4_total
   - Key rule: if name contains "LIVRE" or "FREE" → Livre; otherwise → Total

9. T3 Total vs T3 Livre (same pattern):
   - "TRIIODOTIRONINA (T3) LIVRE" or "T3 LIVRE" or "T3L" or "FT3" → t3_livre
   - "TRIIODOTIRONINA (T3)" WITHOUT the word "LIVRE" or "FREE" → t3_total
   - Key rule: if name contains "LIVRE" or "FREE" → Livre; otherwise → Total`;



// Normalize Portuguese operator text to standard format
function normalizeOperatorText(results: any[]): any[] {
  for (const r of results) {
    if (r.text_value && typeof r.text_value === "string") {
      const tv = r.text_value.trim();
      // "inferior a 34 U/mL" → "< 34"
      const inferiorMatch = tv.match(/^inferior\s+a\s+(\d+[.,]?\d*)/i);
      if (inferiorMatch) {
        const num = inferiorMatch[1].replace(",", ".");
        r.text_value = `< ${num}`;
        r.value = parseFloat(num);
        console.log(`Normalized operator for ${r.marker_id}: "${tv}" → "${r.text_value}"`);
        continue;
      }
      // "superior a 90" → "> 90"
      const superiorMatch = tv.match(/^superior\s+a\s+(\d+[.,]?\d*)/i);
      if (superiorMatch) {
        const num = superiorMatch[1].replace(",", ".");
        r.text_value = `> ${num}`;
        r.value = parseFloat(num);
        console.log(`Normalized operator for ${r.marker_id}: "${tv}" → "${r.text_value}"`);
        continue;
      }
    }
  }
  return results;
}

// Deduplicate markers: if same marker_id appears multiple times, prefer calculated value over operator
function deduplicateResults(results: any[]): any[] {
  const seen = new Map<string, any>();
  for (const r of results) {
    const existing = seen.get(r.marker_id);
    if (!existing) {
      seen.set(r.marker_id, r);
    } else {
      // Prefer non-operator value over operator value (e.g., TFG: 103 > "> 60")
      const existingHasOp = existing.text_value && /^[<>≤≥]=?\s*\d/.test(existing.text_value);
      const newHasOp = r.text_value && /^[<>≤≥]=?\s*\d/.test(r.text_value);
      if (existingHasOp && !newHasOp && typeof r.value === "number") {
        console.log(`Dedup ${r.marker_id}: replaced operator "${existing.text_value}" with calculated value ${r.value}`);
        seen.set(r.marker_id, r);
      }
      // Otherwise keep first occurrence
    }
  }
  const deduped = Array.from(seen.values());

  // Cross-deduplication: if both qualitative (urina_leucocitos) and quantitative (urina_leucocitos_quant)
  // exist with the same numeric value, remove the qualitative one to avoid showing duplicates.
  // The quantitative (/mL) is more precise and should take precedence.
  const crossPairs: [string, string][] = [
    ['urina_leucocitos', 'urina_leucocitos_quant'],
    ['urina_hemacias', 'urina_hemacias_quant'],
  ];
  const seenIds = new Set(deduped.map((r: any) => r.marker_id));
  for (const [qualId, quantId] of crossPairs) {
    if (seenIds.has(qualId) && seenIds.has(quantId)) {
      // Both exist — remove the qualitative one
      const idx = deduped.findIndex((r: any) => r.marker_id === qualId);
      if (idx !== -1) {
        console.log(`Cross-dedup: removed ${qualId} (duplicate of ${quantId})`);
        deduped.splice(idx, 1);
      }
    }
  }
  return deduped;
}

// Post-processing: validate values and fix common decimal/unit errors
function validateAndFixValues(results: any[], patientSex?: string): any[] {
  // Sanity ranges with auto-fix functions for common Brazilian decimal/unit errors
  // Sex-aware fix for testosterona_livre:
  // - Mulheres (F): max lab range is 0.68 ng/dL. Values > 1.0 are suspect pmol/L.
  // - Homens (M) ou desconhecido: valid range 3–24 ng/dL, only convert > 25.
  const testosteronaLivreFix = patientSex === 'F'
    ? (v: number) => v > 1.0 && v <= 700 ? v / 34.7 : v > 700 ? v / 1000 : v
    : (v: number) => v > 25.0 && v <= 700 ? v / 34.7 : v > 700 ? v / 1000 : (v > 1.5 && v <= 3.0) ? v / 34.7 : v;

  const sanityRanges: Record<string, { min: number; max: number; fix?: (v: number) => number; label?: string }> = {
    // Hemograma
    leucocitos: { min: 1000, max: 30000, fix: (v) => v < 100 ? v * 1000 : v < 1000 ? v * 1000 : v, label: "leucocitos ×1000" },
    eritrocitos: { min: 1, max: 10, fix: (v) => v > 1000 ? v / 1000000 : v > 10 ? v / 10 : v },
    plaquetas: { min: 50, max: 700, fix: (v) => v > 1000 ? v / 1000 : v },
    // Hormônios
    progesterona: { min: 0, max: 50, fix: (v) => v > 5 ? v / 100 : v > 50 ? v / 100 : v, label: "progesterona ng/dL→ng/mL" },
    estradiol: { min: 5, max: 5000, fix: (v) => v < 5 ? v * 10 : v > 5000 ? v / 10 : v, label: "estradiol ng/dL→pg/mL" },
    prolactina: { min: 0.5, max: 200, fix: (v) => v > 200 ? v / 100 : v },
    insulina_jejum: { min: 0.5, max: 100, fix: (v) => v > 100 ? v / 100 : v },
    // Eixo GH
    // IGFBP-3: expected µg/mL (0.5–15). Fleury reports in ng/mL (e.g. 6120 ng/mL = 6.12 µg/mL).
    // If value > 100 → divide by 1000 (ng/mL → µg/mL). If value > 15 but ≤ 100 → divide by 10.
    igfbp3: { min: 0.5, max: 15, fix: (v) => v > 100 ? v / 1000 : v > 15 ? v / 10 : v, label: "igfbp3 ng/mL→µg/mL" },
    igf1: { min: 20, max: 1000 },
    // Andrógenos
    dihidrotestosterona: { min: 5, max: 2000, fix: (v) => v < 5 ? v * 10 : v, label: "DHT ng/dL→pg/mL" },
    // Testosterona Livre: expected ng/dL.
    // Faixa funcional feminina: 0.10–0.50 ng/dL. Faixa funcional masculina: 5.0–21.0 ng/dL.
    // Se AI retornar pmol/L (ex: 2–70 pmol/L para mulheres, 170–2400 pmol/L para homens) → ÷34.7.
    // Se AI retornar pg/mL (ex: 1–20 pg/mL para mulheres, 50–700 pg/mL para homens) → ÷10.
    // Não converter valores já em ng/dL (0.01–25 ng/dL cobre ambos os sexos).
    // Testosterona Livre fix: valores > 1.5 ng/dL são suspeitos para mulheres (max normal é 1.07 ng/dL).
    // Se entre 1.5 e 700 → provavelmente pmol/L ÷ 34.7. Se > 700 → pg/mL ÷ 1000.
    // Nota: valores masculinos normais são 3-24 ng/dL, então não converter se 3 < v < 25.
    testosterona_livre: { min: 0.01, max: patientSex === 'F' ? 1.0 : 25.0, fix: testosteronaLivreFix, label: "testosterona_livre pmol→ng/dL (sex-aware)" },
    // Estrona: expected pg/mL (5–200). If AI returned ng/dL (~0.5–20) → ×10 to get pg/mL.
    estrona: { min: 5, max: 500, fix: (v) => v < 5 ? v * 10 : v, label: "estrona ng/dL→pg/mL" },
    // Tireoide
    tsh: { min: 0.01, max: 100 },
    t4_livre: { min: 0.1, max: 5 },
    // T3 Livre: expected ng/dL (faixa funcional 0.27–0.42 ng/dL).
    // Fleury reporta em pg/mL (~2.0–4.4 pg/mL). Conversão: 1 pg/mL = 0.1 ng/dL (pois 1 ng/dL = 10 pg/mL).
    // Se AI retornar pg/mL (>1.5) → ÷10 para ng/dL. Se pmol/L (>5) → ÷15.36 para ng/dL.
    t3_livre: { min: 0.15, max: 0.8, fix: (v) => v > 1.5 && v <= 10 ? v / 10 : v > 10 ? v / 15.36 : v, label: "t3_livre pg/mL→ng/dL" },
    t3_total: { min: 30, max: 300 },
    // Lipídios
    colesterol_total: { min: 50, max: 500 },
    hdl: { min: 10, max: 150 },
    ldl: { min: 10, max: 400 },
    triglicerides: { min: 20, max: 2000 },
    // Ferro
    ferritina: { min: 1, max: 2000, fix: (v) => v > 2000 ? v / 10 : v },
    ferro_serico: { min: 10, max: 500 },
    ferro_metabolismo: { min: 10, max: 500 },
    // Zinco: expected µg/dL (50–150). Fleury may report in µg/mL (0.8 µg/mL = 80 µg/dL) or mg/L (0.8 mg/L = 80 µg/dL).
    // If value < 5 → likely µg/mL or mg/L → ×100 to get µg/dL.
    zinco: { min: 40, max: 200, fix: (v) => v < 5 ? v * 100 : v, label: "zinco µg/mL→µg/dL" },
    // Vitaminas
    vitamina_d: { min: 3, max: 200 },
    vitamina_b12: { min: 50, max: 3000 },
    acido_folico: { min: 0.5, max: 50 },
    homocisteina: { min: 1, max: 50 },
    // Hepático
    albumina: { min: 1, max: 8 },
    bilirrubina_total: { min: 0.01, max: 20 },
    // Renal
    creatinina: { min: 0.1, max: 15 },
    acido_urico: { min: 0.5, max: 15 },
    ureia: { min: 5, max: 200 },
    // Eletrólitos
    calcio_total: { min: 5, max: 15 },
    calcio_ionico: { min: 0.5, max: 2.5 },
    sodio: { min: 100, max: 180 },
    potassio: { min: 2, max: 8 },
    fosforo: { min: 1, max: 10 },
    magnesio: { min: 0.5, max: 5 },
    // Inflação
    // PCR: esperado em mg/L (faixa funcional 0–1.0 mg/L).
    // Alguns labs reportam em mg/dL (ex: 0.12 mg/dL = 1.2 mg/L).
    // Se valor < 2 e unidade parece mg/dL (valores típicos 0.01–1.5 mg/dL) → ×10 para mg/L.
    // Limite: se valor < 2.0 → provavelmente mg/dL → ×10.
    pcr: { min: 0, max: 200, fix: (v) => v < 2.0 ? v * 10 : v, label: "pcr mg/dL→mg/L" },
    // Glicemia
    glicose_jejum: { min: 40, max: 500 },
    hba1c: { min: 3, max: 15 },
    // Coagulação
    fibrinogenio: { min: 50, max: 800 },
    // Cortisol
    cortisol: { min: 0.5, max: 50 },
    // Eletroforese de Proteínas: frações em % (valores fisiológicos)
    // Albumina: 50–70% — se < 30, provavelmente é outra fração (remover para evitar erro)
    eletroforese_albumina: { min: 30, max: 80 },
    eletroforese_alfa1:    { min: 1, max: 10 },
    eletroforese_alfa2:    { min: 4, max: 20 },
    eletroforese_beta1:    { min: 2, max: 12 },
    eletroforese_beta2:    { min: 1, max: 10 },
    eletroforese_gama:     { min: 5, max: 30 },
    relacao_ag:            { min: 0.8, max: 4.0 },
    // PSA
    psa_total:             { min: 0, max: 100 },
    psa_livre:             { min: 0, max: 20 },
    psa_relacao:           { min: 0, max: 100 },
    // Glicemia Média Estimada
    glicemia_media_estimada: { min: 50, max: 400 },
    // Urina quantitativos
    // urina_albumina: armazenado em mg/L (microalbuminúria). Fleury reporta em mg/L (0–300 mg/L).
    // Se AI retornar g/L (< 0.3) → ×1000 para mg/L.
    urina_albumina:        { min: 0, max: 300, fix: (v) => v < 1 ? v * 1000 : v, label: 'urina_albumina g/L→mg/L' },
    urina_creatinina:      { min: 10, max: 600 },
    // Densidade urinária: faixa normal 1.001–1.040
    // Nota: 1.02 e 1.020 são numericamente idênticos — nenhuma conversão necessária
    urina_densidade:       { min: 1.001, max: 1.040 },
    // pH urinário: faixa normal 4.5–8.5
    urina_ph:              { min: 4, max: 9 },
  };

  for (const r of results) {
    if (typeof r.value !== "number") continue;
    if (QUALITATIVE_IDS.has(r.marker_id)) continue;
    if (r.text_value && /^[<>≤≥]=?\s*\d/.test(r.text_value.trim())) continue; // legitimate operator, skip
    const range = sanityRanges[r.marker_id];
    if (!range || !range.fix) continue;
    if (r.value < range.min || r.value > range.max) {
      const original = r.value;
      r.value = range.fix(r.value);
      if (r.value < range.min * 0.3 || r.value > range.max * 3) {
        r.value = original; // revert — fix didn't help
      } else {
        console.log(`Fixed ${r.marker_id}: ${original} → ${r.value} (${range.label || 'decimal fix'})`);
      }
    }
  }

  // ── Deterministic unit conversion based on lab_ref_max ──
  // If the lab reference max indicates the source unit is ng/dL, convert value + refs
  const UNIT_CONVERSIONS: Record<string, { factor: number; detectSourceUnit: (refMax: number) => boolean; label: string }> = {
    estradiol:           { factor: 10,   detectSourceUnit: (max) => max > 0 && max < 100,  label: 'estradiol ng/dL→pg/mL' },
    progesterona:        { factor: 0.01, detectSourceUnit: (max) => max > 50,               label: 'progesterona ng/dL→ng/mL' },
    dihidrotestosterona: { factor: 10,   detectSourceUnit: (max) => max > 0 && max < 100,  label: 'DHT ng/dL→pg/mL' },
  };

  for (const r of results) {
    const conv = UNIT_CONVERSIONS[r.marker_id];
    if (!conv) continue;
    if (typeof r.value !== 'number') continue;
    
    const refMax = typeof r.lab_ref_max === 'number' ? r.lab_ref_max : null;
    if (refMax !== null && conv.detectSourceUnit(refMax)) {
      const origValue = r.value;
      r.value = parseFloat((r.value * conv.factor).toFixed(4));
      if (typeof r.lab_ref_min === 'number') {
        r.lab_ref_min = parseFloat((r.lab_ref_min * conv.factor).toFixed(4));
      }
      if (typeof r.lab_ref_max === 'number') {
        r.lab_ref_max = parseFloat((r.lab_ref_max * conv.factor).toFixed(4));
      }
      console.log(`DETERMINISTIC CONV ${conv.label}: value ${origValue}→${r.value}, ref_max ${refMax}→${r.lab_ref_max}`);
    }
  }

  // Round all numeric values to avoid floating point artifacts (e.g. 0.1270893371757925 → 0.1271)
  for (const r of results) {
    if (typeof r.value === 'number' && !QUALITATIVE_IDS.has(r.marker_id)) {
      // Determine appropriate decimal places based on magnitude
      if (r.value === 0) continue;
      const abs = Math.abs(r.value);
      let decimals: number;
      if (abs >= 100) decimals = 0;
      else if (abs >= 10) decimals = 1;
      else if (abs >= 1) decimals = 2;
      else if (abs >= 0.1) decimals = 3;
      else decimals = 4;
      r.value = parseFloat(r.value.toFixed(decimals));
    }
  }

  // Also strip text_value from numeric markers if AI incorrectly set it
  // (except for operator values)
  for (const r of results) {
    if (r.text_value && typeof r.value === "number" && !QUALITATIVE_IDS.has(r.marker_id)) {
      if (!/^[<>≤≥]=?\s*\d/.test(r.text_value.trim())) {
        console.log(`Stripped non-operator text_value from ${r.marker_id}: "${r.text_value}"`);
        delete r.text_value;
      }
    }
  }
  // === ANTI-ALUCINAÇÃO: urina_hemoglobina e urina_hemacias ===
  // Gemini sometimes copies hemoglobina/eritrocitos from hemograma into urina fields.
  // Urina hemoglobina is QUALITATIVE (negativo/positivo/traços) — never a numeric like 13.4.
  // Urina hemacias qualitative is /campo (0-50), quantitative is /mL (0-50000).
  for (const r of results) {
    // --- urina_hemoglobina ---
    if (r.marker_id === 'urina_hemoglobina') {
      // Case 1: numeric value > 5 → hemograma hallucination
      if (typeof r.value === 'number' && r.value > 5) {
        console.log(`ANTI-HALLUCINATION: removed urina_hemoglobina numeric ${r.value} (likely from hemograma)`);
        r._remove = true;
      }
      // Case 2: string containing 'g/dL' or 'milhões' or a reference range like '11,7 a 14,9'
      // These are hallucinations where Gemini returned the hemograma value as a string
      if (typeof r.value === 'string') {
        const v = r.value as string;
        if (
          /g\/dL/i.test(v) ||
          /milh[õo]es/i.test(v) ||
          /\d+[,.]\d+\s+a\s+\d+[,.]\d+/.test(v) ||
          /\d{2,}[,.]\d+/.test(v) // e.g. "13,4" — hemograma-like numeric string
        ) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemoglobina string "${v}" (likely from hemograma)`);
          r._remove = true;
        }
      }
    }
    // --- urina_hemacias ---
    if (r.marker_id === 'urina_hemacias') {
      // Case 1: numeric value > 100 → hemograma hallucination
      if (typeof r.value === 'number' && r.value > 100) {
        console.log(`ANTI-HALLUCINATION: removed urina_hemacias numeric ${r.value} (likely from hemograma)`);
        r._remove = true;
      }
      // Case 2: string containing 'milhões/mm³' or 'milhões/µL' or reference range
      if (typeof r.value === 'string') {
        const v = r.value as string;
        if (
          /milh[õo]es/i.test(v) ||
          /mm[³3]/i.test(v) ||
          /µL/i.test(v) ||
          /\d+[,.]\d+\s+a\s+\d+[,.]\d+/.test(v)
        ) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemacias string "${v}" (likely from hemograma)`);
          r._remove = true;
        }
      }
    }
  }

  // === LIMPEZA: urina_leucocitos, urina_hemacias e urina_hemoglobina qualitativo ===
  // Fleury imprime valor + referência na mesma linha:
  //   "15.900 /mL Até 25.000 /mL"  (leucócitos/hemácias quantitativos)
  //   "13,4 g/dL 11,7 a 14,9"      (hemoglobina — alucinação do hemograma)
  // Gemini captura o texto completo. Precisamos extrair apenas o valor qualitativo inicial.
  const URINA_QUALITATIVE_CLEANUP = new Set(['urina_leucocitos', 'urina_hemacias', 'urina_hemoglobina']);
  for (const r of results) {
    if (!URINA_QUALITATIVE_CLEANUP.has(r.marker_id)) continue;
    const tv: string | undefined = r.text_value;
    if (!tv || typeof tv !== 'string') continue;

    // Caso 1: text_value contém valor hemograma + unidade (ex: "13,4 g/dL 11,7 a 14,9")
    // Detectar padrão: número + g/dL ou milhões → alucinação do hemograma → remover
    if (/[\d.,]+\s*(?:g\/dL|milh[õo]es|mm[³3]|µL)/i.test(tv)) {
      console.log(`ANTI-HALLUCINATION: removed ${r.marker_id} text_value "${tv}" (hemograma hallucination)`);
      r._remove = true;
      continue;
    }

    // Caso 2: text_value contém número + referência (ex: "15.900 /mL Até 25.000 /mL", "1.000/mL inferior a 30.000/mL")
    // Extrai apenas a primeira parte (até o primeiro "Até", "inferior", "superior", "menor", "maior", "Ref", "<", ">" ou número grande)
    const cleanMatch = tv.match(/^(\d[\d.,]*)\s*(?:\/mL)?\s*(?:Até|até|inferior|superior|menor|maior|Ref|ref|<|>|\d{4,})/i);
    if (cleanMatch) {
      const cleanVal = cleanMatch[1].replace(/[.,](\d{3})$/g, '$1').replace(',', '.');
      const num = parseFloat(cleanVal);
      if (!isNaN(num) && num > 0) {
        r.text_value = `${Math.round(num)} /mL`;
        console.log(`Cleaned urina qualitative text_value for ${r.marker_id}: "${tv}" → "${r.text_value}"`);
      }
    }
    // Caso 3: text_value é um texto qualitativo válido (ex: "Negativo", "Positivo", "1+")
    // Não fazer nada — manter como está
  }

   return results.filter((r: any) => !r._remove);
}

/**
 * Converte a referência do laboratório (lab_ref_min/max) para a mesma unidade do valor armazenado.
 * Quando o valor foi convertido (ex: testosterona_livre de pmol/L para ng/dL),
 * a referência também precisa ser convertida para ser consistente.
 */
function convertLabRefUnits(results: any[]): any[] {
  // Mapeamento: marker_id → função de conversão da referência (mesma lógica do valor)
  const refConverters: Record<string, (min: number, max: number) => { min: number; max: number }> = {
    // Testosterona Livre: se referência está em pmol/L (> 2.0) → ÷ 34.7 para ng/dL
    testosterona_livre: (min, max) => ({
      min: min > 2.0 ? parseFloat((min / 34.7).toFixed(4)) : min,
      max: max > 2.0 ? parseFloat((max / 34.7).toFixed(4)) : max,
    }),
    // IGFBP-3: se referência está em ng/mL (> 100) → ÷ 1000 para µg/mL
    igfbp3: (min, max) => ({
      min: min > 100 ? parseFloat((min / 1000).toFixed(3)) : min > 15 ? parseFloat((min / 10).toFixed(3)) : min,
      max: max > 100 ? parseFloat((max / 1000).toFixed(3)) : max > 15 ? parseFloat((max / 10).toFixed(3)) : max,
    }),
    // Zinco: se referência está em µg/mL (< 5) → × 100 para µg/dL
    zinco: (min, max) => ({
      min: min < 5 ? parseFloat((min * 100).toFixed(1)) : min,
      max: max < 5 ? parseFloat((max * 100).toFixed(1)) : max,
    }),
    // T3 Livre: se referência está em pg/mL (> 1.5) → ÷ 10 para ng/dL
    t3_livre: (min, max) => ({
      min: min > 1.5 ? parseFloat((min / 10).toFixed(3)) : min,
      max: max > 1.5 ? parseFloat((max / 10).toFixed(3)) : max,
    }),
    // Glicemia Média Estimada: sem conversão necessária, mas garantir que lab_ref_text seja atualizado
    glicemia_media_estimada: (min, max) => ({ min, max }),
  };

  // Sanity check: marcadores em % (diferenciais do leucograma) sempre vêm com referência
  // laboratorial em valores absolutos (/mm³) no PDF. Como o app armazena esses marcadores
  // como percentuais, a referência do laboratório nunca é compatível — sempre descartar.
  // Exemplos: Neutrófilos 35% com ref "1.526 a 5.020" (/mm³), Basófilos 1.3% com ref "10 a 80" (/mm³)
  const percentOnlyMarkers = new Set([
    'neutrofilos', 'linfocitos', 'monocitos', 'eosinofilos', 'basofilos',
  ]);
  for (const r of results) {
    if (percentOnlyMarkers.has(r.marker_id) && (r.lab_ref_min != null || r.lab_ref_max != null)) {
      console.log(`Discarding absolute-unit lab_ref for percent marker ${r.marker_id}: ${r.lab_ref_min}-${r.lab_ref_max} (text: ${r.lab_ref_text})`);
      r.lab_ref_min = null;
      r.lab_ref_max = null;
      r.lab_ref_text = '';
    }
  }
  // Bug 7 — Diferenciais do leucograma em valor absoluto (/mm³) em vez de percentual (%).
  // Alguns laudos (ex: Fleury) apresentam tanto % quanto /mm³ para neutrófilos, linfócitos, etc.
  // O Gemini às vezes extrai o valor absoluto em vez do percentual.
  // Fix: se o valor for > 100 para um marcador percentual, converter usando leucócitos totais.
  // Fórmula: % = (absoluto / leucocitos_total) * 100
  // Marcadores afetados: neutrofilos, linfocitos, monocitos, eosinofilos, basofilos, segmentados, bastonetes
  const percentDifferentials = new Set([
    'neutrofilos', 'linfocitos', 'monocitos', 'eosinofilos', 'basofilos', 'segmentados', 'bastonetes',
  ]);
  const leucocitosResult = results.find((r: any) => r.marker_id === 'leucocitos');
  const leucocitosTotal = leucocitosResult ? leucocitosResult.value : null;
  for (const r of results) {
    if (percentDifferentials.has(r.marker_id) && typeof r.value === 'number' && r.value > 100) {
      if (leucocitosTotal && leucocitosTotal > 0) {
        // Converter valor absoluto para percentual
        const pct = parseFloat(((r.value / leucocitosTotal) * 100).toFixed(1));
        console.log(`[leucogram-fix] Converting ${r.marker_id} absolute ${r.value} /mm³ → ${pct}% (leucocitos=${leucocitosTotal})`);
        r.value = pct;
        r.unit = '%';
      } else {
        // Sem leucócitos totais, remover o marcador (valor absoluto não pode ser usado como %)
        console.log(`[leucogram-fix] Removing ${r.marker_id} absolute ${r.value} /mm³ (no leucocitos total available)`);
        r._remove = true;
      }
    }
  }

  // Bug 1 — Cálcio Total: ref absurda (ex: "18 a 60") capturada do PTH próximo no laudo.
  // Cálcio Total normal: 8.0–11.0 mg/dL. Se max > 15, descartar.
  for (const r of results) {
    if (r.marker_id === 'calcio_total' && typeof r.lab_ref_max === 'number' && r.lab_ref_max > 15) {
      console.log(`Discarding out-of-range lab_ref for calcio_total: ${r.lab_ref_min}-${r.lab_ref_max} (likely captured from PTH)`);
      r.lab_ref_min = null;
      r.lab_ref_max = null;
      r.lab_ref_text = '';
    }
  }

  // Bug 2a — AMH: ref capturando faixa etária (ex: "35 a 39") em vez do intervalo de valores.
  // AMH ref de valor: sempre entre 0.01 e 15 ng/mL. Se max > 10, é faixa etária — descartar.
  for (const r of results) {
    if (r.marker_id === 'amh' && typeof r.lab_ref_max === 'number' && r.lab_ref_max > 10) {
      console.log(`Discarding age-range lab_ref for amh: ${r.lab_ref_min}-${r.lab_ref_max} (age range, not value range)`);
      r.lab_ref_min = null;
      r.lab_ref_max = null;
      r.lab_ref_text = '';
    }
  }

  // Bug 2b — IGF-1: ref capturando faixa etária (ex: "40 a 44") em vez do intervalo de valores.
  // IGF-1 ref de valor: sempre entre 50 e 600 ng/mL. Se max < 50, é faixa etária — descartar.
  for (const r of results) {
    if (r.marker_id === 'igf1' && typeof r.lab_ref_max === 'number' && r.lab_ref_max < 50) {
      console.log(`Discarding age-range lab_ref for igf1: ${r.lab_ref_min}-${r.lab_ref_max} (age range, not value range)`);
      r.lab_ref_min = null;
      r.lab_ref_max = null;
      r.lab_ref_text = '';
    }
  }

  // Bug 4 — PTH: ref capturando faixa etária (ex: "40 a 49") em vez do intervalo de valores.
  // PTH ref de valor: sempre entre 10 e 100 pg/mL. Se max < 50 e min > 30, é faixa etária — descartar.
  for (const r of results) {
    if (r.marker_id === 'pth'
      && typeof r.lab_ref_max === 'number'
      && typeof r.lab_ref_min === 'number'
      && r.lab_ref_max < 50 && r.lab_ref_min > 30) {
      console.log(`Discarding age-range lab_ref for pth: ${r.lab_ref_min}-${r.lab_ref_max} (age range, not value range)`);
      r.lab_ref_min = null;
      r.lab_ref_max = null;
      r.lab_ref_text = '';
    }
  }

  // Bug 3 — Testosterona Livre: ref feminina capturada para paciente masculino.
  // Detectado pelo cruzamento valor x ref: se valor > 5 ng/dL (masculino) mas ref max ≤ 2.0 ng/dL (feminino).
  for (const r of results) {
    if (r.marker_id === 'testosterona_livre'
      && typeof r.value === 'number' && r.value > 5
      && typeof r.lab_ref_max === 'number' && r.lab_ref_max <= 2.0) {
      console.log(`Discarding female lab_ref for testosterona_livre: value=${r.value} ng/dL (male) but ref max=${r.lab_ref_max} ng/dL (female)`);
      r.lab_ref_min = null;
      r.lab_ref_max = null;
      r.lab_ref_text = '';
    }
  }

  // Bug 5 — Leucócitos: bug de milhar com ponto decimal (ex: "3.470 a 8.290" → 3.47 e 8.29 em vez de 3470 e 8290).
  // Leucócitos são sempre >1000 /µL. Se ref_max < 100, multiplicar por 1000.
  for (const r of results) {
    if (r.marker_id === 'leucocitos'
      && typeof r.lab_ref_max === 'number' && r.lab_ref_max < 100) {
      console.log(`[leucocitos] Fixing thousands separator bug: ref [${r.lab_ref_min}, ${r.lab_ref_max}] → [${(r.lab_ref_min ?? 0) * 1000}, ${r.lab_ref_max * 1000}]`);
      if (typeof r.lab_ref_min === 'number') r.lab_ref_min = Math.round(r.lab_ref_min * 1000);
      r.lab_ref_max = Math.round(r.lab_ref_max * 1000);
    }
  }

  // Bug 6 — HbA1c: ref capturando faixa de pré-diabetes (5.7–6.4%) em vez do range normal (4.0–5.6%).
  // O laudo exibe a faixa de pré-diabetes como referência, mas o range normal é < 5.7%.
  // Se ref_min >= 5.0 e ref_max <= 7.0, é a faixa de pré-diabetes — descartar.
  for (const r of results) {
    if (r.marker_id === 'hba1c'
      && typeof r.lab_ref_min === 'number' && r.lab_ref_min >= 5.0
      && typeof r.lab_ref_max === 'number' && r.lab_ref_max <= 7.0) {
      console.log(`Discarding pre-diabetes lab_ref for hba1c: ${r.lab_ref_min}-${r.lab_ref_max} (pre-diabetes range, not normal range)`);
      r.lab_ref_min = null;
      r.lab_ref_max = null;
      r.lab_ref_text = '';
    }
  }

  // Filtro: descartar lab_ref_text que são cabeçalhos de faixa etária
  // Ex: "Maior ou igual a 20 anos:", "Até 49 anos", "maior que 2 anos: até 32 U/L"
  // Esses textos não contêm valores de referência numéricos — são apenas rótulos de tabela
  const ageHeaderPatterns = [
    /maior ou igual a \d+ anos/i,
    /^até \d+ anos/i,
    /^de \d+ a \d+ anos/i,
    /^\d+ a \d+ anos:/i,
    /^maior que \d+ anos:/i,
  ];
  for (const r of results) {
    if (r.lab_ref_text && ageHeaderPatterns.some((p: RegExp) => p.test(r.lab_ref_text as string))) {
      // Verificar se o texto NÃO contém valores numéricos de referência além da faixa etária
      const textWithoutAge = (r.lab_ref_text as string).replace(/\d+\s*anos?/gi, '').trim();
      const hasValueRange = /\d+[,.]?\d*\s*(a|até|-)\s*\d+[,.]?\d*/.test(textWithoutAge);
      if (!hasValueRange) {
        console.log(`[age-header] Discarding age-header lab_ref_text for ${r.marker_id}: "${r.lab_ref_text}"`);
        r.lab_ref_text = '';
        r.lab_ref_min = null;
        r.lab_ref_max = null;
      }
    }
  }

  // Bug genérico — Sanity bounds: comparar lab_ref extraída com sanityRanges esperados.
  // Se a referência extraída estiver mais de 20x fora do range esperado, descartar.
  // Isso protege contra casos não cobertos pelas regras específicas acima.
  const labRefSanityRanges: Record<string, { min: number; max: number }> = {
    hemoglobina:          { min: 8, max: 20 },
    hematocrito:          { min: 25, max: 60 },
    eritrocitos:          { min: 2, max: 8 },
    vcm:                  { min: 50, max: 120 },
    hcm:                  { min: 15, max: 45 },
    chcm:                 { min: 25, max: 40 },
    rdw:                  { min: 8, max: 20 },
    leucocitos:           { min: 1000, max: 20000 },
    plaquetas:            { min: 50, max: 700 },
    vpm:                  { min: 5, max: 15 },
    glicose_jejum:        { min: 40, max: 500 },
    hba1c:                { min: 3, max: 15 },
    insulina_jejum:       { min: 0.5, max: 100 },
    colesterol_total:     { min: 50, max: 500 },
    hdl:                  { min: 10, max: 150 },
    ldl:                  { min: 10, max: 400 },
    triglicerides:        { min: 20, max: 2000 },
    tsh:                  { min: 0.01, max: 100 },
    t4_livre:             { min: 0.1, max: 5 },
    t3_livre:             { min: 0.1, max: 1.0 },
    t3_total:             { min: 30, max: 300 },
    testosterona_total:   { min: 1, max: 1500 },
    testosterona_livre:   { min: 0.01, max: 30 },
    estradiol:            { min: 5, max: 5000 },
    progesterona:         { min: 0, max: 50 },
    dhea_s:               { min: 10, max: 600 },
    cortisol:             { min: 1, max: 50 },
    igf1:                 { min: 50, max: 600 },
    vitamina_d:           { min: 3, max: 200 },
    vitamina_b12:         { min: 50, max: 3000 },
    ferritina:            { min: 1, max: 2000 },
    ferro_serico:         { min: 10, max: 500 },
    calcio_total:         { min: 5, max: 15 },
    magnesio:             { min: 0.5, max: 5 },
    sodio:                { min: 100, max: 180 },
    potassio:             { min: 2, max: 8 },
    creatinina:           { min: 0.1, max: 15 },
    ureia:                { min: 5, max: 200 },
    acido_urico:          { min: 0.5, max: 15 },
    albumina:             { min: 1, max: 8 },
    pcr:                  { min: 0, max: 200 },
    homocisteina:         { min: 1, max: 50 },
    zinco:                { min: 40, max: 200 },
  };
  for (const r of results) {
    const sanity = labRefSanityRanges[r.marker_id];
    if (!sanity) continue;
    if (typeof r.lab_ref_min !== 'number' && typeof r.lab_ref_max !== 'number') continue;
    const refMin = typeof r.lab_ref_min === 'number' ? r.lab_ref_min : r.lab_ref_max as number;
    const refMax = typeof r.lab_ref_max === 'number' ? r.lab_ref_max : r.lab_ref_min as number;
    const expectedMid = (sanity.min + sanity.max) / 2;
    const parsedMid = (refMin + refMax) / 2;
    if (expectedMid > 0 && parsedMid > 0) {
      const ratio = Math.max(expectedMid / parsedMid, parsedMid / expectedMid);
      if (ratio > 20) {
        console.log(`[sanity] Discarding incompatible lab_ref for ${r.marker_id}: [${refMin}, ${refMax}] ratio=${ratio.toFixed(1)}x vs expected [${sanity.min}, ${sanity.max}]`);
        r.lab_ref_min = null;
        r.lab_ref_max = null;
        r.lab_ref_text = '';
      }
    }
  }

  for (const r of results) {
    const converter = refConverters[r.marker_id];
    if (!converter) continue;
    if (typeof r.lab_ref_min !== 'number' && typeof r.lab_ref_max !== 'number') continue;
    const origMin = r.lab_ref_min ?? 0;
    const origMax = r.lab_ref_max ?? 0;
    const converted = converter(
      typeof r.lab_ref_min === 'number' ? r.lab_ref_min : 0,
      typeof r.lab_ref_max === 'number' ? r.lab_ref_max : 0
    );
    if (typeof r.lab_ref_min === 'number') r.lab_ref_min = converted.min;
    if (typeof r.lab_ref_max === 'number') r.lab_ref_max = converted.max;
    // Atualizar o texto de exibição se foi alterado
    if (converted.min !== origMin || converted.max !== origMax) {
      if (typeof r.lab_ref_min === 'number' && typeof r.lab_ref_max === 'number') {
        // Formatar com a unidade correta do marcador
        const unitSuffix = r.marker_id === 't3_livre' ? ' ng/dL'
          : r.marker_id === 'urina_albumina' ? ' mg/L'
          : '';
        r.lab_ref_text = `${r.lab_ref_min} a ${r.lab_ref_max}${unitSuffix}`;
      }
      console.log(`Converted lab_ref for ${r.marker_id}: ${origMin}-${origMax} → ${converted.min}-${converted.max}`);
    }
  }
  return results;
}
// Post-processing: calculate derived values if missing
function postProcessResults(results: any[]): any[] {
  const resultMap = new Map<string, any>();
  for (const r of results) {
    resultMap.set(r.marker_id, r);
  }

  // Calculate Bilirrubina Indireta = Total - Direta
  if (!resultMap.has("bilirrubina_indireta") && resultMap.has("bilirrubina_total") && resultMap.has("bilirrubina_direta")) {
    const bt = resultMap.get("bilirrubina_total").value;
    const bd = resultMap.get("bilirrubina_direta").value;
    if (typeof bt === "number" && typeof bd === "number") {
      const bi = Math.round((bt - bd) * 100) / 100;
      if (bi >= 0) {
        results.push({ marker_id: "bilirrubina_indireta", value: bi });
        console.log(`Calculated bilirrubina_indireta: ${bt} - ${bd} = ${bi}`);
      }
    }
  }

  // Calculate Colesterol Não-HDL = CT - HDL
  if (!resultMap.has("colesterol_nao_hdl") && resultMap.has("colesterol_total") && resultMap.has("hdl")) {
    const ct = resultMap.get("colesterol_total").value;
    const hdl = resultMap.get("hdl").value;
    if (typeof ct === "number" && typeof hdl === "number") {
      const naoHdl = Math.round(ct - hdl);
      if (naoHdl >= 0) {
        results.push({ marker_id: "colesterol_nao_hdl", value: naoHdl });
        console.log(`Calculated colesterol_nao_hdl: ${ct} - ${hdl} = ${naoHdl}`);
      }
    }
  }

  // Calculate CT/HDL ratio
  if (!resultMap.has("relacao_ct_hdl") && resultMap.has("colesterol_total") && resultMap.has("hdl")) {
    const ct = resultMap.get("colesterol_total").value;
    const hdl = resultMap.get("hdl").value;
    if (typeof ct === "number" && typeof hdl === "number" && hdl > 0) {
      const ratio = Math.round((ct / hdl) * 100) / 100;
      results.push({ marker_id: "relacao_ct_hdl", value: ratio });
      console.log(`Calculated relacao_ct_hdl: ${ct} / ${hdl} = ${ratio}`);
    }
  }

  // Calculate TG/HDL ratio
  if (!resultMap.has("relacao_tg_hdl") && resultMap.has("triglicerides") && resultMap.has("hdl")) {
    const tg = resultMap.get("triglicerides").value;
    const hdl = resultMap.get("hdl").value;
    if (typeof tg === "number" && typeof hdl === "number" && hdl > 0) {
      const ratio = Math.round((tg / hdl) * 100) / 100;
      results.push({ marker_id: "relacao_tg_hdl", value: ratio });
      console.log(`Calculated relacao_tg_hdl: ${tg} / ${hdl} = ${ratio}`);
    }
  }

  // Calculate ApoB/ApoA1 ratio
  if (!resultMap.has("relacao_apob_apoa1") && resultMap.has("apo_b") && resultMap.has("apo_a1")) {
    const apoB = resultMap.get("apo_b").value;
    const apoA1 = resultMap.get("apo_a1").value;
    if (typeof apoB === "number" && typeof apoA1 === "number" && apoA1 > 0) {
      const ratio = Math.round((apoB / apoA1) * 100) / 100;
      results.push({ marker_id: "relacao_apob_apoa1", value: ratio });
      console.log(`Calculated relacao_apob_apoa1: ${apoB} / ${apoA1} = ${ratio}`);
    }
  }

  // Calculate HOMA-IR = (Glicose × Insulina) / 405
  if (!resultMap.has("homa_ir") && resultMap.has("glicose_jejum") && resultMap.has("insulina_jejum")) {
    const glicose = resultMap.get("glicose_jejum").value;
    const insulina = resultMap.get("insulina_jejum").value;
    if (typeof glicose === "number" && typeof insulina === "number") {
      const homa = Math.round((glicose * insulina / 405) * 100) / 100;
      results.push({ marker_id: "homa_ir", value: homa });
      console.log(`Calculated homa_ir: (${glicose} × ${insulina}) / 405 = ${homa}`);
    }
  }

  // Calculate Neutrófilos = Bastonetes + Segmentados
  if (!resultMap.has("neutrofilos") && resultMap.has("bastonetes") && resultMap.has("segmentados")) {
    const bast = resultMap.get("bastonetes").value;
    const seg = resultMap.get("segmentados").value;
    if (typeof bast === "number" && typeof seg === "number") {
      const neutro = Math.round((bast + seg) * 100) / 100;
      results.push({ marker_id: "neutrofilos", value: neutro });
      console.log(`Calculated neutrofilos: ${bast} + ${seg} = ${neutro}`);
    }
  }
  // Calculate Capacidade de Fixação Latente do Ferro = TIBC - Ferro Sérico
  if (!resultMap.has("fixacao_latente_ferro") && resultMap.has("tibc") && resultMap.has("ferro_serico")) {
    const tibc = resultMap.get("tibc").value;
    const ferro = resultMap.get("ferro_serico").value;
    if (typeof tibc === "number" && typeof ferro === "number") {
      const latente = Math.round(tibc - ferro);
      if (latente >= 0) {
        results.push({ marker_id: "fixacao_latente_ferro", value: latente });
        console.log(`Calculated fixacao_latente_ferro: ${tibc} - ${ferro} = ${latente}`);
      }
    }
  }
  // Calculate Razão Albumina/Creatinina urinária (ACR)
  // urina_albumina em mg/L, urina_creatinina em mg/dL (= mg/100mL)
  // ACR (mg/g) = albumina(mg/L) / creatinina(mg/dL) × 10
  // (porque 1 mg/dL creatinina = 0.1 g/L = 100 mg/L → ACR = albumina_mgL / (creatinina_mgdL / 100) = albumina × 100 / creatinina)
  if (!resultMap.has("urina_acr") && resultMap.has("urina_albumina") && resultMap.has("urina_creatinina")) {
    const alb = resultMap.get("urina_albumina").value;
    const crea = resultMap.get("urina_creatinina").value;
    if (typeof alb === "number" && typeof crea === "number" && crea > 0) {
      // ACR em mg/g: albumina(mg/L) × 100 / creatinina(mg/dL)
      const acr = Math.round((alb * 100 / crea) * 10) / 10;
      results.push({ marker_id: "urina_acr", value: acr });
      console.log(`Calculated urina_acr: ${alb} mg/L ÷ ${crea} mg/dL × 100 = ${acr} mg/g`);
    }
  }
  return results;
}

/**
 * Inline copy of parseLabReference from src/lib/parseLabReference.ts
 * SYNC NOTE: Keep synchronized with the frontend version.
 *
 * Converte string numérica para float, distinguindo ponto-milhar de ponto-decimal.
 */
function toFloat(s: string): number | null {
  if (!s) return null;
  let cleaned = s.trim().replace(/\s/g, '');
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    const thousandsMatch = cleaned.match(/^(\d{1,3})(\.(\d{3}))+$/);
    if (thousandsMatch) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

const OPERATOR_PATTERNS: Array<{ pattern: RegExp; operator: string }> = [
  { pattern: /^inferior\s+ou\s+igual\s+a\b/i, operator: '<=' },
  { pattern: /^menor\s+ou\s+igual\s+a?\b/i, operator: '<=' },
  { pattern: /^superior\s+ou\s+igual\s+a\b/i, operator: '>=' },
  { pattern: /^maior\s+ou\s+igual\s+a?\b/i, operator: '>=' },
  { pattern: /^inferior\s+a\b/i, operator: '<' },
  { pattern: /^menor\s+que\b/i, operator: '<' },
  { pattern: /^superior\s+a\b/i, operator: '>' },
  { pattern: /^maior\s+que\b/i, operator: '>' },
  { pattern: /^ate\b/i, operator: '<=' },
  { pattern: /^até\b/i, operator: '<=' },
  { pattern: /^acima\s+de\b/i, operator: '>' },
  { pattern: /^abaixo\s+de\b/i, operator: '<' },
  { pattern: /^<=\s*/, operator: '<=' },
  { pattern: /^>=\s*/, operator: '>=' },
  { pattern: /^<\s*/, operator: '<' },
  { pattern: /^>\s*/, operator: '>' },
];

/**
 * Parseia o lab_ref_text retornado pelo Gemini em campos numéricos lab_ref_min e lab_ref_max.
 * Versão sincronizada com src/lib/parseLabReference.ts (com 3 fixes aplicados).
 */
function parseLabRefRanges(results: any[]): any[] {
  for (const r of results) {
    const refText: string | undefined = r.lab_ref_text;
    if (!refText || typeof refText !== 'string' || refText.trim() === '') {
      delete r.lab_ref_text;
      continue;
    }
    let t = refText.trim();

    // ── Remover padrões descritivos que confundem o parser ──
    // Horários
    t = t.replace(/\(\s*\d+\s*[-–]\s*\d+\s*h(?:oras?)?\s*\)/gi, '').trim();
    t = t.replace(/\d+\s*[-–]\s*\d+\s*h(?:oras?)?/gi, '').trim();
    t = t.replace(/^(?:horas?\s+d[ao]\s+)?(?:manh[aã]|tarde|noite|vesper[ae])\s*:?\s*/gi, '').trim();
    // Faixa etária por sexo
    t = t.replace(/(?:homens?|mulheres?|masc(?:ulino)?|fem(?:inino)?)\s*\d+\s*[-–]\s*\d+\s*(?:anos?|a)\s*:?\s*/gi, '').trim();
    t = t.replace(/(?:homens?|mulheres?|masc(?:ulino)?|fem(?:inino)?)\s*>=?\s*\d+\s*(?:anos?|a)\s*:?\s*/gi, '').trim();
    t = t.replace(/(?:homens?|mulheres?|masc(?:ulino)?|fem(?:inino)?)\s*<=?\s*\d+\s*(?:anos?|a)\s*:?\s*/gi, '').trim();
    // Faixa etária sem sexo: "20-59 a:", "30 a 39 anos:", "De 20 a 34 anos:"
    t = t.replace(/^(?:de\s+)?\d+\s*(?:a|[-–])\s*\d+\s*(?:anos?|a)\s*:/gi, '').trim();
    // Operadores textuais + idade: "Acima de 12 anos:", "maior que 2 anos:"
    t = t.replace(/^(?:acima|maior|superior)\s+(?:de|que)\s+\d+\s*(?:anos?|a)(?:\s+e\s+adultos?)?\s*:?\s*/gi, '').trim();
    t = t.replace(/^(?:abaixo|menor|inferior)\s+(?:de|que)\s+\d+\s*(?:anos?|a)\s*:?\s*/gi, '').trim();
    // Faixas genéricas
    t = t.replace(/\d+\s*[-–]\s*\d+\s*(?:anos?|a)\s*:/gi, '').trim();
    t = t.replace(/>=?\s*\d+\s*(?:anos?|a)\s*:/gi, '').trim();
    t = t.replace(/<=?\s*\d+\s*(?:anos?|a)\s*:/gi, '').trim();
    // Fases de vida
    t = t.replace(/^(?:pr[eé]-?p[uú]beres?|p[oó]s-?menopausa|menopausa|adultos?)\s*:?\s*/gi, '').trim();

    // Se após limpeza o texto ainda contém "anos", é texto etário puro → descartar
    if (/^\d+\s*(?:a|[-–])\s*\d+\s*anos?\s*$/i.test(t) || /^\d+\s*anos?\s*$/i.test(t)) {
      delete r.lab_ref_text;
      continue;
    }

    // ── Detecção de qualitativo ──
    if (/^(n[aã]o\s*reag|reag|negativ|positiv|ausente|presente|normal|indeterminad)/i.test(t)) {
      // Manter apenas lab_ref_text (sem min/max)
      continue;
    }

    // ── Detecção de operador ──
    let matched = false;
    for (const { pattern, operator } of OPERATOR_PATTERNS) {
      if (pattern.test(t)) {
        const numStr = t.replace(pattern, '').trim();
        const numMatch = numStr.match(/[\d.,]+/);
        if (numMatch) {
          const val = toFloat(numMatch[0]);
          if (val !== null) {
            if (operator === '<' || operator === '<=') {
              r.lab_ref_max = val;
              r.lab_ref_text = `${operator} ${val}`;
            } else {
              r.lab_ref_min = val;
              r.lab_ref_text = `${operator} ${val}`;
            }
            matched = true;
            break;
          }
        }
      }
    }
    if (matched) continue;

    // ── Detecção de range (X a Y, X - Y, X–Y) ──
    const rangeMatch = t.match(
      /([\d.,]+)\s*(?:a|até|to|-|–|—)\s*([\d.,]+)/i
    );
    if (rangeMatch) {
      const min = toFloat(rangeMatch[1]);
      const max = toFloat(rangeMatch[2]);
      if (min !== null && max !== null && min < max) {
        r.lab_ref_min = min;
        r.lab_ref_max = max;
        r.lab_ref_text = `${min} a ${max}`;
        continue;
      }
    }

    // ── Número isolado (sem operador) — tratar como máximo ──
    const singleNum = t.match(/^([\d.,]+)\s*$/);
    if (singleNum) {
      const val = toFloat(singleNum[1]);
      if (val !== null) {
        r.lab_ref_max = val;
        r.lab_ref_text = `<= ${val}`;
        continue;
      }
    }

    // Texto muito longo sem intervalo numérico extraível → descartar
    if (t.length > 60) {
      delete r.lab_ref_text;
      continue;
    }

    // Texto qualitativo curto — mantém apenas lab_ref_text
  }
  return results;
}

/**
 * Regex fallback: busca marcadores que a AI perdeu diretamente no texto do PDF.
 * Roda DEPOIS da extração da AI. Só adiciona marcadores que a AI NÃO encontrou.
 * Otimizado para o formato Fleury onde o valor aparece APÓS "VALOR(ES) DE REFERÊNCIA".
 */
function regexFallback(pdfText: string, aiResults: any[]): any[] {
  const found = new Set(aiResults.map(r => r.marker_id));
  const additional: any[] = [];

  // Helper: parse número brasileiro (1.234,56 → 1234.56)
  function parseBrNum(s: string): number {
    let c = s.trim();
    if (/^\d{1,3}(\.\d{3})+(,\d{1,4})?$/.test(c)) {
      c = c.replace(/\./g, '').replace(',', '.');
      return parseFloat(c);
    }
    if (/^\d+,\d{1,4}$/.test(c)) {
      c = c.replace(',', '.');
      return parseFloat(c);
    }
    if (/^\d{2,}(\.\d{3})+$/.test(c)) {
      c = c.replace('.', '');
      return parseFloat(c);
    }
    return parseFloat(c.replace(',', '.'));
  }

  // Helper: processar valor capturado (trata "inferior a", "superior a", operadores)
  function processValue(id: string, rawVal: string): void {
    const valStr = rawVal.trim();

    const infMatch = valStr.match(/^inferior\s+a\s+([\d,\.]+)/i);
    if (infMatch) {
      const num = parseBrNum(infMatch[1]);
      if (!isNaN(num)) {
        additional.push({ marker_id: id, value: num, text_value: `< ${num}` });
        found.add(id);
        console.log(`Regex fallback ${id}: < ${num}`);
        return;
      }
    }

    const supMatch = valStr.match(/^superior\s+a\s+([\d,\.]+)/i);
    if (supMatch) {
      const num = parseBrNum(supMatch[1]);
      if (!isNaN(num)) {
        additional.push({ marker_id: id, value: num, text_value: `> ${num}` });
        found.add(id);
        console.log(`Regex fallback ${id}: > ${num}`);
        return;
      }
    }

    const opMatch = valStr.match(/^([<>≤≥]=?)\s*([\d,\.]+)/);
    if (opMatch) {
      const num = parseBrNum(opMatch[2]);
      if (!isNaN(num)) {
        additional.push({ marker_id: id, value: num, text_value: `${opMatch[1]} ${num}` });
        found.add(id);
        console.log(`Regex fallback ${id}: ${opMatch[1]} ${num}`);
        return;
      }
    }

    const num = parseBrNum(valStr);
    if (!isNaN(num) && num >= 0) {
      additional.push({ marker_id: id, value: num });
      found.add(id);
      console.log(`Regex fallback ${id}: ${num}`);
    }
  }

  /**
   * Padrão principal Fleury: valor aparece DEPOIS de "VALOR(ES) DE REFERÊNCIA\n\n"
   * examRegex: regex do nome do exame (sem capture group)
   * valueRegex: regex do valor a capturar (COM capture group)
   */
  function tryFleury(id: string, examRegex: string, valueRegex: string): boolean {
    if (found.has(id)) return false;
    const pat = new RegExp(
      examRegex + '[\\s\\S]{0,500}?VALOR(?:ES)?\\s+DE\\s+REFER[EÊ]NCIA\\s*\\n\\s*\\n\\s*' + valueRegex,
      'i'
    );
    const m = pdfText.match(pat);
    if (m && m[1]) {
      processValue(id, m[1]);
      return found.has(id);
    }
    return false;
  }

  const NUM = '([\\d,\\.]+)';
  const OP_NUM = '(inferior\\s+a\\s+[\\d,\\.]+|superior\\s+a\\s+[\\d,\\.]+|[<>]\\s*[\\d,\\.]+|[\\d,\\.]+)';

  // =============================================
  // NUMÉRICOS — Padrão Fleury (valor após VALORES DE REFERÊNCIA)
  // =============================================

  // VHS — padrão especial (PRIMEIRA HORA : valor)
  if (!found.has('vhs')) {
    const m = pdfText.match(/HEMOSSEDIMENTA[CÇ][AÃ]O[\s\S]{0,500}?PRIMEIRA\s+HORA\s*[:\s]*(\d+)/i);
    if (m) { processValue('vhs', m[1]); }
  }

  // T4 Total — TIROXINA (T4) sem LIVRE
  tryFleury('t4_total', 'TIROXINA\\s*\\(T4\\)(?!.*LIVRE)', NUM);

  // T3 Total — TRIIODOTIRONINA (T3) sem LIVRE
  tryFleury('t3_total', 'TRIIODOTIRONINA\\s*\\(T3\\)(?!.*LIVRE)', NUM);

  tryFleury('estrona', 'ESTRONA', NUM);
  tryFleury('amh', 'ANTI[- \\u00ad]?M[UÜ]LLERIANO', NUM);
  tryFleury('aldosterona', 'ALDOSTERONA', NUM);
  tryFleury('vitamina_d_125', '1[,.]25[- ]?DIHIDROXIVITAMINA', NUM);
  tryFleury('magnesio', 'MAGN[EÉ]SIO', NUM);
  tryFleury('selenio', 'SEL[EÊ]NIO', NUM);
  tryFleury('cromo', 'CROMO', OP_NUM);
  tryFleury('fosfatase_alcalina', 'FOSFATASE\\s+ALCALINA', NUM);
  tryFleury('sodio', 'S[OÓ]DIO', NUM);
  tryFleury('potassio', 'POT[AÁ]SSIO', NUM);
  tryFleury('fosforo', 'F[OÓ]SFORO', NUM);
  tryFleury('calcitonina', 'CALCITONINA', OP_NUM);
  tryFleury('anti_tpo', 'ANTICORPOS?\\s+ANTI[- ]?PEROXIDASE(?:\\s+TI(?:R|REOI)DIANA)?|ANTI[- ]?PEROXIDASE', OP_NUM);
  tryFleury('anti_tg', 'ANTICORPOS?\\s+ANTI[- ]?TIREOGLOBULINA|ANTICORPOS?\\s+ANTITIROGLOBULINA|ANTITIROGLOBULINA', OP_NUM);
  tryFleury('trab', 'ANTI[- ]?RECEPTOR\\s+DE\\s+TSH', OP_NUM);
  tryFleury('glicose_jejum', 'GLICOSE[\\s,]{0,20}(?:plasma|soro)', NUM);
  tryFleury('glicemia_media_estimada', 'GLICEMIA\\s+M[EÉ]DIA\\s+ESTIMADA|eAG', NUM);
  tryFleury('insulina_jejum', 'INSULINA[\\s,]{0,20}soro', NUM);
  tryFleury('acido_folico', '[AÁ]CIDO\\s+F[OÓ]LICO', OP_NUM);
  tryFleury('homocisteina', 'HOMOCISTE[IÍ]NA', NUM);

  // Marcadores tumorais
  // Ferro do painel Metabolismo do Ferro (Fleury) — contexto específico
  if (!found.has('ferro_metabolismo')) {
    // Padrão Fleury: "Metabolismo do Ferro\n(Material: Soro)\nFerro\n50 a 170\n57 µg/dL"
    // Valor vem APÓS a faixa de referência (ex: "50 a 170"), não após "VALORES DE REFERÊNCIA"
    const m = pdfText.match(/Metabolismo\s+do\s+Ferro[\s\S]{0,200}?\nFerro\s*\n[\s\S]{0,50}?\n(\d[\d,\.]*)/i);
    if (m && m[1]) {
      const num = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(num) && num >= 10 && num <= 500) {
        additional.push({ marker_id: 'ferro_metabolismo', value: num });
        found.add('ferro_metabolismo');
        console.log(`Regex fallback ferro_metabolismo: ${num}`);
      }
    }
  }
  // Capacidade de Fixação Latente do Ferro (UIBC)
  if (!found.has('fixacao_latente_ferro')) {
    // Padrão Fleury: "Capacidade de Fixação Latente do\nFerro\n225,0 µg/dL\n140,0 - 280,0"
    // Valor vem logo após o nome (antes da faixa de referência)
    const m = pdfText.match(/Capacidade\s+de\s+Fixa[cç][aã]o\s+Latente(?:\s+do)?\s*\nFerro\s*\n([\d,\.]+)/i);
    if (m && m[1]) {
      const num = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(num) && num >= 10 && num <= 600) {
        additional.push({ marker_id: 'fixacao_latente_ferro', value: num });
        found.add('fixacao_latente_ferro');
        console.log(`Regex fallback fixacao_latente_ferro: ${num}`);
      }
    } else {
      // Fallback: qualquer número seguido de µg/dL próximo ao nome
      const m2 = pdfText.match(/Capacidade\s+de\s+Fixa[cç][aã]o\s+Latente[\s\S]{0,100}?([\d,\.]+)\s*µg\/dL/i);
      if (m2 && m2[1]) {
        const num = parseFloat(m2[1].replace(',', '.'));
        if (!isNaN(num) && num >= 10 && num <= 600) {
          additional.push({ marker_id: 'fixacao_latente_ferro', value: num });
          found.add('fixacao_latente_ferro');
          console.log(`Regex fallback2 fixacao_latente_ferro: ${num}`);
        }
      }
    }
  }
  // Testosterona Biodisponível
  if (!found.has('testosterona_biodisponivel')) {
    // Padrão Fleury: "Testosterona Biodisponível\n4,40 ng/dL"
    // Valor vem logo após o nome
    const m = pdfText.match(/Testosterona\s+Biodispon[ií]vel[\s\S]{0,50}?\n([\d,\.]+)\s*ng\/dL/i);
    if (m && m[1]) {
      const num = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(num) && num >= 0 && num <= 500) {
        additional.push({ marker_id: 'testosterona_biodisponivel', value: num });
        found.add('testosterona_biodisponivel');
        console.log(`Regex fallback testosterona_biodisponivel: ${num}`);
      }
    } else {
      // Fallback: qualquer número em ng/dL próximo ao nome
      const m2 = pdfText.match(/Testosterona\s+Biodispon[ií]vel[\s\S]{0,300}?([\d,\.]+)\s*ng\/dL/i);
      if (m2 && m2[1]) {
        const num = parseFloat(m2[1].replace(',', '.'));
        if (!isNaN(num) && num >= 0 && num <= 500) {
          additional.push({ marker_id: 'testosterona_biodisponivel', value: num });
          found.add('testosterona_biodisponivel');
          console.log(`Regex fallback2 testosterona_biodisponivel: ${num}`);
        }
      }
    }
  }
  // Cobalto
  // Cobalto — padrão Fleury: "Cobalto\nAté 1,00 µg/L\n0,13 µg/L"
  if (!found.has('cobalto')) {
    // Valor vem APÓS a referência "Até X µg/L"
    const m = pdfText.match(/Cobalto[\s\S]{0,100}?[Aa]t[eé]\s+[\d,\.]+\s*µg\/L\s*\n([\d,\.]+)/i);
    if (m && m[1]) {
      const num = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(num) && num >= 0 && num <= 100) {
        additional.push({ marker_id: 'cobalto', value: num });
        found.add('cobalto');
        console.log(`Regex cobalto: ${num}`);
      }
    } else {
      // Fallback genérico
      tryFleury('cobalto', 'COBALTO', OP_NUM);
    }
  }
  // Arsênico
  if (!found.has('arsenico')) {
    // Padrão Fleury: "Dosagem de Arsênico\nAté 23,0 mcg/L\nInferior a 1,0 mcg/L"
    // Valor vem APÓS a referência "Até X mcg/L"
    const m = pdfText.match(/(?:Dosagem\s+de\s+)?Ars[eê]nico[\s\S]{0,200}?[Aa]t[eé]\s+[\d,\.]+\s*mcg\/L\s*\n(Inferior\s+a\s+[\d,\.]+|[<>]?\s*[\d,\.]+)/i);
    if (m && m[1]) {
      processValue('arsenico', m[1].trim());
      console.log(`Regex arsenico: ${m[1].trim()}`);
    } else {
      // Fallback: qualquer valor próximo ao nome
      const m2 = pdfText.match(/(?:Dosagem\s+de\s+)?Ars[eê]nico[\s\S]{0,300}?(Inferior\s+a\s+[\d,\.]+|[<>]?\s*[\d,\.]+)\s*mcg\/L/i);
      if (m2 && m2[1]) {
        processValue('arsenico', m2[1].trim());
        console.log(`Regex fallback arsenico: ${m2[1].trim()}`);
      }
    }
  }
  // Níquel
  // Níquel — padrão Fleury: "Dosagem de Níquel\n0,7 µg/L"
  if (!found.has('niquel')) {
    // Valor vem logo após o nome
    const m = pdfText.match(/(?:Dosagem\s+de\s+)?N[ií]quel[\s\S]{0,50}?\n([\d,\.]+)\s*µg\/L/i);
    if (m && m[1]) {
      const num = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(num) && num >= 0 && num <= 100) {
        additional.push({ marker_id: 'niquel', value: num });
        found.add('niquel');
        console.log(`Regex niquel: ${num}`);
      }
    } else {
      tryFleury('niquel', 'N[IÍ]QUEL', OP_NUM);
    }
  }
  // Urina quantitativa — Sedimento Quantitativo (Fleury)
  if (!found.has('urina_leucocitos_quant') || !found.has('urina_hemacias_quant')) {
    // Padrão Fleury: "Sedimento Quantitativo\nLeucócitos\nHemácias\nCélulas Epiteliais...\n5.900 /mL\n2.600 /mL"
    // Os valores em /mL aparecem APÓS todos os labels, não intercalados
    const sedMatch = pdfText.match(/Sedimento\s+Quantitativo[\s\S]{0,800}/i);
    if (sedMatch) {
      const seg = sedMatch[0];
      // Extrair todos os valores em /mL do segmento
      const numPattern = /([\d.]+(?:[.,]\d+)?)\s*\/mL/gi;
      const nums: number[] = [];
      let nm: RegExpExecArray | null;
      while ((nm = numPattern.exec(seg)) !== null) {
        // Remover separador de milhar (ponto) e converter vírgula decimal
        const cleaned = nm[1].replace(/\.(\d{3})/g, '$1').replace(',', '.');
        const v = parseFloat(cleaned);
        if (!isNaN(v) && v >= 0) nums.push(v);
      }
      console.log('Sedimento Quantitativo nums:', nums);
      // Fleury order: Leucócitos /mL, Hemácias /mL (1ª e 2ª ocorrências)
      if (nums.length >= 1 && !found.has('urina_leucocitos_quant')) {
        additional.push({ marker_id: 'urina_leucocitos_quant', value: nums[0] });
        found.add('urina_leucocitos_quant');
        console.log('Regex urina_leucocitos_quant: ' + nums[0]);
      }
      if (nums.length >= 2 && !found.has('urina_hemacias_quant')) {
        additional.push({ marker_id: 'urina_hemacias_quant', value: nums[1] });
        found.add('urina_hemacias_quant');
        console.log('Regex urina_hemacias_quant: ' + nums[1]);
      }
    }
  }
  tryFleury('ca_19_9', 'CA\\s*19[.-]9', NUM);
  tryFleury('ca_125', 'CA[- ]?125', NUM);
  tryFleury('ca_72_4', 'CA\\s*72[.-]4', OP_NUM);
  tryFleury('ca_15_3', 'CA\\s*15[.-]3', NUM);
  tryFleury('afp', 'ALFA[- ]?FETOPROTE[IÍ]NA', NUM);
  tryFleury('cea', 'CARCINOEMBRION[IÍA]', NUM);

  // =============================================
  // EXCEÇÕES — padrões diferentes do padrão Fleury
  // =============================================

  // HbA1c — valor vem LOGO APÓS "RESULTADO\n" (sem VALORES DE REFERÊNCIA entre eles)
  if (!found.has('hba1c')) {
    const m = pdfText.match(/HEMOGLOBINA\s+GLICADA[\s\S]{0,300}?RESULTADO\s*\n\s*([\d,\.]+)\s*%/i);
    if (m) { processValue('hba1c', m[1]); }
  }

  // IGFBP-3 — valor vem APÓS "RESULTADO\n\n" (ANTES dos VALORES DE REFERÊNCIA)
  if (!found.has('igfbp3')) {
    const m = pdfText.match(/IGFBP[- ]?3[\s\S]{0,300}?RESULTADO\s*\n\s*\n\s*([\d,\.]+)/i);
    if (m) {
      const num = parseBrNum(m[1]);
      if (!isNaN(num)) {
        // Fleury reporta em ng/mL, esperamos µg/mL → dividir por 1000 se > 100
        const converted = num > 100 ? num / 1000 : num;
        additional.push({ marker_id: 'igfbp3', value: converted });
        found.add('igfbp3');
        console.log(`Regex fallback igfbp3: ${num} ng/mL → ${converted} µg/mL`);
      }
    }
  }

  // PTH — tem "IDADE" entre VALORES DE REFERÊNCIA e o valor
  if (!found.has('pth')) {
    const m = pdfText.match(/PARATORM[OÔ]NIO[\s\S]{0,500}?VALOR(?:ES)?\s+DE\s+REFERE[NÊ]CIA\s*\n[\s\S]{0,50}?\n\s*\n\s*([\d,\.]+)/i);
    if (m) { processValue('pth', m[1]); }
  }

  // =============================================
  // FALLBACK GENÉRICO — para marcadores que não são Fleury
  // =============================================
  // These use simpler label:value or RESULTADO patterns as fallback for non-Fleury labs
  
  function tryGeneric(id: string, patterns: RegExp[]): boolean {
    if (found.has(id)) return false;
    for (const pat of patterns) {
      const match = pdfText.match(pat);
      if (match && match[1]) {
        processValue(id, match[1].trim());
        if (found.has(id)) return true;
      }
    }
    return false;
  }

  // Generic fallbacks for non-Fleury formats
  tryGeneric('vhs', [
    /V\.?H\.?S\.?[\s\S]{0,200}?RESULTADO[\s:]*(\d+)/i,
    /(?:Hemossedimenta[çc][ãa]o|HEMOSSEDIMENTACAO)[^0-9]*?(\d+)\s*(?:mm)/i,
  ]);
  tryGeneric('t4_total', [
    /(?:T4\s+Total|Tiroxina\s+Total)[\s:.\-]*?(\d+[.,]?\d*)/i,
  ]);
  tryGeneric('t3_total', [
    /(?:T3\s+Total|Triiodotironina\s+Total)[\s:.\-]*?(\d+[.,]?\d*)/i,
  ]);
  tryGeneric('estrona', [/(?:Estrona|ESTRONA\s*\(E1\))[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('amh', [/(?:AMH|Anti[- ]?M[üuÜU]lleriano|HAM)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('aldosterona', [/(?:Aldosterona)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('vitamina_d_125', [/(?:1[,.]25[- ]?(?:Di)?[Hh]idroxi)[^0-9]*?(\d+[.,]\d+)/i]);
  tryGeneric('magnesio', [/(?:Magn[éeÉE]sio)[\s:.\-]*?(\d[.,]\d)/i]);
  tryGeneric('selenio', [/(?:Sel[êeÊE]nio)[\s:.\-]*?(\d{2,3})/i]);
  tryGeneric('cromo', [/(?:Cromo)[\s:.\-]*?(inferior\s+a\s+[\d,\.]+|[<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('fosfatase_alcalina', [/(?:Fosfatase\s+Alcalina)[\s:.\-]*?(\d+)/i]);
  tryGeneric('sodio', [/(?:S[óoÓO]dio)[\s:.\-]*?(1[0-9]{2})/i]);
  tryGeneric('potassio', [/(?:Pot[áaÁA]ssio)[\s:.\-]*?(\d[.,]\d)/i]);
  tryGeneric('fosforo', [/(?:F[óoÓO]sforo)[\s:.\-]*?(\d[.,]\d)/i]);
  tryGeneric('calcitonina', [/(?:Calcitonina)[\s:.\-]*?(inferior\s+a\s+[\d,\.]+|[<>]\s*\d+[.,]?\d*|\d+[.,]?\d*)/i]);
  tryGeneric('anti_tpo', [
    /(?:Anti[- ]?TPO|ANTI[- ]?PEROXIDASE(?:\s+TI(?:R|REOI)DIANA)?|ANTICORPOS?\s+ANTI[- ]?PEROXIDASE|ATPO|TPO[- ]?Ab)[\s:.\-]*?(inferior\s+a\s+[\d,\.]+|[<>]\s*\d+[.,]?\d*|\d+[.,]?\d*)/i,
  ]);
  tryGeneric('anti_tg', [
    /(?:Anti[- ]?TG|ANTICORPOS?\s+ANTI[- ]?TIREOGLOBULINA|ANTICORPOS?\s+ANTITIROGLOBULINA|ANTITIROGLOBULINA|ATG|TgAb)[\s:.\-]*?(inferior\s+a\s+[\d,\.]+|[<>]\s*\d+[.,]?\d*|\d+[.,]?\d*)/i,
  ]);
  tryGeneric('trab', [/(?:TRAb|TRAB)[\s:.\-]*?(inferior\s+a\s+[\d,\.]+|[<>]\s*\d+[.,]?\d*|\d+[.,]?\d*)/i]);
  tryGeneric('hba1c', [/(?:HEMOGLOBINA\s+GLICADA|HbA1c)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('glicemia_media_estimada', [/(?:GLICEMIA\s+M[EÉ]DIA\s+ESTIMADA|eAG|Estimated\s+Average\s+Glucose)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('glicose_jejum', [/(?:GLICOSE|GLICEMIA)[\s:.\-]*?(\d{2,3})\s*mg/i]);
  tryGeneric('insulina_jejum', [/(?:INSULINA)[\s,]*(?:soro|BASAL)?[\s\S]*?(?:RESULTADO|:)\s*(\d+[.,]?\d*)/i]);
  tryGeneric('acido_folico', [
    /(?:Vitamina\s+B9\s*\([^)]*\)|[ÁAáa]cido\s+F[óoÓO]lico|Folato)[\s\S]{0,50}?(\d+[.,]?\d*)\s*ng\/mL/i,
    /(?:[ÁAáa]cido\s+F[óoÓO]lico|Folato)[\s:.\-]*?(superior\s+a\s+[\d,\.]+|inferior\s+a\s+[\d,\.]+|[<>]?\s*\d+[.,]?\d*)/i
  ]);
  // IGF-1 generic fallback (non-Fleury labs)
  if (!found.has('igf1')) {
    const igf1Patterns = [
      /(?:IGF[- ]?1|Somatomedina\s+C)[\s\S]{0,80}?(\d{2,3}[.,]?\d*)\s*ng\/mL/i,
      /(?:IGF[- ]?1|IGF\s+I|FATOR\s+DE\s+CRESCIMENTO\s+INSULINO)[\s:.\-]*?(\d{2,3}[.,]?\d*)/i,
    ];
    for (const pat of igf1Patterns) {
      const m = pdfText.match(pat);
      if (m) {
        const num = parseBrNum(m[1]);
        if (!isNaN(num) && num >= 20 && num <= 1000) {
          additional.push({ marker_id: 'igf1', value: num });
          found.add('igf1');
          console.log(`Regex fallback igf1 (generic): ${num}`);
          break;
        }
      }
    }
  }
  tryGeneric('homocisteina', [/(?:Homociste[íi]na)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('pth', [/(?:PTH|PARATORM[OÔ]NIO)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  
  // Tumor markers generic
  tryGeneric('ca_19_9', [/(?:CA\s*19[.\-]9)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('ca_125', [/(?:CA[- ]?125)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('ca_72_4', [/(?:CA\s*72[.\-]4)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('ca_15_3', [/(?:CA\s*15[.\-]3)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('afp', [/(?:AFP|Alfafetoprote[íi]na)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('cea', [/(?:CEA|Ant[íi]geno\s+Carcinoembrion[áa]rio)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);

  // Additional commonly missed (generic)
  tryGeneric('vitamina_a', [/(?:Vitamina\s+A|Retinol)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('vitamina_c', [/(?:Vitamina\s+C|[ÁAáa]cido\s+Asc[óo]rbico)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('bilirrubina_total', [/(?:Bilirrubina\s+Total)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('bilirrubina_direta', [/(?:Bilirrubina\s+Direta)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('bilirrubina_indireta', [/(?:Bilirrubina\s+Indireta)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('albumina', [/(?:Albumina)[\s:.\-]*?(\d+[.,]?\d*)\s*(?:g\/dL)/i]);
  tryGeneric('proteinas_totais', [/(?:Prote[íi]nas\s+Totais)[\s:.\-]*?(\d[.,]\d+)/i]);
  tryGeneric('ldh', [/(?:LDH|LACTATO\s+DESIDROGENASE|DESIDROGENASE\s+L[AÁ]TICA)[\s:.\-]*?(\d+)/i]);
  tryGeneric('creatinina', [/(?:Creatinina)[\s:.\-]*?(\d+[.,]?\d*)\s*(?:mg\/dL)/i]);
  tryGeneric('acido_urico', [/(?:[ÁAáa]cido\s+[ÚUúu]rico)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('tfg', [/(?:TFG|CKD[- ]?EPI|eGFR|Filtra[çc][ãa]o\s+Glomerular)[\s:.\-]*?([<>≥≤]?\s*\d+)/i]);
  tryGeneric('dimeros_d', [/(?:D[íi]meros?\s*D|D[- ]?D[íi]mero|FRAGMENTO\s+D)[\s:.\-]*?([<>]?\s*\d+)/i]);
  tryGeneric('cloro', [/(?:Cloro|CLORO|Cloreto)[\s:.\-]*?(\d{2,3})/i]);
  tryGeneric('bicarbonato', [/(?:Bicarbonato|CO2\s*Total)[\s:.\-]*?(\d+[.,]?\d*)/i]);

  // IGFBP-3 generic fallback
  if (!found.has('igfbp3')) {
    const igfPatterns = [
      /(?:IGFBP[- ]?3|PROTEINA\s+LIGADORA[- ]?3\s+DO\s+FATOR)[\s\S]{0,500}?RESULTADO\s*[:\s]*([\d.,]+)/i,
      /IGFBP[- ]?3[\s\S]*?(?:RESULTADO|:)\s*([\d.,]+)\s*ng\/mL/i,
    ];
    for (const pat of igfPatterns) {
      const m = pdfText.match(pat);
      if (m) {
        const num = parseBrNum(m[1]);
        if (!isNaN(num) && num > 0) {
          const converted = num > 100 ? num / 1000 : num;
          additional.push({ marker_id: 'igfbp3', value: converted });
          found.add('igfbp3');
          console.log(`Regex fallback igfbp3 (generic): ${num} → ${converted}`);
          break;
        }
      }
    }
  }
  // Additional generic fallbacks for commonly missed markers
  tryGeneric('ferro_serico', [/(?:Ferro\s+S[ée]rico|FERRO,?\s*SORO|SIDEREMIA)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('transferrina', [/(?:Transferrina)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('sat_transferrina', [/(?:Satura[çc][ãa]o\s+(?:da?\s+)?Transferrina|[ÍI]ndice\s+de\s+Satura[çc][ãa]o|IST)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('tibc', [/(?:TIBC|Capacidade\s+Total\s+(?:de\s+)?(?:Fixa[çc][ãa]o|Liga[çc][ãa]o)\s+(?:do\s+)?Ferro|CTFF|CTLF|Capacidade\s+Ferrop[ée]xica)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('ureia', [/(?:Ur[ée]ia|UREIA,?\s*SORO)[\s:.\-]*?(\d+[.,]?\d*)\s*(?:mg\/dL)?/i]);
  tryGeneric('cistatina_c', [/(?:Cistatina\s+C)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('calcio_total', [/(?:C[áa]lcio\s+Total|C[áa]lcio,?\s*soro)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('calcio_ionico', [/(?:C[áa]lcio\s+I[ôo]ni(?:co|z[áa]vel)|Ca\s*\+\+|Ca2\+|iCa)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('cobre', [/(?:Cobre)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('manganes', [/(?:Mangan[êe]s)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('iodo_urinario', [/(?:Iodo\s+Urin[áa]rio)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('vitamina_e', [/(?:Vitamina\s+E)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('vitamina_b6', [/(?:Vitamina\s+B6|Piridoxina)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('vitamina_b1', [/(?:Vitamina\s+B1(?!\d)|Tiamina)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('fator_reumatoide', [/(?:Fator\s+Reumat[óo]ide|FR)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('anti_transglutaminase_iga', [/(?:Anti[- ]?Transglutaminase|tTG\s*IgA)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('g6pd', [/(?:G6PD|Glicose[- ]?6[- ]?Fosfato)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('chumbo', [/(?:Chumbo|PLUMBEMIA|Pb\s+SANGUE)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('mercurio', [/(?:Merc[úu]rio(?:\s+(?:Total|Sangue))?)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('cadmio', [/(?:C[áa]dmio)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('aluminio', [/(?:Alum[íi]nio)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('dihidrotestosterona', [/(?:Di?hidrotestosterona|DHT|D\.?H\.?T\.?|5[- ]?[Aa]lfa[- ]?DHT)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('androstenediona', [/(?:Androstenediona|Delta\s*4\s*Androstenediona)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('cortisol_livre_urina', [/(?:Cortisol\s+Livre.*?[Uu]rina|CLU|Cortisol\s+Urin[áa]rio)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('testosterona_biodisponivel', [/(?:Testosterona\s+Biodispon[ií]vel)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('anti_hbs', [/(?:Anti[- ]?HBs)[\s:.\-]*?([<>]?\s*\d+[.,]?\d*)/i]);
  tryGeneric('psa_total', [/(?:PSA\s+Total)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('psa_livre', [/(?:PSA\s+Livre)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('psa_relacao', [/(?:PSA\s+Livre\s*\/\s*Total|Rela[çc][ãa]o\s+PSA)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('urina_albumina', [/(?:Albumina\s*(?:\(urina\)|urin[áa]ria)|Microalbumin[úu]ria)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('urina_creatinina', [/(?:Creatinina\s*(?:\(urina\)|urin[áa]ria))[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('urina_acr', [/(?:Raz[ãa]o\s+Albumina\s*\/\s*Creatinina|RAC|ACR)[\s:.\-]*?(\d+[.,]?\d*)/i]);


  // URINA TIPO I — formato em colunas do Fleury
  // =============================================
  const urinaMatch = pdfText.match(/URINA\s+TIPO\s+I[\s\S]{0,5000}/i);
  if (urinaMatch) {
    const u = urinaMatch[0].substring(0, 3000);

    // BLOCO 1: EXAME FÍSICO (COR, ASPECTO, pH, DENSIDADE) — positional ": value"
    const fisicoMatch = u.match(
      /EXAME\s+F[IÍ]SICO[\s\S]{0,500}?(:\s*[^\n]+)\s*\n\s*(:\s*[^\n]+)\s*\n\s*(:\s*[^\n]+)\s*\n\s*(:\s*[^\n]+)/i
    );
    if (fisicoMatch) {
      const fisicoFields: [string, number, boolean][] = [
        ['urina_cor', 1, false], ['urina_aspecto', 2, false],
        ['urina_ph', 3, true], ['urina_densidade', 4, true]
      ];
      for (const [markerId, groupIdx, isNumeric] of fisicoFields) {
        if (!found.has(markerId)) {
          const val = fisicoMatch[groupIdx].replace(/^:\s*/, '').trim();
          if (val.length > 0 && val.length < 100) {
            if (isNumeric) {
              const num = parseBrNum(val);
              if (!isNaN(num)) {
                additional.push({ marker_id: markerId, value: num });
                found.add(markerId);
                console.log(`Regex fallback ${markerId}: ${num}`);
              }
            } else {
              additional.push({ marker_id: markerId, value: 0, text_value: val });
              found.add(markerId);
              console.log(`Regex fallback ${markerId}: "${val}"`);
            }
          }
        }
      }
    }

    // BLOCO 2: PROTEÍNAS a NITRITO — positional (6 valores em sequência)
    const protMatch = u.match(
      /PROTE[IÍ]NAS\s*\n\s*GLICOSE\s*\n[\s\S]{0,200}?(:\s*[^\n]+)\s*\n\s*(:\s*[^\n]+)\s*\n\s*(:\s*[^\n]+)\s*\n\s*(:\s*[^\n]+)\s*\n\s*(:\s*[^\n]+)\s*\n\s*(:\s*[^\n]+)/i
    );
    if (protMatch) {
      const protFields: [string, number][] = [
        ['urina_proteinas', 1], ['urina_glicose', 2], ['urina_cetona', 3],
        ['urina_bilirrubina', 4], ['urina_urobilinogenio', 5], ['urina_nitritos', 6]
      ];
      for (const [markerId, groupIdx] of protFields) {
        if (!found.has(markerId)) {
          const val = protMatch[groupIdx].replace(/^:\s*/, '').trim();
          if (val.length > 0 && val.length < 150) {
            additional.push({ marker_id: markerId, value: 0, text_value: val });
            found.add(markerId);
            console.log(`Regex fallback ${markerId}: "${val}"`);
          }
        }
      }
    }

    // BLOCO 3: ELEMENTOS FIGURADOS (label: value ou label\n: value)
    const elemFields: [string, RegExp][] = [
      ['urina_celulas', /C[EÉ]LULAS\s+EPITELIAIS\s*:\s*([^\n]+)/i],
      ['urina_leucocitos', /LEUC[OÓ]CITOS\s*\n\s*:\s*([^\n]+)/i],
      ['urina_hemacias', /ERITR[OÓ]CITOS\s*\n\s*:\s*([^\n]+)/i],
      ['urina_cilindros', /CILINDROS\s*\n\s*:\s*([^\n]+)/i],
    ];
    for (const [markerId, pattern] of elemFields) {
      if (!found.has(markerId)) {
        const match = u.match(pattern);
        if (match && match[1]) {
          const val = match[1].trim();
          if (val.length > 0 && val.length < 150) {
            additional.push({ marker_id: markerId, value: 0, text_value: val });
            found.add(markerId);
            console.log(`Regex fallback ${markerId}: "${val}"`);
          }
        }
      }
    }
  }

  // Fallback genérico de urina para labs não-Fleury
  if (/(?:URINA\s+TIPO|EAS|URIN[ÁA]LISE|PARCIAL\s+DE\s+URINA|URINA\s+ROTINA|URINA\s+I\b)/i.test(pdfText)) {
    if (!found.has('urina_densidade')) {
      const m = pdfText.match(/(?:Densidade)[\s:.\-]*?(1[.,]0\d{2})/i);
      if (m) { processValue('urina_densidade', m[1]); }
    }
    if (!found.has('urina_ph')) {
      const m = pdfText.match(/(?:pH\s*(?:Urin[áa]rio)?)[\s:.\-]*?(\d[.,]?\d?)/i);
      if (m) { processValue('urina_ph', m[1]); }
    }

    const urinaQualMap: [string, RegExp][] = [
      ['urina_cor', /(?:Cor)\s*[:.]\s*(amarelo?\s*(?:claro|citrino|escuro)?|[âa]mbar|[^\n]{3,30})/i],
      ['urina_aspecto', /(?:Aspecto)\s*[:.]\s*(l[íi]mpido|turvo|ligeiramente\s+turvo|[^\n]{3,30})/i],
      ['urina_proteinas', /(?:Prote[íi]nas?)\s*[:.]\s*(negativ[oa]|inferior\s+a\s+[\d,\.]+\s*[^\n]*|ausente|tra[çc]os|[^\n]{3,40})/i],
      ['urina_glicose', /(?:Glicose)\s*[:.]\s*(negativ[oa]|inferior\s+a\s+[\d,\.]+\s*[^\n]*|ausente|normal|[^\n]{3,40})/i],
      ['urina_hemoglobina', /(?:Hemoglobina|Sangue)\s*[:.]\s*(negativ[oa]|positiv[oa]|ausente|tra[çc]os|[^\n]{3,30})/i],
      ['urina_leucocitos', /(?:Leuc[óo]citos|Esterase)\s*[:.]\s*([^\n]{3,50})/i],
      ['urina_hemacias', /(?:Hem[áa]cias|Eritr[óo]citos)\s*[:.]\s*([^\n]{3,50})/i],
      ['urina_bacterias', /(?:Bact[ée]rias)\s*[:.]\s*(ausentes?|raras?|numerosas?|[^\n]{3,30})/i],
      ['urina_celulas', /(?:C[éeÉE]lulas?\s+Epiteliais?|Epiteliais?)\s*[:.]\s*(raras?|ausentes?|algumas|numerosas?|[^\n]{3,30})/i],
      ['urina_cilindros', /(?:Cilindros?)\s*[:.]\s*(ausentes?|raros?|presentes?|hialinos|[^\n]{3,30})/i],
      ['urina_cristais', /(?:Cristais?)\s*[:.]\s*(ausentes?|raros?|presentes?|[^\n]{3,30})/i],
      ['urina_nitritos', /(?:Nitritos?|NITRITO)\s*[:.]\s*(negativ[oa]|positiv[oa]|[^\n]{3,20})/i],
      ['urina_bilirrubina', /(?:Bilirrubina)\s*[:.]\s*(negativ[oa]|positiv[oa]|ausente|[^\n]{3,20})/i],
      ['urina_urobilinogenio', /(?:Urobilinog[êeÊE]nio)\s*[:.]\s*(normal|inferior\s+a\s+[\d,\.]+\s*[^\n]*|negativ[oa]|[^\n]{3,40})/i],
      ['urina_cetona', /(?:Ceton[ao]s?|Corpos?\s+Cet[ôo]nicos?)\s*[:.]\s*(negativ[oa]|positiv[oa]|ausente|[^\n]{3,20})/i],
      ['urina_muco', /(?:Muco|Filamentos?\s+(?:de\s+)?Muco)\s*[:.]\s*(ausente|presente|raros?|[^\n]{3,30})/i],
    ];
    for (const [id, regex] of urinaQualMap) {
      if (!found.has(id)) {
        const match = pdfText.match(regex);
        if (match && match[1]) {
          const val = match[1].trim();
          if (val.length > 0 && val.length < 100) {
            additional.push({ marker_id: id, value: 0, text_value: val });
            found.add(id);
            console.log(`Regex fallback ${id}: "${val}"`);
          }
        }
      }
    }
  }

   // === ELETROFORESE DE PROTEÍNAS: regex fallback for Fleury format ===
  // Fleury reports fractions in two columns (% and g/dL). PDF.js extracts them interleaved.
  // Pattern: "FractionName:\n%\nVALUE_PERCENT\n" — we capture the % value.
  // Sanity ranges for eletroforese fractions (to reject wrong values from regex)
  const eletSanity: Record<string, { min: number; max: number }> = {
    eletroforese_albumina: { min: 30, max: 80 },  // always the largest fraction
    eletroforese_alfa1:    { min: 1, max: 10 },
    eletroforese_alfa2:    { min: 4, max: 20 },
    eletroforese_beta1:    { min: 2, max: 12 },
    eletroforese_beta2:    { min: 1, max: 10 },
    eletroforese_gama:     { min: 5, max: 30 },
    proteinas_totais:      { min: 3, max: 12 },   // g/dL
  };
  if (!found.has('eletroforese_albumina') || !found.has('eletroforese_alfa1')) {
    const eletSection = pdfText.match(/ELETROFORESE DE PROTE[ÍI]NAS[\s\S]{0,3000}?(?=\n{4,}|LIPASE|COPROL[ÓO]GICO|COPROGRAMA|PARASITOL[ÓO]GICO|$)/i)?.[0];
    if (eletSection) {
      const eletMap: [string, RegExp[]][] = [
        // Multiple regex patterns per fraction to handle different Fleury PDF layouts
        ['eletroforese_albumina', [
          /Albumina\s*:\s*\n\s*%\s*\n\s*([\d,\.]+)/,       // standard: name \n % \n value
          /Albumina\s*:\s*\n\s*([5-9]\d[,\.]\d+)/,          // value starting with 5x-9x (50-79%)
          /Albumina\s*[:\s]+([5-9]\d[,\.]\d+)\s*%/,         // inline: "Albumina: 62.5%"
        ]],
        ['eletroforese_alfa1',    [/Alfa\s*1\s*:\s*\n\s*([\d,\.]+)/, /Alfa\s*1\s*[:\s]+([\d,\.]+)\s*%/]],
        ['eletroforese_alfa2',    [/Alfa\s*2\s*:\s*\n\s*([\d,\.]+)/, /Alfa\s*2\s*[:\s]+([\d,\.]+)\s*%/]],
        ['eletroforese_beta1',    [/Beta\s*1\s*:\s*\n\s*([\d,\.]+)/, /Beta\s*1\s*[:\s]+([\d,\.]+)\s*%/]],
        ['eletroforese_beta2',    [/Beta\s*2\s*:\s*\n\s*([\d,\.]+)/, /Beta\s*2\s*[:\s]+([\d,\.]+)\s*%/]],
        ['eletroforese_gama',     [/Gama\s*:\s*\n\s*([\d,\.]+)/, /Gama\s*[:\s]+([\d,\.]+)\s*%/]],
        ['proteinas_totais',      [/Prote[íi]nas\s+Totais\s*:\s*\n\s*([\d,\.]+)/, /Prote[íi]nas\s+Totais\s*[:\s]+([\d,\.]+)/]],
      ];
      for (const [id, regexList] of eletMap) {
        if (!found.has(id)) {
          for (const regex of regexList) {
            const m = eletSection.match(regex);
            if (m && m[1]) {
              const val = parseFloat(m[1].replace(',', '.'));
              const sanity = eletSanity[id];
              if (!isNaN(val) && (!sanity || (val >= sanity.min && val <= sanity.max))) {
                additional.push({ marker_id: id, value: val });
                found.add(id);
                console.log(`Eletroforese regex fallback ${id}: ${val}`);
                break; // first valid match wins
              } else if (!isNaN(val) && sanity) {
                console.log(`Eletroforese regex fallback ${id}: rejected ${val} (out of range ${sanity.min}–${sanity.max})`);
              }
            }
          }
        }
      }
    }
  }
  // === COPROLÓGICO: regex fallback for gordura fecal quantitativa (Sudam III) ===
  if (!found.has('copro_gordura_quant')) {
    // Fleury format: "Gorduras (Sudam III):\n7,0\n5% DE GORDURA FECAL"
    // OR: "5% DE GORDURA FECAL" directly after Sudam III section
    const gorduraMatch = pdfText.match(/(\d+(?:[,\.]\d+)?)\s*%\s*DE\s*GORDURA\s*FECAL/i)
      || pdfText.match(/Gorduras?\s*(?:\(Sudam\s*III\))?\s*[:\n]+\s*([\d,\.]+)\s*%/i);
    if (gorduraMatch && gorduraMatch[1]) {
      const val = parseFloat(gorduraMatch[1].replace(',', '.'));
      if (!isNaN(val)) {
        additional.push({ marker_id: 'copro_gordura_quant', value: val });
        found.add('copro_gordura_quant');
        console.log(`Gordura fecal quantitativa regex fallback: ${val}%`);
      }
    }
  }
  if (additional.length > 0) {
    console.log(`Regex fallback added ${additional.length} markers: ${additional.map(r => r.marker_id).join(', ')}`);
  }
  // === DIAGNOSTIC: log missing markers and check if exam names exist in PDF text ===
  const criticalMarkers: [string, string[]][] = [
    ['ferro_metabolismo', ['METABOLISMO DO FERRO', 'METABOLISMO DE FERRO']],
    ['vhs', ['HEMOSSEDIMENTA', 'VHS', 'V.H.S']],
    ['t4_total', ['TIROXINA (T4)', 'T4 TOTAL', 'T4, SORO']],
    ['amh', ['MULLERIANO', 'MÜLLERIANO', 'AMH', 'HAM']],
    ['fosforo', ['FOSFORO', 'FÓSFORO']],
    ['vitamina_d_125', ['1,25-DIHIDROXI', '1.25-DIHIDROXI', 'CALCITRIOL', 'DIHIDROXIVITAMINA']],
    ['estrona', ['ESTRONA']],
    ['aldosterona', ['ALDOSTERONA']],
    ['magnesio', ['MAGNESIO', 'MAGNÉSIO']],
    ['selenio', ['SELENIO', 'SELÊNIO']],
    ['cromo', ['CROMO']],
    ['fosfatase_alcalina', ['FOSFATASE ALCALINA', 'FOSFATASE']],
    ['sodio', ['SODIO', 'SÓDIO']],
    ['potassio', ['POTASSIO', 'POTÁSSIO']],
  ];
  const textUpper = pdfText.toUpperCase();
  for (const [markerId, searchTerms] of criticalMarkers) {
    if (!found.has(markerId)) {
      const foundTerm = searchTerms.find(t => textUpper.includes(t.toUpperCase()));
      if (foundTerm) {
        const idx = textUpper.indexOf(foundTerm.toUpperCase());
        const snippet = pdfText.substring(Math.max(0, idx - 20), Math.min(pdfText.length, idx + 200)).replace(/\n/g, '\\n');
        console.log(`MISSING ${markerId}: found "${foundTerm}" in PDF at pos ${idx}. Context: "${snippet}"`);
      } else {
        console.log(`MISSING ${markerId}: NOT found in PDF text (searched: ${searchTerms.join(', ')})`);
      }
    }
  }

  // Cross-check: for toxicology markers, verify the marker name actually appears in the PDF text
  // This prevents AI hallucinations where the model invents toxicology results not present in the document
  const toxMarkerTextTerms: Record<string, string[]> = {
    mercurio:  ['mercúrio', 'mercurio', 'mercury', 'hg sangue', 'hg, sangue'],
    aluminio:  ['alumínio', 'aluminio', 'aluminum', 'al, soro', 'al sérico'],
    cadmio:    ['cádmio', 'cadmio', 'cadmium', 'cd, sangue'],
    chumbo:    ['chumbo', 'plumbemia', 'lead', 'pb sangue'],
    arsenico:  ['arsênico', 'arsenico', 'arsenic', 'as, urina'],
    niquel:    ['níquel', 'niquel', 'nickel', 'ni, soro'],
    cobalto:   ['cobalto', 'cobalt', 'co, soro'],
  };
  const pdfTextLower = pdfText.toLowerCase();
  const crossChecked = [...aiResults, ...additional].filter(r => {
    const terms = toxMarkerTextTerms[r.marker_id];
    if (terms) {
      const foundInText = terms.some(t => pdfTextLower.includes(t));
      if (!foundInText) {
        console.log(`CROSS-CHECK: discarding ${r.marker_id} = ${r.value} — marker name NOT found in PDF text (hallucination)`);
        return false;
      }
    }
    return true;
  });

  // Plausibility validation for toxicology markers — discard implausible values
  const toxPlausibility: Record<string, number> = {
    mercurio: 100,    // µg/L — values above 100 are almost certainly false positives
    aluminio: 200,    // µg/L
    cadmio: 50,       // µg/L
    chumbo: 100,      // µg/dL
    cobalto: 50,      // µg/L
    arsenico: 500,    // µg/L
    niquel: 100,      // µg/L
  };
  const filtered = crossChecked.filter(r => {
    const maxPlausible = toxPlausibility[r.marker_id];
    if (maxPlausible !== undefined && r.value !== undefined && r.value !== null && r.value > maxPlausible) {
      console.log(`Plausibility filter: discarding ${r.marker_id} = ${r.value} (max plausible: ${maxPlausible})`);
      return false;
    }
    return true;
  });
  return filtered;
}


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfText, patientSex } = await req.json();
    if (!pdfText || typeof pdfText !== "string") {
      return new Response(JSON.stringify({ error: "pdfText is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const textToSend = pdfText.slice(0, 200000);
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
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Extract ALL lab results from this Brazilian lab report. Target: 95+ markers. Be EXHAUSTIVE — do not skip ANY marker.

⚠️ MANDATORY: For EVERY marker, you MUST include lab_ref_text with the reference range from the report!
Example: hemoglobina value=13.4, lab_ref_text="11.7 a 14.9"

STEP-BY-STEP APPROACH:
1. First, normalize the text: remove accents, dots from abbreviations, replace Greek letters
2. Identify all panels/sections (Hemograma, Lipídios, Bilirrubinas, Ferro, Eletroforese, Urina, Fezes, Marcadores Tumorais, etc.)
3. For each panel, extract EVERY sub-item individually
4. For standalone exams, match against aliases
5. Apply unit conversions where needed
6. For material = urine/stool, still extract (cortisol_livre_urina, urina_*, copro_*)
7. CRITICAL: For values with "<" or ">" operators, set BOTH value AND text_value
8. CRITICAL: For EVERY marker, capture the lab reference range in lab_ref_text!

COMMONLY MISSED — search EXPLICITLY for each of these:
- Hemograma: Bastonetes/Bastões, Segmentados, VPM/V.P.M./MPV
- Coagulação: Fibrinogênio (may say "CLAUSS" or "g/L"→×100)
- Pancreáticos: Amilase/α-Amilase, Lipase
- Lipídios avançados: Apo A-1, Apo B, Lp(a), Colesterol Não-HDL, CT/HDL, TG/HDL, ApoB/ApoA1
- Ferro: TIBC/CTFF/Capacidade Ferropéxica Total, Transferrina, Sat. Transferrina
- Tireoide: T4 Total, T3 Total, TRAb (often "< 1.0")
- Hormônios: Estrona (E1), AMH
- Eletrólitos: Calcitonina (often "< 1.0")
- Marcadores Tumorais: CA 19-9, CA-125, CA 72-4 (often "< 2.5"), CA 15-3, AFP, CEA
- Eixo GH: IGF-1/Somatomedina C, IGFBP-3 (ng/mL÷1000=µg/mL)
- Eixo Adrenal: ACTH/A.C.T.H., Cortisol Urina 24h, Aldosterona
- Andrógenos: DHT/D.H.T./Dihidrotestosterona, Androstenediona
- Vitaminas: 25-OH Vit D (vitamina_d) AND 1,25-Dihidroxi (vitamina_d_125) — TWO DIFFERENT markers!
- Renal: TFGe/eGFR (often sub-item of Creatinina), Cistatina C
- Hepático: Bilirrubina Indireta (may be calculated), LDH, Fosfatase Alcalina
- Toxicologia: Chumbo/Plumbemia, Mercúrio, Cádmio, Alumínio
- Imunologia: FAN (qualitative — text_value!)
- Eletroforese: ALL fractions (Albumina%, Alfa1%, Alfa2%, Beta1%, Beta2%, Gama%, A/G)
- Urina Tipo 1/EAS: ALL sub-items as qualitative
- Coprológico: ALL sub-items as qualitative

OPERATOR VALUES (CRITICAL):
- Anti-TPO often comes as "< 34" → value=34, text_value="< 34"
- TRAb often comes as "< 1.0" → value=1.0, text_value="< 1.0"
- Anti-TG often comes as "< 1.3" → value=1.3, text_value="< 1.3"
- Calcitonina often comes as "< 1.0" → value=1.0, text_value="< 1.0"
- CA 72-4 often comes as "< 2.5" → value=2.5, text_value="< 2.5"
- AFP often comes as "< 1.0" → value=1.0, text_value="< 1.0"

REFERENCE RANGES (MANDATORY FOR EVERY MARKER):
For EVERY marker, include lab_ref_text. Examples:
- eritrocitos: lab_ref_text = "3,83 a 4,99"
- hemoglobina: lab_ref_text = "11,7 a 14,9"
- leucocitos: lab_ref_text = "3.470 a 8.290"
- anti_tpo: lab_ref_text = "Inferior a 34"

Search the ENTIRE text from first to last line. Do NOT stop early.\n\n${textToSend}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_results",
              description: "Return extracted lab marker values mapped to their IDs. Use 'value' for numeric results and 'text_value' for qualitative/text results. IMPORTANT: For values with operators like '<' or '>', set BOTH value (numeric part) AND text_value (full string with operator). Also capture the lab reference range from the report in lab_ref_text.",
              parameters: {
                type: "object",
                properties: {
                  exam_date: {
                    type: "string",
                    description: "Date the exams were collected/performed, in YYYY-MM-DD format. Look for: 'Data de coleta', 'Data da coleta', 'Data do exame', 'Realizado em', 'Emitido em', 'Data de emissão', 'Coleta:', 'Data:'. Return null if not found."
                  },
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        marker_id: { type: "string", description: "The marker ID from the known list" },
                        value: { type: "number", description: "The numeric value extracted (use 0 for qualitative markers, use the numeric part for operator values like '< 34' \u2192 34)" },
                        text_value: { type: "string", description: "The text result for qualitative markers (e.g. 'Negativo', 'Ausente') OR for operator values (e.g. '< 34', '< 1.0', '> 90')" },
                        lab_ref_text: { type: "string", description: "The reference range as printed in the lab report (e.g. '13.5 a 17.5', '70 a 99', '< 34', 'Nao reagente'). Copy EXACTLY as shown in the report. Leave empty if not found." },
                      },
                      required: ["marker_id"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["results"],
                additionalProperties: false,
                // exam_date is optional — not in required to avoid breaking existing behavior
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
    let validResults = (parsed.results || []).filter((r: any) => {
      if (!validIds.has(r.marker_id)) return false;
      // Qualitative markers: need text_value
      if (QUALITATIVE_IDS.has(r.marker_id)) {
        return typeof r.text_value === "string" && r.text_value.length > 0;
      }
      // Numeric markers: need valid number (may also have text_value for operator values)
      return typeof r.value === "number" && !isNaN(r.value);
    });
     // Normalize Portuguese operator text ("inferior a" \u2192 "<")
    validResults = normalizeOperatorText(validResults);
    // Deduplicate (prefer calculated values over operator values for same marker)
    validResults = deduplicateResults(validResults);
    // Validate and fix common decimal/unit errors
    validResults = validateAndFixValues(validResults, patientSex);
    // Post-process: calculate derived values if AI missed them
    validResults = postProcessResults(validResults);
    // Regex fallback for markers the AI frequently misses
    const beforeFallbackIds = new Set(validResults.map((r: any) => r.marker_id));
    validResults = regexFallback(pdfText, validResults);
    // Validate fallback-added markers
    const fallbackAdded = validResults.filter((r: any) => !beforeFallbackIds.has(r.marker_id));
    if (fallbackAdded.length > 0) {
      console.log(`Regex fallback added ${fallbackAdded.length} markers: ${fallbackAdded.map((r: any) => r.marker_id).join(', ')}`);
      // Re-run validation only on fallback markers, then merge back
      const fallbackValidated = validateAndFixValues(fallbackAdded, patientSex);
      // Re-run derived calculations with full set (e.g. bilirrubina indireta, HOMA-IR)
      validResults = postProcessResults(validResults);
    }
    // Parse lab_ref_text into numeric min/max fields
    validResults = parseLabRefRanges(validResults);
    // Convert lab_ref units to match the stored value units (e.g. pmol/L → ng/dL for testosterona_livre)
    validResults = convertLabRefUnits(validResults);
    // Extract exam_date from parsed response
    let examDate: string | null = (typeof parsed.exam_date === "string" && parsed.exam_date.match(/^\d{4}-\d{2}-\d{2}$/))
      ? parsed.exam_date
      : null;

    // Regex fallback for exam date from raw PDF text
    if (!examDate) {
      const datePatterns = [
        /(?:Data\s+d[aeo]\s+[Cc]olet[ao]|Colet(?:a|ado)|Realizado\s+em|Data\s+d[oe]\s+[Ee]xame|Data\s+da\s+[Ff]icha|RECEBIDO.*?COLETADO)[:\s]*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i,
        /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})(?=\s+\d{1,2}:\d{2})/,
      ];
      for (const pattern of datePatterns) {
        const match = pdfText.match(pattern);
        if (match) {
          const [, dd, mm, yyyy] = match;
          const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
          const candidate = `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
          if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
            examDate = candidate;
            break;
          }
        }
      }
    }

    console.log(`Extracted ${validResults.length} valid markers:`, validResults.map((r: any) => r.marker_id).join(', '));
    if (examDate) console.log(`Exam date extracted: ${examDate}`);
    return new Response(JSON.stringify({ results: validResults, exam_date: examDate }), {
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
