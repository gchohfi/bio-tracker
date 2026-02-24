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
  { id: "testosterona_livre", name: "Testosterona Livre", unit: "pg/mL" },
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
  { id: "fan", name: "FAN (Fator Anti-Núcleo)", unit: "", qualitative: true },
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
  { id: "urina_hemacias", name: "Hemácias (urina)", unit: "/campo", qualitative: true },
  { id: "urina_bacterias", name: "Bactérias (urina)", unit: "", qualitative: true },
  { id: "urina_celulas", name: "Células Epiteliais (urina)", unit: "", qualitative: true },
  { id: "urina_cilindros", name: "Cilindros (urina)", unit: "", qualitative: true },
  { id: "urina_cristais", name: "Cristais (urina)", unit: "", qualitative: true },
  { id: "urina_nitritos", name: "Nitritos (urina)", unit: "", qualitative: true },
  { id: "urina_bilirrubina", name: "Bilirrubina (urina)", unit: "", qualitative: true },
  { id: "urina_urobilinogenio", name: "Urobilinogênio (urina)", unit: "", qualitative: true },
  { id: "urina_cetona", name: "Cetonas (urina)", unit: "", qualitative: true },
  { id: "urina_muco", name: "Muco/Filamentos (urina)", unit: "", qualitative: true },
  // Qualitative markers - Coprológico
  { id: "copro_cor", name: "Cor (fezes)", unit: "", qualitative: true },
  { id: "copro_consistencia", name: "Consistência (fezes)", unit: "", qualitative: true },
  { id: "copro_muco", name: "Muco (fezes)", unit: "", qualitative: true },
  { id: "copro_sangue", name: "Sangue Oculto (fezes)", unit: "", qualitative: true },
  { id: "copro_leucocitos", name: "Leucócitos (fezes)", unit: "", qualitative: true },
  { id: "copro_hemacias", name: "Hemácias (fezes)", unit: "", qualitative: true },
  { id: "copro_parasitas", name: "Parasitas (fezes)", unit: "", qualitative: true },
  { id: "copro_gordura", name: "Gordura Fecal", unit: "", qualitative: true },
  { id: "copro_fibras", name: "Fibras Musculares (fezes)", unit: "", qualitative: true },
  { id: "copro_amido", name: "Amido (fezes)", unit: "", qualitative: true },
  { id: "copro_residuos", name: "Resíduos Alimentares (fezes)", unit: "", qualitative: true },
  { id: "copro_ac_graxos", name: "Ácidos Graxos (fezes)", unit: "", qualitative: true },
  { id: "copro_flora", name: "Flora Bacteriana (fezes)", unit: "", qualitative: true },
  { id: "copro_ph", name: "pH Fecal", unit: "" },
];

const QUALITATIVE_IDS = new Set(MARKER_LIST.filter(m => (m as any).qualitative).map(m => m.id));

