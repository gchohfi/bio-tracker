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
  { id: "dimeros_d", name: "Dímeros D", unit: "ng/mL" },
  { id: "amilase", name: "Amilase", unit: "U/L" },
  { id: "lipase", name: "Lipase", unit: "U/L" },
  { id: "androstenediona", name: "Androstenediona", unit: "ng/dL" },
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
  // Qualitative markers - Coprológico
  { id: "copro_cor", name: "Cor (fezes)", unit: "", qualitative: true },
  { id: "copro_consistencia", name: "Consistência (fezes)", unit: "", qualitative: true },
  { id: "copro_muco", name: "Muco (fezes)", unit: "", qualitative: true },
  { id: "copro_sangue", name: "Sangue Oculto (fezes)", unit: "", qualitative: true },
  { id: "copro_leucocitos", name: "Leucócitos (fezes)", unit: "", qualitative: true },
  { id: "copro_parasitas", name: "Parasitas (fezes)", unit: "", qualitative: true },
  { id: "copro_gordura", name: "Gordura Fecal", unit: "", qualitative: true },
  { id: "copro_fibras", name: "Fibras Musculares (fezes)", unit: "", qualitative: true },
  { id: "copro_amido", name: "Amido (fezes)", unit: "", qualitative: true },
  { id: "copro_ph", name: "pH Fecal", unit: "" },
];

const QUALITATIVE_IDS = new Set(MARKER_LIST.filter(m => (m as any).qualitative).map(m => m.id));