const systemPrompt = `You are an expert lab result extraction assistant for Brazilian labs (Fleury, DASA, Hermes Pardini, Confiance, Einstein, Lavoisier, DB, Oswaldo Cruz, etc.).

Your task: extract ALL values (numeric AND qualitative) from the PDF text and map them to known marker IDs. Be EXHAUSTIVE.

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
PERFIL DE FERRO panel → extract ALL: ferro_serico, ferritina, transferrina, sat_transferrina, tibc
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
- "Hemácias" / "Glóbulos Vermelhos" → eritrocitos
- "Glóbulos Brancos" → leucocitos
- "Segmentados" / "Neutrófilos Segmentados" / "SEGS" → segmentados
- "Bastonetes" / "Bastões" / "BASTOES" / "Neutrófilos Bastonetes" / "BAND" → bastonetes
- "VPM" / "V.P.M." / "MPV" / "Volume Plaquetário Médio" / "MEAN PLATELET VOLUME" → vpm

COAGULAÇÃO:
- "FIBRINOGÊNIO" / "FIBRINOGENIO" / "FIBRINOGÊNIO FUNCIONAL" / "FIBRINOGÊNIO - CLAUSS" / "FIBRINOGÊNIO DERIVADO" / "Fator I" → fibrinogenio
  Units: mg/dL. If g/L → ×100.
- "DÍMEROS D" / "D-DÍMERO" / "D-Dímero" → dimeros_d

PANCREÁTICOS:
- "AMILASE" / "α-AMILASE" / "ALFA-AMILASE" / "AMS" / "AMILASE PANCREÁTICA" → amilase
- "LIPASE" / "LPS" / "LIPASE SÉRICA" → lipase

LIPÍDIOS:
- "Colesterol HDL" / "HDL-Colesterol" → hdl
- "Colesterol LDL" / "LDL-Colesterol" → ldl
- "Colesterol não-HDL" / "NÃO-HDL" / "NÃO HDL" / "NON-HDL" → colesterol_nao_hdl
- "APOLIPOPROTEÍNA A-1" / "APO A1" / "APO A-1" / "APO A-I" / "APO A" / "APOPROTEÍNA A1" → apo_a1
- "APOLIPOPROTEÍNA B" / "APO B" / "APO B100" / "APO B-100" → apo_b
- "LIPOPROTEINA(a)" / "Lp(a)" / "LP(A)" / "LPA" → lipoproteina_a
  Units: nmol/L. If mg/dL → ×2.15.
- "CT/HDL" / "Índice de Castelli" → relacao_ct_hdl
- "TG/HDL" → relacao_tg_hdl
- "ApoB/ApoA1" / "Razão ApoB/ApoA1" / "Relação ApoB/ApoA-I" / "Apo B/Apo A1" / "Relação Apolipoproteína B / Apolipoproteína A-I" → relacao_apob_apoa1

TIREOIDE:
- "TSH Ultra-sensível" / "Tirotropina" / "TSH" → tsh
- "T4L" / "Tiroxina Livre" / "T4 LIVRE" → t4_livre
- "T4 Total" / "Tiroxina Total" / "Tiroxina (T4) - Total" → t4_total
- "T3L" / "Triiodotironina Livre" / "T3 LIVRE" → t3_livre (unit: ng/dL — do NOT convert)
- "T3 Total" / "Triiodotironina Total" / "Triiodotironina (T3) - Total" → t3_total
- "T3 Reverso" / "T3R" / "REVERSE T3" → t3_reverso
- "ANTICORPO ANTI TPO" / "Anti-TPO" / "ANTI TPO" → anti_tpo
- "ANTICORPOS ANTI TIREOGLOBULINA" / "Anti-TG" → anti_tg
- "TRAb" / "TRAB" / "Anticorpo Anti-Receptor de TSH" / "Anti-receptor de TSH" / "Anti receptor TSH" / "Anticorpos Anti Receptores de TSH" → trab

HORMÔNIOS:
- "Testosterona Total" → testosterona_total
- "Testosterona Livre" → testosterona_livre. If pmol/L → ×0.28842 to get pg/mL. If ng/dL → ×10.
- "Estradiol" → estradiol. If ng/dL → ×10 to get pg/mL.
- "Estrona" / "E1" / "Estrona (E1)" / "Estrona, soro" → estrona
- "Progesterona" → progesterona. If ng/dL → ÷100 to get ng/mL.
- "DHEA-S" / "SDHEA" / "S-DHEA" / "Sulfato de Dehidroepiandrosterona" → dhea_s
- "Cortisol" / "CORTISOL MATINAL" (blood) → cortisol
- "SHBG" / "Globulina Ligadora" / "S H B G" → shbg
- "FSH" / "HORMÔNIO FOLÍCULO ESTIMULANTE" → fsh
- "LH" / "HORMÔNIO LUTEINIZANTE" → lh
- "Prolactina" → prolactina
- "AMH" / "Hormônio Anti-Mülleriano" / "Hormonio Anti-Mulleriano" / "Anti-Müllerian Hormone" / "HAM" → amh

EIXO GH:
- "IGF-1" / "IGF1" / "IGF I" / "IGF 1" / "SOMATOMEDINA C" / "SOMATOMEDINA-C" / "IGF 1- SOMATOMEDINA C" / "FATOR DE CRESCIMENTO INSULINA-SÍMILE" → igf1
- "IGFBP-3" / "IGFBP3" / "IGF BP3" / "PROTEÍNA LIGADORA 3 DO IGF" / "PROTEINA LIGADORA DE IGF TIPO 3" / "IGFBP-3 PROTEÍNA LIGADORA -3 DO IGF" → igfbp3
  ⚠️ If in ng/mL → ÷1000 to get µg/mL. Example: 6120 ng/mL → 6.12 µg/mL.

EIXO ADRENAL:
- "ACTH" / "A.C.T.H." / "HORMÔNIO ADRENOCORTICOTRÓFICO" / "HORMÔNIO ADRENOCORTICOTRÓFICO A.C.T.H." / "CORTICOTROFINA" / "ADRENOCORTICOTROFINA" → acth
- "CORTISOL LIVRE, URINA DE 24 HORAS" / "CORTISOL LIVRE URINÁRIO" / "CORTISOL URINÁRIO" / "CORTISOL LIVRE - URINA 24H" / "CORTISOL, URINA" → cortisol_livre_urina
  ⚠️ Material is URINE not blood! mcg/24 HORAS = µg/24h.
- "ALDOSTERONA" / "ALDOSTERONA SÉRICA" / "ALDOSTERONA - SENTADO" / "ALDOSTERONA - DEITADO" / "ALDOSTERONA - EM PÉ" → aldosterona
  Units: ng/dL. If pg/mL → ÷10.

ANDRÓGENOS:
- "DIHIDROTESTOSTERONA" / "DHT" / "D.H.T." / "5-ALFA-DIHIDROTESTOSTERONA" / "5α-DIHIDROTESTOSTERONA" → dihidrotestosterona
  Units: pg/mL. If ng/dL → ×10.
- "ANDROSTENEDIONA" → androstenediona (ng/dL)

VITAMINAS:
- "25 HIDROXI VITAMINA D" / "25-OH" / "CALCIDIOL" / "25(OH)D" / "Vitamina D3" → vitamina_d (ng/mL)
- "1,25 DIHIDROXI" / "1.25 DIHIDROXI" / "CALCITRIOL" / "1,25(OH)2D" → vitamina_d_125 (pg/mL)
- "Vitamina B12" → vitamina_b12. ng/L = pg/mL.
- "Ácido Fólico" / "Folato" → acido_folico
- "Retinol" / "Vitamina A" → vitamina_a
- "Vitamina E" → vitamina_e
- "Ácido Ascórbico" / "Vitamina C" → vitamina_c
- "Vitamina B6" → vitamina_b6
- "Vitamina B1" → vitamina_b1
- "Homocisteína" → homocisteina

MINERAIS:
- "Magnésio" → magnesio
- "Zinco" → zinco. If µg/mL → ×100 to get µg/dL.
- "Selênio" → selenio
- "Cobre" → cobre
- "Manganês" → manganes
- "Cromo" → cromo
- "Iodo Urinário" → iodo_urinario

TOXICOLOGIA:
- "CHUMBO" / "PLUMBEMIA" / "Pb SANGUE" / "CHUMBO (Pb)" / "LEAD" → chumbo. If µg/L → ÷10 to get µg/dL.
- "MERCURIO" / "Mercúrio" → mercurio
- "CADMIO" / "Cádmio" → cadmio
- "ALUMINIO" / "Alumínio" → aluminio

HEPÁTICO:
- "AST" / "TGO" / "GOT" / "GOT/AST" / "TRANSAMINASE GLUTÂMICO OXALACÉTICA" → tgo_ast
- "ALT" / "TGP" / "GPT" / "GPT/ALT" / "TRANSAMINASE GLUTÂMICO PIRÚVICA" → tgp_alt
- "Gama GT" / "γ-GT" / "GGT" / "Gama Glutamil" → ggt
- "Fosfatase Alcalina" / "FA" → fosfatase_alcalina
- "Bilirrubina Total" → bilirrubina_total
- "Bilirrubina Direta" / "Conjugada" → bilirrubina_direta
- "Bilirrubina Indireta" / "Não Conjugada" / "CALCULADA" → bilirrubina_indireta
- "Albumina" (standalone, not electrophoresis) → albumina
- "Proteínas Totais" → proteinas_totais
- "LDH" / "Desidrogenase Láctica" → ldh

RENAL:
- "Creatinina" → creatinina
- "Ureia" → ureia
- "Ácido Úrico" → acido_urico
- "Clearance" / "Filtração Glomerular" / "CKD-EPI" / "TFG ESTIMADA" / "TFGe" / "eGFR" / "MDRD" → tfg
  Often appears as sub-item of creatinine.
- "Cistatina C" → cistatina_c

ELETRÓLITOS:
- "Sódio" → sodio
- "Potássio" → potassio
- "Cálcio Total" → calcio_total
- "Cálcio Ionizável" / "Cálcio Iônico" / "Cálcio ionizado" → calcio_ionico (mmol/L)
- "Fósforo" → fosforo
- "Cloro" / "CLORETO" → cloro
- "Bicarbonato" / "CO2 Total" → bicarbonato
- "PTH Intacto" / "Paratormônio" → pth
- "Calcitonina" / "Calcitonina, soro" → calcitonina

FERRO:
- "Ferro Sérico" → ferro_serico
- "Ferritina" → ferritina. microg/L = ng/mL.
- "Transferrina" → transferrina
- "Saturação de Transferrina" / "Índice de Saturação" → sat_transferrina
- "TIBC" / "Capacidade Total de Fixação do Ferro" / "CTFF" / "Capacidade Total de Ligação do Ferro" / "Capacidade Ferropéxica Total" / "CTLF" → tibc
  If µmol/L → ÷0.179.
- "UIBC" / "Capacidade livre de fixação" / "CLFF" → IGNORE (NOT TIBC)

INFLAMAÇÃO:
- "PCR ultra-sensível" / "PCR-us" / "Proteína C Reativa" → pcr. If mg/dL → ×10 to get mg/L.
- "VHS" / "V.H.S." / "Velocidade de Hemossedimentação" → vhs

IMUNOLOGIA:
- "FAN" / "FAN - FATOR ANTI-NÚCLEO" / "FATOR ANTINÚCLEO" / "ANA" / "FAN (HEP-2)" / "PESQUISA DE FAN" → fan
  QUALITATIVE! Use text_value. Set value=0.

MARCADORES TUMORAIS:
- "CA 19-9" / "CA 19.9" / "Antígeno CA 19-9" / "Antigeno Carboidrato 19-9" / "CA19-9" → ca_19_9
- "CA-125" / "CA 125" / "Antígeno CA-125" / "Antigeno CA 125" → ca_125
- "CA 72-4" / "CA 72.4" / "Antígeno CA 72-4" / "CA72-4" → ca_72_4
- "CA 15-3" / "CA 15.3" / "Antígeno CA 15-3" / "CA15-3" → ca_15_3
- "AFP" / "Alfafetoproteína" / "Alfa-fetoproteína" / "Alfa Feto Proteína" / "Alpha-Fetoprotein" → afp
- "CEA" / "Antígeno Carcinoembrionário" / "Antigeno Carcinoembrionario" / "Carcinoembryonic Antigen" → cea

ELETROFORESE DE PROTEÍNAS:
- Within the electrophoresis section, extract each fraction using % values:
  Albumina→eletroforese_albumina, Alfa-1→eletroforese_alfa1, Alfa-2→eletroforese_alfa2,
  Beta-1→eletroforese_beta1, Beta-2→eletroforese_beta2, Gamaglobulina→eletroforese_gama, A/G→relacao_ag

URINA TIPO 1 / EAS:
- "URINA TIPO 1" / "EAS" / "URINA ROTINA" / "PARCIAL DE URINA" / "URINÁLISE" / "URINA TIPO I" → extract ALL sub-items as qualitative
- Sub-items: urina_cor, urina_aspecto, urina_densidade, urina_ph, urina_proteinas, urina_glicose, urina_hemoglobina, urina_leucocitos, urina_hemacias, urina_bacterias, urina_celulas, urina_cilindros, urina_cristais, urina_nitritos, urina_bilirrubina, urina_urobilinogenio, urina_cetona, urina_muco
- "Muco" / "Filamentos de Muco" / "Filamentos Mucóides" (in urina context) → urina_muco
- "Corpos Cetônicos" / "Cetonas" / "Acetona" → urina_cetona
- "Leucócito Esterase" / "Esterase Leucocitária" → urina_leucocitos
- "Sangue" / "Blood" (in urina fita context) → urina_hemoglobina

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
- Brazilian decimals: comma → dot ("4,37" → 4.37).
- Thousands separator: "6.500" for leucocitos → 6500.
- For Plaquetas: "336 mil/mm³" → 336.
- For Eritrócitos: "3,8 milhões" → 3.8.
- For Leucócitos: small value like "3,9" in thousands → 3900.
- For T3 Livre: the standard unit is ng/dL. Do NOT convert. Most Brazilian labs report in ng/dL.
- CRITICAL: For values with operators ("<", ">", "<=", ">="): set BOTH "value" (numeric part) AND "text_value" (full string with operator).
- "Inferior a X" → value=X, text_value="< X"
- "Superior a X" → value=X, text_value="> X"
- For NUMERIC markers without operators: return number in 'value' only.
- For QUALITATIVE markers (fan, urina_*, copro_*): return text in 'text_value', set value=0.
- If marker appears multiple times: use FIRST occurrence (actual result, not historical).
- mcg = µg. mcg/dL = µg/dL, mcg/L = µg/L.
- DO NOT filter by material type — extract from blood, urine, and stool sections.`;


// Post-processing: validate values and fix common decimal/unit errors
function validateAndFixValues(results: any[]): any[] {
  // Known ranges for sanity checks (marker_id → [absMin, absMax, expectedUnit])
  // If value is outside absMin-absMax, it's likely a decimal separator error
  const sanityRanges: Record<string, { min: number; max: number; fix?: (v: number) => number; label?: string }> = {
    leucocitos: { min: 1000, max: 30000, fix: (v) => v < 100 ? v * 1000 : v, label: "leucocitos: small value → ×1000" },
    eritrocitos: { min: 1, max: 10, fix: (v) => v > 100 ? v / 1000000 : v > 10 ? v / 10 : v },
    plaquetas: { min: 50, max: 600, fix: (v) => v > 1000 ? v / 1000 : v },
    progesterona: { min: 0, max: 50, fix: (v) => v > 50 ? v / 100 : v, label: "progesterona: large value → ÷100" },
    igfbp3: { min: 0.5, max: 15, fix: (v) => v > 100 ? v / 1000 : v, label: "igfbp3: ng/mL → µg/mL ÷1000" },
    dihidrotestosterona: { min: 5, max: 2000, fix: (v) => v < 50 ? v * 10 : v, label: "DHT: small value → ×10" },
    hemoglobina: { min: 5, max: 25 },
    hematocrito: { min: 20, max: 65 },
    glicose_jejum: { min: 40, max: 500 },
    insulina_jejum: { min: 0.5, max: 100 },
    creatinina: { min: 0.1, max: 15 },
    tsh: { min: 0.01, max: 100 },
    t4_livre: { min: 0.1, max: 5 },
    t3_livre: { min: 0.1, max: 2, fix: (v) => v > 2 ? v / 10 : v },
    colesterol_total: { min: 50, max: 500 },
    hdl: { min: 10, max: 150 },
    ldl: { min: 10, max: 400 },
    triglicerides: { min: 20, max: 2000 },
    ferritina: { min: 1, max: 2000 },
    vitamina_d: { min: 3, max: 200 },
    vitamina_b12: { min: 50, max: 3000 },
    testosterona_total: { min: 1, max: 2000 },
    estradiol: { min: 1, max: 5000 },
    cortisol: { min: 0.5, max: 50 },
    albumina: { min: 1, max: 8 },
    acido_urico: { min: 0.5, max: 15 },
    calcio_total: { min: 5, max: 15 },
  };

  for (const r of results) {
    if (typeof r.value !== "number" || r.text_value) continue; // skip qualitative/operator
    const range = sanityRanges[r.marker_id];
    if (!range || !range.fix) continue;
    if (r.value < range.min || r.value > range.max) {
      const original = r.value;
      r.value = range.fix(r.value);
      // Re-check if still out of range, revert if fix made it worse
      if (r.value < range.min * 0.5 || r.value > range.max * 2) {
        r.value = original; // revert
      } else {
        console.log(`Fixed ${r.marker_id}: ${original} → ${r.value} (${range.label || 'decimal fix'})`);
      }
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

  return results;
}


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
            content: `Extract ALL lab results from this Brazilian lab report. Target: 95+ markers. Be EXHAUSTIVE — do not skip ANY marker.

STEP-BY-STEP APPROACH:
1. First, normalize the text: remove accents, dots from abbreviations, replace Greek letters
2. Identify all panels/sections (Hemograma, Lipídios, Bilirrubinas, Ferro, Eletroforese, Urina, Fezes, Marcadores Tumorais, etc.)
3. For each panel, extract EVERY sub-item individually
4. For standalone exams, match against aliases
5. Apply unit conversions where needed
6. For material = urine/stool, still extract (cortisol_livre_urina, urina_*, copro_*)
7. CRITICAL: For values with "<" or ">" operators, set BOTH value AND text_value

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

Search the ENTIRE text from first to last line. Do NOT stop early.\n\n${textToSend}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_results",
              description: "Return extracted lab marker values mapped to their IDs. Use 'value' for numeric results and 'text_value' for qualitative/text results. IMPORTANT: For values with operators like '<' or '>', set BOTH value (numeric part) AND text_value (full string with operator).",
              parameters: {
                type: "object",
                properties: {
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        marker_id: { type: "string", description: "The marker ID from the known list" },
                        value: { type: "number", description: "The numeric value extracted (use 0 for qualitative markers, use the numeric part for operator values like '< 34' → 34)" },
                        text_value: { type: "string", description: "The text result for qualitative markers (e.g. 'Negativo', 'Ausente') OR for operator values (e.g. '< 34', '< 1.0', '> 90')" },
                      },
                      required: ["marker_id"],
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
    let validResults = (parsed.results || []).filter((r: any) => {
      if (!validIds.has(r.marker_id)) return false;
      // Qualitative markers: need text_value
      if (QUALITATIVE_IDS.has(r.marker_id)) {
        return typeof r.text_value === "string" && r.text_value.length > 0;
      }
      // Numeric markers: need valid number (may also have text_value for operator values)
      return typeof r.value === "number" && !isNaN(r.value);
    });
    
    // Validate and fix common decimal/unit errors
    validResults = validateAndFixValues(validResults);
    // Post-process: calculate derived values if AI missed them
    validResults = postProcessResults(validResults);
    
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