const systemPrompt = `You are a lab result extraction assistant. You receive raw text from a Brazilian lab report PDF.
Your task: extract ALL values (numeric AND qualitative) and map them to the known marker IDs. Be thorough — extract every single marker you can find.

Here are the known markers (id | name | unit):
${MARKER_LIST.map((m) => `${m.id} | ${m.name} | ${m.unit}`).join("\n")}

=== COMPREHENSIVE NAME ALIASES FOR BRAZILIAN LABS ===
(Fleury, DASA, Hermes Pardini, Confiance, Einstein, Lavoisier, DB Diagnósticos, Laboratório Oswaldo Cruz, etc.)

HEMOGRAMA:
- "Hemácias" or "Glóbulos Vermelhos" → eritrocitos
- "Glóbulos Brancos" → leucocitos
- "Segmentados" or "Neutrófilos Segmentados" or "SEGS" → segmentados (NOT neutrofilos)
- "Bastonetes" or "Bastões" or "BASTOES" or "Neutrófilos Bastonetes" or "Neutrófilos Bastão" or "BAND NEUTROPHILS" → bastonetes
- "VPM" or "Volume Plaquetário Médio" or "V.P.M." or "MPV" or "MEAN PLATELET VOLUME" → vpm

COAGULAÇÃO:
- "FIBRINOGÊNIO" or "FIBRINOGENIO" or "FIBRINOGÊNIO FUNCIONAL" or "FIBRINOGÊNIO - CLAUSS" or "FIBRINOGÊNIO DERIVADO" or "Fator I" or "Fibrinogen" → fibrinogenio
  Units: mg/dL (standard). If g/L → multiply by 100.
- "DÍMEROS D" or "D-DÍMERO" or "D-Dímero" → dimeros_d

PANCREÁTICOS:
- "AMILASE" or "AMILASE SÉRICA" or "AMILASE TOTAL" or "α-AMILASE" or "ALFA-AMILASE" or "AMS" → amilase
  Note: "AMILASE PANCREÁTICA" has a different range (13–53 U/L); treat as amilase unless specifically distinguished.
- "LIPASE" or "LIPASE SÉRICA" or "LPS" → lipase

LIPÍDIOS:
- "Colesterol HDL" or "HDL-Colesterol" or "HDL:" → hdl
- "Colesterol LDL" or "LDL-Colesterol" or "LDL:" → ldl
- "Colesterol não-HDL" or "NÃO-HDL" or "NON-HDL" or "NÃO HDL COLESTEROL" → colesterol_nao_hdl
- "Triglicérides" or "Triglicerídios" → triglicerides
- "Colesterol Total:" → colesterol_total
- "VLDL:" → vldl
- "APOLIPOPROTEÍNA A-1" or "APOLIPOPROTEINA A1" or "APOLIPOPROTEÍNA A-I" or "APO A1" or "APO A-1" or "APO A-I" or "APOPROTEÍNA A1" or "Apo A" → apo_a1
  Units: mg/dL (standard). If g/L → multiply by 100.
- "APOLIPOPROTEÍNA B" or "APOLIPOPROTEINA B" or "APOLIPOPROTEÍNA B-100" or "APO B" or "APO B100" or "APO B-100" or "APOPROTEÍNA B" → apo_b
  Units: mg/dL (standard). If g/L → multiply by 100.
- "LIPOPROTEINA A" or "LIPOPROTEINA (a)" or "LIPOPROTEÍNA(a)" or "LIPOPROTEÍNA (a)" or "Lp(a)" or "LP(A)" or "LPA" → lipoproteina_a
  ⚠️ DO NOT confuse with Apolipoproteína A-1 (Apo A1). Lipoproteína(a) is Lp(a), a complete particle. Apo A-1 is a protein. They are DIFFERENT tests.
  Units: nmol/L (standard). If mg/dL → multiply by 2.15. If mg/L → divide by 10 then multiply by 2.15.
- "Relação CT/HDL" or "Índice de Castelli" → relacao_ct_hdl
- "Relação TG/HDL" → relacao_tg_hdl

TIREOIDE:
- "TSH Ultra-sensível" or "Tirotropina" or "TSH" → tsh
- "T4L" or "Tiroxina Livre" or "T4 LIVRE" → t4_livre
- "T3L" or "Triiodotironina Livre" or "T3 LIVRE" → t3_livre
- "T3 Reverso" or "T3R" or "REVERSE T3" → t3_reverso
- "ANTICORPO ANTI TPO" or "Anti-TPO" or "ANTI TPO" → anti_tpo
- "ANTICORPOS ANTI TIREOGLOBULINA" or "Anti-TG" or "Anti-Tireoglobulina" → anti_tg

HORMÔNIOS:
- "Testosterona Total" or "TESTOSTERONA TOTAL" → testosterona_total
- "Testosterona Livre" or "TESTOSTERONA LIVRE" → testosterona_livre
  Convert: if ng/dL → multiply by 10. If pmol/L → multiply by 0.28842. Target unit: pg/mL.
- "Estradiol" or "ESTRADIOL" → estradiol
  Convert: if ng/dL → multiply by 10. Target unit: pg/mL.
- "Progesterona" or "PROGESTERONA" → progesterona
  Convert: if ng/dL → divide by 100. Target unit: ng/mL.
- "DHEA-S" or "SDHEA" or "Sulfato de Dehidroepiandrosterona" or "S-DHEA" → dhea_s
- "Cortisol" or "Cortisol (manhã)" or "CORTISOL MATINAL" → cortisol (BLOOD, morning)
- "SHBG" or "Globulina Ligadora" or "S H B G" → shbg
- "FSH" or "HORMÔNIO FOLÍCULO ESTIMULANTE" → fsh
- "LH" or "HORMÔNIO LUTEINIZANTE" → lh
- "Prolactina" or "PROLACTINA" → prolactina

EIXO GH:
- "IGF-1" or "IGF1" or "SOMATOMEDINA C" or "SOMATOMEDINA-C" or "IGF I" or "IGF 1" or "INSULIN-LIKE GROWTH FACTOR 1" or "FATOR DE CRESCIMENTO INSULINA-SÍMILE TIPO 1" or "IGF 1- SOMATOMEDINA C" → igf1
  Units: ng/mL (standard). If nmol/L → multiply by 7.649.
- "IGFBP-3" or "IGFBP3" or "PROTEÍNA LIGADORA 3 DO IGF" or "PROTEINA LIGADORA DE IGF TIPO 3" or "IGFBP-3 PROTEÍNA LIGADORA -3 DO IGF" or "IGF BP3" or "IGFBP-3 (PROTEÍNA LIGADORA-3 DE IGF-1)" → igfbp3
  ⚠️ CRITICAL UNIT: if in ng/mL → divide by 1000 to get µg/mL. Example: 6120 ng/mL → 6.12 µg/mL. mg/L = µg/mL.

EIXO ADRENAL:
- "ACTH" or "A.C.T.H." or "HORMÔNIO ADRENOCORTICOTRÓFICO" or "HORMONIO ADRENOCORTICOTROFICO" or "CORTICOTROFINA" or "ADRENOCORTICOTROFINA" or "HORMÔNIO ADRENOCORTICOTRÓFICO A.C.T.H." → acth
  Units: pg/mL (standard). ng/L = pg/mL. If pmol/L → divide by 0.2202.
- "CORTISOL LIVRE, URINA DE 24 HORAS" or "CORTISOL LIVRE URINÁRIO" or "CORTISOL URINÁRIO" or "CORTISOL LIVRE - URINA 24H" or "CORTISOL URINA 24 HORAS" or "CORTISOL, URINA" or "CORTISOL LIVRE (URINA)" → cortisol_livre_urina
  ⚠️ Material is URINE (not blood!). Look for "URINA 24H" or "URINA DE 24 HORAS" near the name.
  Units: µg/24h (standard). mcg/24h = µg/24h. If nmol/24h → divide by 2.759.
- "ALDOSTERONA" or "ALDOSTERONA SÉRICA" or "ALDOSTERONA - SENTADO" or "ALDOSTERONA - DEITADO" or "ALDOSTERONA - EM PÉ" → aldosterona
  Units: ng/dL (standard). If pg/mL → divide by 10. If pmol/L → divide by 27.74.

ANDRÓGENOS:
- "DIHIDROTESTOSTERONA" or "DHT" or "5-ALFA-DIHIDROTESTOSTERONA" or "5α-DIHIDROTESTOSTERONA" or "DIHYDROTESTOSTERONE" → dihidrotestosterona
  Units: pg/mL (standard). If ng/dL → multiply by 10. If nmol/L → divide by 0.003442.
- "ANDROSTENEDIONA" or "Androstenediona" → androstenediona. Keep value in ng/dL.

VITAMINAS:
- "25 HIDROXI VITAMINA D" or "25-OH VITAMINA D" or "CALCIDIOL" or "25-HIDROXICOLECALCIFEROL" or "25(OH)D" or "Vitamina D3" → vitamina_d
  Units: ng/mL (standard). If nmol/L → divide by 2.496.
- "1,25 DIHIDROXI VITAMINA D" or "1,25-DIHIDROXIVITAMINA D" or "1,25(OH)2D" or "CALCITRIOL" or "1.25 DIHIDROXIVITAMINA D" or "1,25-DIHIDROXI-COLECALCIFEROL" or "1,25 OH VITAMINA D" → vitamina_d_125
  ⚠️ DO NOT confuse with 25-OH Vitamina D. 25-OH is the storage form (ng/mL); 1,25(OH)2 is the active form (pg/mL — 1000x smaller). TWO SEPARATE markers.
  Units: pg/mL (standard). ng/L = pg/mL. If pmol/L → divide by 2.4.
- "Vitamina B12" or "VITAMINA B12" → vitamina_b12. ng/L = pg/mL.
- "Ácido Fólico" or "Folato" or "ACIDO FOLICO" → acido_folico
- "Retinol" or "Vitamina A" or "VITAMINA A - RETINOL" → vitamina_a
- "Vitamina E" → vitamina_e
- "Ácido Ascórbico" or "Vitamina C" or "ACIDO ASCORBICO" → vitamina_c
- "Vitamina B6" → vitamina_b6
- "Vitamina B1" → vitamina_b1
- "Homocisteína" or "HOMOCISTEINA" → homocisteina

MINERAIS:
- "Magnésio" or "MAGNESIO" → magnesio
- "Zinco" or "ZINCO" → zinco (mcg/dL = µg/dL)
- "Selênio" or "SELÊNIO" → selenio (mcg/L = µg/L)
- "Cobre" or "COBRE" → cobre (mcg/dL = µg/dL)
- "Manganês" or "MANGANES" → manganes
- "Cromo" or "CROMO" → cromo
- "Iodo Urinário" or "IODO URINÁRIO" → iodo_urinario

TOXICOLOGIA:
- "CHUMBO" or "CHUMBO NO SANGUE" or "PLUMBEMIA" or "CHUMBO (Pb)" or "Pb SANGUE" or "LEAD" → chumbo
  Units: µg/dL (standard). If µg/L → divide by 10.
- "MERCURIO" or "Mercúrio" → mercurio. Value in µg/L.
- "CADMIO" or "Cádmio" → cadmio. Value in µg/L.
- "ALUMINIO" or "Alumínio" → aluminio. Value in µg/L.

HEPÁTICO:
- "AST" or "TGO" or "Aspartato" or "GOT" or "TRANSAMINASE GLUTÂMICO OXALACÉTICA" or "GOT/AST" → tgo_ast
- "ALT" or "TGP" or "Alanina" or "GPT" or "TRANSAMINASE GLUTÂMICO PIRÚVICA" or "GPT/ALT" → tgp_alt
- "Gama GT" or "Gama Glutamil" or "GAMA GT" or "γ-GT" → ggt
- "Fosfatase Alcalina" or "FOSFATASE ALCALINA" or "FA" → fosfatase_alcalina
- "Bilirrubina Total" → bilirrubina_total
- "Bilirrubina Direta" or "Bilirrubina Conjugada" → bilirrubina_direta
- "Bilirrubina Indireta" or "Bilirrubina Não Conjugada" or "BILIRRUBINA INDIRETA (CALCULADA)" → bilirrubina_indireta
- "Albumina" → albumina
- "Proteínas Totais" or "PROTEÍNAS TOTAIS" → proteinas_totais
- "LDH" or "Desidrogenase Láctica" or "DESIDROGENASE LÁTICA" → ldh

RENAL:
- "Creatinina" → creatinina
- "Ureia" or "UREIA" → ureia
- "Ácido Úrico" → acido_urico
- "Clearance" or "Filtração Glomerular" or "CKD-EPI" or "Estimativa da Taxa de Filtração Glomerular" or "TFG ESTIMADA" or "TFGe" or "eGFR" or "MDRD" → tfg
  Note: Often appears as a sub-item within creatinine results.
- "Cistatina C" or "CISTATINA C" or "Cistatina C sérica" → cistatina_c

ELETRÓLITOS:
- "Sódio" or "SODIO" → sodio
- "Potássio" or "POTASSIO" → potassio
- "Cálcio Total" or "CALCIO TOTAL" → calcio_total
- "Cálcio Ionizável" or "Cálcio Iônico" or "Cálcio ionizado" or "CÁLCIO IONIZÁVEL" → calcio_ionico (use mmol/L value)
- "Fósforo" or "FOSFORO" → fosforo
- "Cloro" or "CLORO" or "CLORETO" → cloro
- "Bicarbonato" or "CO2 Total" → bicarbonato
- "PTH Intacto" or "Paratormônio" or "PARATORMÔNIO PTH INTACTO" → pth

FERRO:
- "Ferro Sérico" → ferro_serico
- "Ferritina" → ferritina. microg/L = ng/mL.
- "Transferrina" → transferrina
- "Saturação de Transferrina" or "Índice de Saturação" or "Indice Saturação Transferrina" → sat_transferrina
- "TIBC" or "Capacidade Total de Fixação do Ferro" or "CTFF" or "Capacidade Total de Ligação do Ferro" or "Capacidade Ferropéxica Total" or "CTLF" → tibc
  Units: µg/dL (standard). If µmol/L → divide by 0.179.
- "Capacidade livre de fixação do ferro" or "UIBC" or "CLFF" → IGNORE (this is NOT TIBC)

GLICEMIA:
- "Glicose Jejum" or "GLICOSE" or "Glicemia" → glicose_jejum
- "Hemoglobina Glicada" or "HbA1c" or "A1C" or "Hemoglobina Glicosilada" or "HEMOGLOBINA GLICADA (A1C)" → hba1c
- "Insulina Jejum" or "INSULINA" → insulina_jejum
- "HOMA" or "HOMA-IR" or "Índice HOMA" → homa_ir

INFLAMAÇÃO:
- "PCR ultra-sensível" or "PCR-us" or "Proteína C Reativa" or "PROTEÍNA C REATIVA ULTRA-SENSÍVEL" → pcr
  Convert: if mg/dL → multiply by 10 to get mg/L. Example: 0.07 mg/dL → 0.7 mg/L.
- "VHS" or "Velocidade de Hemossedimentação" → vhs

IMUNOLOGIA:
- "FAN" or "FAN - FATOR ANTI-NÚCLEO" or "FATOR ANTINÚCLEO" or "FATOR ANTI-NÚCLEO" or "ANTICORPO ANTI-NÚCLEO" or "ANA" or "ANTICORPOS ANTINUCLEARES" or "FAN (HEP-2)" or "FAN - HEP2" or "PESQUISA DE FAN" or "FATOR ANTINUCLEAR" or "FAN POR IFI" → fan
  QUALITATIVE: use text_value. "NÃO REAGENTE" → text_value="Não Reagente". "REAGENTE 1/80" → text_value="Reagente 1/80 Nuclear pontilhado fino" (include titer and pattern if available). Set value=0.

ELETROFORESE DE PROTEÍNAS:
- "ELETROFORESE DE PROTEÍNAS" or "PROTEINOGRAMA" or "PROTEINOGRAMA ELETROFORÉTICO" or "EPS" → extract INDIVIDUAL fractions:
  - "Albumina" (within electrophoresis) → eletroforese_albumina (use % value)
  - "Alfa-1 Globulina" or "ALFA 1 GLOBULINA" or "α1-GLOBULINA" → eletroforese_alfa1
  - "Alfa-2 Globulina" or "ALFA 2 GLOBULINA" or "α2-GLOBULINA" → eletroforese_alfa2
  - "Beta-1 Globulina" or "BETA 1 GLOBULINA" or "β1-GLOBULINA" → eletroforese_beta1
  - "Beta-2 Globulina" or "BETA 2 GLOBULINA" or "β2-GLOBULINA" → eletroforese_beta2
  - "Gamaglobulina" or "GAMA GLOBULINA" or "γ-GLOBULINA" or "GAMMAGLOBULINA" → eletroforese_gama
  - "Relação A/G" → relacao_ag

URINA TIPO 1 / EAS:
- "URINA TIPO 1" or "EAS" or "EXAME DE URINA TIPO I" or "URINA ROTINA" or "PARCIAL DE URINA" or "SUMÁRIO DE URINA" or "URINA I" or "ELEMENTOS ANORMAIS E SEDIMENTO" or "URINÁLISE" → extract all sub-items:
  Cor → urina_cor, Aspecto → urina_aspecto, Densidade → urina_densidade, pH → urina_ph,
  Proteínas → urina_proteinas, Glicose → urina_glicose, Hemoglobina → urina_hemoglobina,
  Leucócitos → urina_leucocitos, Hemácias → urina_hemacias, Bactérias → urina_bacterias,
  Células Epiteliais → urina_celulas, Cilindros → urina_cilindros, Cristais → urina_cristais,
  Nitritos → urina_nitritos, Bilirrubina → urina_bilirrubina, Urobilinogênio → urina_urobilinogenio, Cetonas → urina_cetona.

COPROLÓGICO FUNCIONAL:
- "COPROLÓGICO FUNCIONAL" or "EXAME DE FEZES" or "EXAME COPROLÓGICO FUNCIONAL" or "ANÁLISE FUNCIONAL DAS FEZES" or "PROVA FUNCIONAL DAS FEZES" or "COPROGRAMA" → extract all sub-items:
  Cor → copro_cor, Consistência → copro_consistencia, Muco → copro_muco, Sangue Oculto → copro_sangue,
  Leucócitos → copro_leucocitos, Parasitas → copro_parasitas, Gordura Fecal → copro_gordura,
  Fibras Musculares → copro_fibras, Amido → copro_amido, pH Fecal → copro_ph.

=== EXTRACTION RULES ===
- Extract EVERY marker you can find. Be aggressive — if a value looks like it matches a marker, include it.
- The report may have multiple pages. Search ALL text thoroughly from start to end.
- Vitamins, hormones, thyroid, iron, and mineral markers are often at the end — don't stop early.
- CRITICAL: Extract sub-items within grouped panels:
  - Hemograma: includes Bastonetes, Segmentados, VPM (within differential/platelet section)
  - Lipidograma/Perfil Lipídico: includes Colesterol Não-HDL, VLDL, each as sub-items
  - Bilirrubinas: Total, Direta, AND Indireta — all three
  - Renal: Creatinina, Ureia, Ácido Úrico, TFG (sometimes listed as sub-item of Creatinina)
  - Ferro: Ferro Sérico, Ferritina, Transferrina, Sat. Transferrina, AND TIBC
- Convert values to the expected unit if needed (see unit conversion rules above).
- For Plaquetas, the value in the PDF is usually in thousands (e.g. "336 mil/mm3" → return 336).
- For Leucócitos, if value is small like "3,9" in thousands/mm³, return 3900. If already large like "6500", return 6500.
- For Eritrócitos, the value is usually in millions (e.g. "3,8 milhões/mm³" → return 3.8).
- Brazilian decimals use comma: "4,37" → 4.37. Convert commas to dots.
- Values with dot as thousands separator: "6.500" for leucocitos → 6500.
- For NUMERIC markers: return only the number in 'value'. No text.
- For QUALITATIVE markers (fan, urina_*, copro_*): return the text description in 'text_value' (e.g. "Amarelo Citrino", "Límpido", "Negativo", "Ausente", "Raros", "Pastosa"). Set value=0.
- If a marker appears multiple times, use the FIRST occurrence (the actual result, not historical).
- Look for values in tables, lists, and inline text formats.
- Values like "< 10" or "< 0,5" or "Inferior a 0,5" should use the number (10 or 0.5).
- "INFERIOR A X" → use X as value.
- "Superior a 90" for TFG → use 90.
- Ignore reference ranges — only extract the patient's actual result value.
- mcg = µg (microgram). mcg/dL = µg/dL, mcg/L = µg/L, mcg/24 HORAS = µg/24h.
- For Cortisol: if from blood/morning → cortisol. If from "URINA 24 HORAS" with "mcg/24 HORAS" → cortisol_livre_urina.
- For Zinco: if in microgramas/mL, multiply by 100 to get µg/dL. Example: 0.8 µg/mL → 80 µg/dL.
- For Lipoproteína(a): if in mg/dL → multiply by 2.15 to convert to nmol/L.
- IMPORTANT: Extract ALL markers present. Do NOT skip markers even if you're unsure. The "LAUDO EVOLUTIVO" section at the end has HISTORICAL data — do NOT extract from there. Only use the individual result pages.`;


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
              description: "Return extracted lab marker values mapped to their IDs. Use 'value' for numeric results and 'text_value' for qualitative/text results.",
              parameters: {
                type: "object",
                properties: {
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        marker_id: { type: "string", description: "The marker ID from the known list" },
                        value: { type: "number", description: "The numeric value extracted (use 0 for qualitative markers)" },
                        text_value: { type: "string", description: "The text result for qualitative markers (e.g. 'Negativo', 'Ausente', 'Amarelo Citrino')" },
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
    const validResults = (parsed.results || []).filter((r: any) => {
      if (!validIds.has(r.marker_id)) return false;
      // Qualitative markers: need text_value
      if (QUALITATIVE_IDS.has(r.marker_id)) {
        return typeof r.text_value === "string" && r.text_value.length > 0;
      }
      // Numeric markers: need valid number
      return typeof r.value === "number" && !isNaN(r.value);
    });
    
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
