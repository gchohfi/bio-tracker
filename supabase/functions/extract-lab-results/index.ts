import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { MARKER_LIST, QUALITATIVE_IDS, VALID_MARKER_IDS, CALCULATED_MARKERS, ALLOW_NEGATIVE, MARKER_TEXT_TERMS, DHEA_RANGES_BY_AGE, REFERENCE_OVERRIDES } from "./constants.ts";
import { toFloat, parseBrNum, OPERATOR_PATTERNS } from "./utils.ts";
import { normalizeOperatorText, deduplicateResults, parseLabRefRanges } from "./normalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompt = `You are an expert lab result extraction assistant for Brazilian labs (Fleury, DASA, Hermes Pardini, Confiance, Einstein, Lavoisier, DB, Oswaldo Cruz, etc.).

CRITICAL RULE #1 — DATE:
The exam_date MUST be the COLLECTION DATE ("Data de Coleta" / "Data da Coleta" / "Coletado em").
NEVER use "Data de Emissão", "Emitido em", "Data de Liberação", "Liberado em", or "Data de Impressão".
Brazilian format: DD/MM/YYYY. Day is FIRST, month is SECOND.
Example: "23/11/2025" → return "2025-11-23" (November 23). NEVER "2025-04-23".

CRITICAL RULE #2 — UNITS:
Return the value EXACTLY as printed in the lab report. Do NOT convert units.
Use the ORIGINAL unit from the report. If the lab reports Vitamin B12 in ng/L, store ng/L. If in pg/mL, store pg/mL.
Do NOT multiply, divide, or transform any value. The system will handle unit display.

Your task: extract lab values (numeric AND qualitative) from the PDF text and map them to known marker IDs. Extract ONLY markers that are EXPLICITLY PRESENT in the document.

CRITICAL ANTI-HALLUCINATION RULES:
1. NEVER invent, fabricate, or assume results. Only extract a marker if it is EXPLICITLY PRESENT in the PDF text with a visible numeric or qualitative result clearly associated with it. If you are unsure whether a result exists in the document, do NOT include it. When in doubt, omit.
2. It is MUCH BETTER to miss a real result than to fabricate a phantom value.
3. If a test was NOT ordered or NOT performed, it will NOT appear in the PDF — do NOT extract it.
4. Do NOT extract a marker just because it is in the known list — only extract if you can see the actual test name AND its result value printed in the document.

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
- ABSOLUTE LEUCOCYTE VALUES (neutrofilos_abs, linfocitos_abs, monocitos_abs, eosinofilos_abs, basofilos_abs):
  When the lab reports in "mil/mm³" or "x10³/mm³" or "x10³/µL" (e.g., "1,29 mil/mm³"), you MUST multiply by 1000 to convert to /mm³ (e.g., 1.29 × 1000 = 1290). The target unit is /mm³ (absolute count).

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
   - "T3 Livre" / "T3L" / "Triiodotironina Livre" → t3_livre (unit: pg/mL)
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
   - Anti-TPO: result "< 34" → { marker_id: "anti_tpo", value: 34, text_value: "< 34" }
   - TRAb: result "< 1.0" → { marker_id: "trab", value: 1.0, text_value: "< 1.0" }
   - Anti-TG: result "< 1.3" → { marker_id: "anti_tg", value: 1.3, text_value: "< 1.3" }
   - Anti-TG: result "1.7" (reference says "Inferior a 1,3") → { marker_id: "anti_tg", value: 1.7 } — DO NOT confuse the RESULT with the REFERENCE
   - Calcitonina: result "< 1.0" → { marker_id: "calcitonina", value: 1.0, text_value: "< 1.0" }
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
⚠️ ABSOLUTE WBC DIFFERENTIAL COUNTS:
  - In ADDITION to the % markers, also extract the ABSOLUTE count for each WBC differential:
    - linfocitos_abs: absolute lymphocyte count in /mm³ (e.g. 3250, ref "1.120 a 2.950")
    - neutrofilos_abs: absolute neutrophil count in /mm³ (e.g. 2140, ref "1.590 a 4.770")
    - monocitos_abs: absolute monocyte count in /mm³ (e.g. 430, ref "260 a 730")
    - eosinofilos_abs: absolute eosinophil count in /mm³ (e.g. 100, ref "34 a 420")
    - basofilos_abs: absolute basophil count in /mm³ (e.g. 20, ref "10 a 80")
  - e.g. if lab shows "Linfócitos: 54,7% ... 3.250 /mm³", extract BOTH:
    - linfocitos: value=54.7, unit="%"
    - linfocitos_abs: value=3250, unit="/mm³", lab_ref_text="1.120 a 2.950"
  - This is critical: elevated absolute counts indicate cytopenias/cytoses even when % looks normal
- "PLAQUETOGRAMA" / "PLT" / "TROMBÓCITOS" / "Contagem de Plaquetas" → plaquetas
- "VPM" / "V.P.M." / "MPV" / "Volume Plaquetário Médio" / "MEAN PLATELET VOLUME" → vpm

COAGULAÇÃO:
- "FIBRINOGÊNIO" / "FIBRINOGENIO" / "FIBRINOGÊNIO FUNCIONAL" / "FIBRINOGÊNIO - CLAUSS" / "FIBRINOGÊNIO DERIVADO" / "Fator I" / "FIBRINOGÊNIO, PLASMA" / "FIBRINOGÊNIO CLAUSS" / "FIBRINOGÊNIO POR CLAUSS" → fibrinogenio
  Units: mg/dL. Keep as-is (do NOT convert).
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
  Units: nmol/L. If mg/dL, keep as mg/dL (do NOT convert).
- "CT/HDL" / "Índice de Castelli" → relacao_ct_hdl
- "TG/HDL" → relacao_tg_hdl
- "ApoB/ApoA1" / "Razão ApoB/ApoA1" / "Relação ApoB/ApoA-I" / "Apo B/Apo A1" / "Relação Apolipoproteína B / Apolipoproteína A-I" → relacao_apob_apoa1

TIREOIDE:
- "TSH Ultra-sensível" / "TSH ULTRASSENSÍVEL" / "Tirotropina" / "TIREOTROPINA" / "TSH" / "TSH 3a GERAÇÃO" / "TSH, SORO" / "HORMÔNIO TIROESTIMULANTE" / "HORMONIO TIROESTIMULANTE" / "TIROESTIMULANTE" / "HORMÔNIO TIROESTIMULANTE (TSH)" / "HORMONIO TIROESTIMULANTE (TSH)" → tsh
- "T4L" / "Tiroxina Livre" / "T4 LIVRE" / "TIROXINA LIVRE (T4L)" / "FT4" / "FREE T4" → t4_livre
- "T4 Total" / "Tiroxina Total" / "Tiroxina (T4) - Total" / "TIROXINA (T4) - TOTAL" / "TT4" / "TIROXINA (T4)" / "TIROXINA (T4), SORO" → t4_total
    ⚠️ "TIROXINA (T4)" without "LIVRE" = T4 Total. "TIROXINA (T4) LIVRE" = t4_livre!
- "T3L" / "Triiodotironina Livre" / "T3 LIVRE" / "TRIIODOTIRONINA LIVRE (T3L)" / "FT3" / "FREE T3" → t3_livre (unit: pg/mL — if lab reports in ng/dL, multiply value by 10 to convert to pg/mL)
- "T3 Total" / "Triiodotironina Total" / "Triiodotironina (T3) - Total" / "TRIIODOTIRONINA (T3) - TOTAL" / "TT3" / "TRIIODOTIRONINA (T3)" / "TRIIODOTIRONINA (T3), SORO" → t3_total
    ⚠️ "TRIIODOTIRONINA (T3)" without "LIVRE" = T3 Total. "TRIIODOTIRONINA (T3) LIVRE" = t3_livre!
- "T3 Reverso" / "T3R" / "REVERSE T3" / "TRIIODOTIRONINA REVERSA" / "rT3" / "RT3" → t3_reverso
- "ANTICORPO ANTI TPO" / "Anti-TPO" / "ANTI TPO" / "ANTICORPOS ANTI-PEROXIDASE TIREOIDIANA" / "ANTI-PEROXIDASE" / "TPO-Ab" / "ATPO" / "ANTICORPOS ANTI-PEROXIDASE TIROIDIANA" / "ANTI-PEROXIDASE TIROIDIANA" → anti_tpo
- "ANTICORPOS ANTI TIREOGLOBULINA" / "Anti-TG" / "ANTICORPOS ANTI-TIREOGLOBULINA" / "ATG" / "TgAb" / "ANTI TIREOGLOBULINA" / "ANTITIROGLOBULINA" / "ANTICORPOS ANTITIROGLOBULINA" / "ANTI-TIROGLOBULINA" → anti_tg
- "TRAb" / "TRAB" / "Anticorpo Anti-Receptor de TSH" / "Anti-receptor de TSH" / "Anti receptor TSH" / "Anticorpos Anti Receptores de TSH" → trab
- "TIREOGLOBULINA" / "Tireoglobulina" / "Tiroglobulina" / "TG" (quando no contexto tireoidiano, NÃO confundir com Anti-TG) → tiroglobulina

HORMÔNIOS:
- "Testosterona Total" / "TESTOSTERONA, SORO" / "TESTOSTERONA SÉRICA" → testosterona_total
- "Testosterona Livre" / "TESTOSTERONA LIVRE CALCULADA" / "TESTOSTERONA LIVRE, SORO" / "Testosterona Livre Calculada" / "FTE" → testosterona_livre (unit: ng/dL). CRITICAL: If the lab value is in pmol/L, DIVIDE by 34.7 to convert to ng/dL. Example: 477 pmol/L ÷ 34.7 = 13.7 ng/dL. Do NOT store pmol/L values.
  ⚠️ Testosterona Livre has sex-specific references: Male ~5–21 ng/dL, Female ~0.1–0.5 ng/dL.
    If the patient value is > 5 ng/dL (male range) but the lab_ref_range max is ≤ 2.0 ng/dL (female range), the wrong sex reference was captured — set lab_ref_range to null.
- "Testosterona Biodisponível" / "TESTOSTERONA BIODISPONIVEL" / "Testosterona Biodisponível Calculada" → testosterona_biodisponivel (unit: ng/dL)
- "Estradiol" / "ESTRADIOL (E2)" / "17-BETA-ESTRADIOL" / "17β-ESTRADIOL" / "E2" → estradiol (unit: pg/mL). CRITICAL: If the lab value is in ng/dL, MULTIPLY by 10 to convert to pg/mL. Example: 2.7 ng/dL × 10 = 27 pg/mL. Do NOT store ng/dL values.
- "Estrona" / "E1" / "Estrona (E1)" / "Estrona, soro" / "ESTRONA (E1)" → estrona
- "Progesterona" / "PROGESTERONA, SORO" / "P4" → progesterona (use the original unit from the report — do NOT convert)
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
- "IGFBP-3" / "IGFBP3" / "IGF BP3" / "PROTEÍNA LIGADORA 3 DO IGF" / "PROTEINA LIGADORA DE IGF TIPO 3" / "IGFBP-3 PROTEÍNA LIGADORA -3 DO IGF" / "IGFBP-3 (PROTEÍNA LIGADORA -3 DO IGF)" / "PROTEÍNA TRANSPORTADORA 3 DO IGF" / "PROTEINA LIGADORA-3 DO FATOR DE CRESCIMENTO SIMILE A INSULINA" / "FATOR DE CRESCIMENTO SIMILE A INSULINA" / "PROTEINA LIGADORA-3 DO FATOR DE CRESCIMENTO" → igfbp3 (use the original unit from the report — do NOT convert)

EIXO ADRENAL:
- "ACTH" / "A.C.T.H." / "HORMÔNIO ADRENOCORTICOTRÓFICO" / "HORMÔNIO ADRENOCORTICOTRÓFICO A.C.T.H." / "CORTICOTROFINA" / "ADRENOCORTICOTREFINA" / "HORMÔNIO ADRENOCORTICOTRÓFICO (ACTH)" / "HORMÔNIO ADRENOCORTICOTRÓFICO, PLASMA" → acth
- "CORTISOL LIVRE, URINA DE 24 HORAS" / "CORTISOL LIVRE URINÁRIO" / "CORTISOL URINÁRIO" / "CORTISOL LIVRE - URINA 24H" / "CORTISOL, URINA" / "CLU" → cortisol_livre_urina
  ⚠️ Material is URINE not blood! mcg/24 HORAS = µg/24h.
- "ALDOSTERONA" / "ALDOSTERONA SÉRICA" / "ALDOSTERONA - SENTADO" / "ALDOSTERONA - DEITADO" / "ALDOSTERONA - EM PÉ" / "ALDOSTERONA, SORO" / "ALDOSTERONA PLASMÁTICA" → aldosterona
  Units: ng/dL. Keep as-is (do NOT convert).
- "RENINA" / "ATIVIDADE DE RENINA PLASMÁTICA" / "RENINA DIRETA" / "ARP" / "RENINA PLASMÁTICA" / "ATIVIDADE PLASMÁTICA DE RENINA" / "APR" / "RENINA, PLASMA" → renina (unit: µUI/mL, numeric)

ANDRÓGENOS:
- "DIHIDROTESTOSTERONA" / "DHT" / "D.H.T." / "5-ALFA-DIHIDROTESTOSTERONA" / "5α-DIHIDROTESTOSTERONA" / "DIIDROTESTOSTERONA" / "5α-DHT" / "5-ALFA-DHT" → dihidrotestosterona (use the original unit from the report — do NOT convert)
- "ANDROSTENEDIONA" / "ANDROSTENEDIONA, SORO" / "DELTA 4 ANDROSTENEDIONA" / "Δ4-ANDROSTENEDIONA" / "4-ANDROSTENEDIONA" → androstenediona (use the original unit from the report — do NOT convert)

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
- "Zinco" / "ZINCO, SORO" / "ZINCO SÉRICO" / "Zn" → zinco (unit: µg/dL). CRITICAL: If the lab value is in µg/mL, MULTIPLY by 100 to convert to µg/dL. Example: 0.9 µg/mL × 100 = 90 µg/dL. Do NOT store µg/mL values.
- "Selênio" / "SELÊNIO, SORO" / "SELÊNIO SÉRICO" / "Se SÉRICO" → selenio
- "Cobre" → cobre
- "Manganês" → manganes
- "Cromo" / "CROMO, SORO" / "CROMO SÉRICO" / "Cr SÉRICO" → cromo
- "Iodo Urinário" → iodo_urinario

TOXICOLOGIA:
- "CHUMBO" / "PLUMBEMIA" / "Pb SANGUE" / "CHUMBO (Pb)" / "LEAD" / "CHUMBO SANGUE" / "DOSAGEM DE CHUMBO" → chumbo (use the original unit from the report — do NOT convert)
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
- "CK" / "CK TOTAL" / "CREATINOQUINASE" / "CREATINOQUINASE TOTAL" / "CPK" / "CREATINOFOSFOQUINASE" / "CK-TOTAL" / "CREATINA QUINASE" / "CREATINA FOSFOQUINASE" / "CK NAC" → ck

RENAL:
- "Creatinina" / "CREATININA, SORO" / "CREATININA SÉRICA" → creatinina
- "Ureia" / "UREIA, SORO" / "UREIA SÉRICA" / "BUN" → ureia
- "Ácido Úrico" / "ÁCIDO ÚRICO, SORO" / "URATO" → acido_urico
- "Clearance" / "Filtração Glomerular" / "CKD-EPI" / "TFG ESTIMADA" / "TFGe" / "eGFR" / "MDRD" / "TAXA DE FILTRAÇÃO GLOMERULAR ESTIMADA" / "TFGe CKD-EPI 2021" / "RITMO DE FILTRAÇÃO GLOMERULAR" / "RFG" / "GFR" → tfg
  Often appears as sub-item of creatinine.

  ⚠️ IMPORTANT: When the lab presents multiple GFR formulas (CKD-EPI 2009 afrodescendente, CKD-EPI 2009 não-afrodescendente, CKD-EPI 2021, MDRD), ALWAYS prefer the CKD-EPI 2021 value. This is the most modern formula recommended by current guidelines and does not use race adjustment. If CKD-EPI 2021 is not available, use the CKD-EPI 2009 "não-afrodescendente" value. If only "superior a 60" is shown, use value=60 and text_value="> 60".
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
   ⚠️ ATENÇÃO para Transferrina vs Saturação de Transferrina: Transferrina é medida em mg/dL (valores normais 200-360). Saturação de Transferrina é medida em % (valores normais 15-50%). Se o valor extraído para 'transferrina' for menor que 50, provavelmente é a Saturação de Transferrina e deve ir no campo 'sat_transferrina' em vez de 'transferrina'.
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
- "PCR ultra-sensível" / "PCR-us" / "Proteína C Reativa" / "hsCRP" / "PCR-AS" / "PROTEÍNA C REATIVA ULTRASSENSÍVEL" / "PROTEÍNA C REATIVA (ALTA SENSIBILIDADE)" / "PCR QUANTITATIVA" → pcr (target unit: mg/L — if lab reports in mg/dL, multiply value by 10 to convert to mg/L. Also convert lab_ref_min and lab_ref_max.)
- "VHS" / "V.H.S." / "Velocidade de Hemossedimentação" / "VSG" / "ESR" / "VELOCIDADE DE SEDIMENTAÇÃO" / "Hemossedimentação" / "HEMOSSEDIMENTACAO" / "HEMOSSEDIMENTAÇÃO, SANGUE TOTAL" → vhs

IMUNOLOGIA:
- "FAN" / "FAN - FATOR ANTI-NÚCLEO" / "FATOR ANTINÚCLEO" / "ANA" / "FAN (HEP-2)" / "PESQUISA DE FAN" → fan
  QUALITATIVE! Use text_value. Set value=0.
- "COMPLEMENTO C3" / "C3" / "COMPLEMENTO C3, SORO" / "C3 COMPLEMENTO" → complemento_c3 (unit: mg/dL, numeric)
- "COMPLEMENTO C4" / "C4" / "COMPLEMENTO C4, SORO" / "C4 COMPLEMENTO" → complemento_c4 (unit: mg/dL, numeric)
- "ANTI-DNA" / "ANTI-DNA NATIVO" / "ANTICORPO ANTI-DNA" / "Anti-dsDNA" / "ANTICORPOS ANTI-DNA NATIVO" / "ANTI DNA NATIVO" / "ANTI-DNA DE DUPLA HÉLICE" / "ANTI-dsDNA" → anti_dna (unit: UI/mL, numeric)
- "ANTI-SM" / "ANTI-Sm" / "ANTICORPO ANTI-SM" / "ANTI SM" / "ANTICORPOS ANTI-SM" → anti_sm (QUALITATIVE! Use text_value. Set value=0.)
- "FATOR REUMATOIDE" / "FR" / "LÁTEX" (in immunology context) → fator_reumatoide

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
- PSA: extract psa_total (ng/mL) and psa_livre (ng/mL) when present.
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
- ⚠️ CRITICAL: For ALL urina sub-items (including qualitative ones like proteinas, glicose, hemoglobina, nitritos), you MUST capture the lab_ref_text. Examples:
  - urina_proteinas: lab_ref_text = "Inferior a 0,10 g/L" or "Negativa"
  - urina_glicose: lab_ref_text = "Inferior a 0,30 g/L" or "Normal"
  - urina_hemoglobina: lab_ref_text = "Negativa" (NEVER a hemograma range like "11,7 a 14,9")
  - urina_leucocitos: lab_ref_text = "Até 5 /campo" or "Negativo"
  - urina_hemacias: lab_ref_text = "Até 3 /campo" or "< 3"
  - urina_leucocitos_quant: lab_ref_text = "Inferior a 25.000 /mL" or "Até 25.000 /mL"
  - urina_hemacias_quant: lab_ref_text = "Inferior a 10.000 /mL" or "Até 10.000 /mL"
  - urina_ph: lab_ref_text = "5,0 a 8,0"
  - urina_densidade: lab_ref_text = "1,005 a 1,030"
- ⚠️ CRITICAL ANTI-HALLUCINATION for urina_hemoglobina: This marker is QUALITATIVE ("Negativa"/"Positiva"/"Traços"). It is NOT the hemoglobina from hemograma (13.4 g/dL). If you see a numeric value like 13.4 or 16.3 with reference "11,7 a 14,9", that is hemograma hemoglobina — do NOT map it to urina_hemoglobina.
- ⚠️ CRITICAL ANTI-HALLUCINATION for urina_hemacias: This marker is QUALITATIVE ("Raras"/"Ausentes"/"0-3/campo"). It is NOT eritrocitos from hemograma (4.51 milhões/µL). If you see a numeric value like 4.51 with reference "3,83 a 4,99", that is hemograma eritrocitos — do NOT map it to urina_hemacias.

COPROLÓGICO:
- "COPROLÓGICO FUNCIONAL" / "COPROGRAMA" / "EXAME DE FEZES" / "PROVA FUNCIONAL DAS FEZES" / "PARASITOLÓGICO DE FEZES" / "EPF" → extract ALL sub-items as qualitative
- Sub-items: copro_cor, copro_consistencia, copro_muco, copro_sangue, copro_leucocitos, copro_hemacias, copro_parasitas, copro_gordura, copro_fibras, copro_amido, copro_celulose, copro_residuos, copro_ac_graxos, copro_flora, copro_ph
- "Resíduos Alimentares" / "Restos Alimentares" / "Resíduos Vegetais" → copro_residuos
- "Ácidos Graxos" / "Ácidos Gordurosos" → copro_ac_graxos
- "Celulose" / "Celulose Digerível" / "Celulose Vegetal" / "Celulose Não Digerível" → copro_celulose (QUALITATIVE)
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
⚠️ SEX-SPECIFIC REFERENCE RANGES: When the lab report shows separate reference ranges by sex (e.g. "Homens: 3,4 a 7,0 / Mulheres: 2,4 a 6,0"), you MUST select ONLY the range that matches the patient's sex. The patient's sex is provided in the user message. Example: Ácido Úrico for a female patient with ranges "Homens: 3,4 a 7,0 / Mulheres: 2,4 a 6,0" → lab_ref_text = "2,4 a 6,0", lab_ref_min = 2.4, lab_ref_max = 6.0. NEVER use the opposite sex's reference range.
⚠️ AGE-SPECIFIC REFERENCE RANGES: When the lab report shows multiple reference ranges by age group (e.g. "20-29 anos: 127 a 424 / 30-39 anos: 88 a 400 / 40-44 anos: 71 a 382"), you MUST select ONLY the range that matches the patient's age. The patient's age will be provided in the user message. If no age is provided, use the broadest adult range available. NEVER return the age range numbers as the reference — return only the value interval.
Example: DHEA-S for a 31-year-old patient with ranges "20 a 34 anos: 160 a 492 / 35 a 44 anos: 89 a 427" → lab_ref_text = "160 a 492" (NOT "89 a 427", which is for 35-44 years).

⚠️ CYCLE-PHASE / POSTURE-BASED REFERENCE RANGES (CRITICAL!):
For markers that have reference ranges split by MENSTRUAL CYCLE PHASE or BODY POSTURE (e.g. FSH, LH, Progesterona, Estradiol, Renina, Aldosterona, Cortisol), you MUST capture ALL phases/postures in lab_ref_text, separated by " / ".
Do NOT pick just one phase — include the ENTIRE table.
For lab_ref_min: use the LOWEST min across all phases.
For lab_ref_max: use the HIGHEST max across all phases.
Examples:
- FSH female: lab_ref_text = "Fase folicular: 3,5 a 12,5 / Ovulatória: 4,7 a 21,5 / Lútea: 1,7 a 7,7 / Pós-menopausa: 25,8 a 134,8", lab_ref_min = 1.7, lab_ref_max = 134.8
- LH female: lab_ref_text = "Fase folicular: 2,4 a 12,6 / Ovulatória: 14,0 a 95,6 / Lútea: 1,0 a 11,4 / Pós-menopausa: 7,7 a 58,5", lab_ref_min = 1.0, lab_ref_max = 95.6
- Progesterona female: lab_ref_text = "Fase folicular: 0,2 a 1,5 / Ovulatória: 0,8 a 3,0 / Lútea: 1,7 a 27,0 / Pós-menopausa: 0,1 a 0,8", lab_ref_min = 0.1, lab_ref_max = 27.0
- Renina: lab_ref_text = "Em pé: 2,8 a 39,9 / Deitado: 1,8 a 32,4", lab_ref_min = 1.8, lab_ref_max = 39.9
- T3 Livre: lab_ref_text = "20 a 49 anos: 2,0 a 4,4 / 50 a 79 anos: 2,0 a 4,7", lab_ref_min = 2.0, lab_ref_max = 4.7
This rule applies ONLY to cycle/posture markers. For other age-specific markers (DHEA-S, IGF-1, etc.), still pick the single matching age range as described above.
If no reference range is found for a marker, set lab_ref_text to "" (empty string) — but TRY HARD to find it.

- For T3 Livre: the target unit is pg/mL. If the lab reports in ng/dL (common in Fleury), multiply the value by 10 to convert to pg/mL. Also convert lab_ref_min and lab_ref_max by multiplying by 10. Example: 0.32 ng/dL → 3.2 pg/mL, ref 0.23-0.42 ng/dL → 2.3-4.2 pg/mL.
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
    - Key rule: if name contains "LIVRE" or "FREE" → Livre; otherwise → Total

DATE EXTRACTION PRIORITY:
1. "Data de Coleta" / "Data da Coleta" / "Coletado em" — USE THIS (collection date)
2. "Data do Exame" / "Realizado em" — secondary
3. "Data de Emissão" / "Emitido em" — LAST RESORT only
NEVER use "Data de Impressão" or footer dates.
The collection date is typically the EARLIEST date in the report.
Brazilian dates are DD/MM/YYYY: the FIRST number is the DAY, the SECOND is the MONTH.
Example: "23/11/2025" → 2025-11-23 (November 23). NEVER swap day and month.`;



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
function validateAndFixValues(results: any[], patientSex?: string, patientAge?: number | null): any[] {
  // Sanity ranges with auto-fix functions for common Brazilian decimal/unit errors
  // No unit conversion — values are stored exactly as the lab reports them.
  // Only fix decimal errors (e.g., acido_urico 77 → 7.7) and thousands separator issues (e.g., leucocitos 4.65 → 4650).

  const sanityRanges: Record<string, { min: number; max: number; fix?: (v: number, unit?: string) => number; label?: string }> = {
    // Hemograma
    leucocitos: { min: 1000, max: 30000, fix: (v) => {
      // v < 30: provavelmente em mil/µL (ex: 4.5 → 4500, 12.3 → 12300)
      if (v < 30) return v * 1000;
      // 30 ≤ v < 100: ambíguo, mas provavelmente em centenas (ex: 39 → 3900)
      if (v < 100) return v * 100;
      // 100 ≤ v < 1000: provavelmente ponto decimal ausente (ex: 465 → 4650)
      if (v < 1000) return v * 10;
      return v;
    }, label: "leucocitos scale fix" },
    eritrocitos: { min: 1, max: 10, fix: (v) => v > 1000 ? v / 1000000 : v > 10 ? v / 10 : v },
    plaquetas: { min: 50, max: 700, fix: (v) => v > 1000 ? v / 1000 : v },
    // Hormônios — NO conversions, only decimal fixes
    prolactina: { min: 0.5, max: 200, fix: (v) => v > 200 ? v / 100 : v },
    insulina_jejum: { min: 0.5, max: 100, fix: (v) => v > 100 ? v / 100 : v },
    // Eixo GH
    igf1: { min: 20, max: 1000 },
    // Tireoide
    tsh: { min: 0.01, max: 100, fix: (v: number) => {
      if (v > 200) return v / 100;
      return v;
    }, label: "tsh decimal fix" },
    t4_livre: { min: 0.1, max: 5 },
    // T3 Livre: target unit is pg/mL; auto-convert ng/dL values (< 1.0) by multiplying by 10
    t3_livre: { min: 0.15, max: 10, fix: (v) => v < 1.0 ? v * 10 : v },
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
    zinco: { min: 30, max: 200, fix: (v: number, unit?: string) => {
      if (unit && /ug\/m[lL]|µg\/m[lL]/i.test(unit)) return Math.round(v * 100 * 100) / 100;
      if (v < 10) return v * 100;
      return v;
    }, label: "zinco µg/mL→µg/dL" },
    testosterona_livre: { min: 0.5, max: 50, fix: (v: number, unit?: string) => {
      if (unit && /pmol/i.test(unit)) return Math.round((v / 34.7) * 100) / 100;
      if (v > 100) return Math.round((v / 34.7) * 100) / 100;
      return v;
    }, label: "testosterona_livre pmol→ng/dL" },
    estradiol: { min: 0.5, max: 500, fix: (v: number, unit?: string) => {
      // Convert ng/dL → pg/mL (×10) only when:
      // 1. Unit explicitly says ng/dL, OR
      // 2. Value < 1 (impossible as pg/mL — even post-menopause is ~5-20 pg/mL from most labs;
      //    but a value like 0.3 is clearly ng/dL that needs conversion to 3.0 pg/mL)
      // Do NOT convert values 1-5 automatically — post-menopausal women can have 
      // legitimate estradiol of 3-5 pg/mL.
      if (unit && /ng\/d/i.test(unit)) return Math.round(v * 10 * 100) / 100;
      if (v < 1) return Math.round(v * 10 * 100) / 100;
      return v;
    }, label: "estradiol ng/dL→pg/mL" },
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
    acido_urico: { min: 0.5, max: 15, fix: (v: number) => v > 15 ? v / 10 : v, label: "acido_urico decimal fix" },
    ureia: { min: 5, max: 200 },
    // Eletrólitos
    calcio_total: { min: 5, max: 15 },
    calcio_ionico: { min: 0.5, max: 2.5 },
    sodio: { min: 100, max: 180 },
    potassio: { min: 2, max: 8 },
    fosforo: { min: 1, max: 10 },
    magnesio: { min: 0.5, max: 5 },
    // PCR: target unit mg/L — auto-convert mg/dL values (< 0.5) by multiplying by 10
    pcr: { min: 0, max: 200, fix: (v) => v < 0.5 && v > 0 ? v * 10 : v },
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
    psa_ratio:             { min: 0, max: 100 },

    // Glicemia Média Estimada
    glicemia_media_estimada: { min: 50, max: 400 },
    // Urina quantitativos — NO conversion
    urina_albumina:        { min: 0, max: 300 },
    urina_creatinina:      { min: 10, max: 600 },
    // Densidade urinária: faixa normal 1.001–1.040
    // Nota: 1.02 e 1.020 são numericamente idênticos — nenhuma conversão necessária
    urina_densidade:       { min: 1.000, max: 1.060 },
    // pH urinário: faixa normal 4.5–8.5
    urina_ph:              { min: 4.0, max: 9.5 },
    // Leucograma absoluto — labs reportam em mil/mm³ (ex: 0.27 = 270 /mm³)
    neutrofilos_abs:       { min: 100, max: 15000, fix: (v) => v < 10 ? v * 1000 : v, label: "neutrofilos_abs ×1000" },
    linfocitos_abs:        { min: 100, max: 10000, fix: (v) => v < 10 ? v * 1000 : v, label: "linfocitos_abs ×1000" },
    monocitos_abs:         { min: 10,  max: 3000,  fix: (v) => v < 1 ? v * 1000 : v, label: "monocitos_abs ×1000" },
    eosinofilos_abs:       { min: 10,  max: 3000,  fix: (v) => v < 1 ? v * 1000 : v, label: "eosinofilos_abs ×1000" },
    basofilos_abs:         { min: 1,   max: 500,   fix: (v) => v < 1 ? v * 1000 : v, label: "basofilos_abs ×1000" },
    // Transferrina — 28 deveria ser 280 (separador perdido)
    transferrina:          { min: 100, max: 500, fix: (v) => v < 100 ? v * 10 : v, label: "transferrina ×10" },

    // ── Hemograma ──
    hemoglobina:       { min: 5, max: 22 },
    hematocrito:       { min: 15, max: 70 },
    vcm:               { min: 50, max: 130 },
    hcm:               { min: 15, max: 45 },
    rdw:               { min: 8, max: 30 },
    vpm:               { min: 4, max: 20 },
    vhs:               { min: 0, max: 200 },
    bastonetes:        { min: 0, max: 30 },
    segmentados:       { min: 10, max: 90 },
    neutrofilos:       { min: 10, max: 95 },
    linfocitos:        { min: 3, max: 70 },
    eosinofilos:       { min: 0, max: 30 },
    monocitos:         { min: 0, max: 25 },
    basofilos:         { min: 0, max: 5 },

    // ── Hepático ──
    tgo_ast:           { min: 3, max: 500, fix: (v: number) => {
      if (v > 1000 && v < 10000) return v / 10;
      return v;
    }, label: "tgo_ast decimal fix" },
    tgp_alt:           { min: 3, max: 500, fix: (v: number) => {
      if (v > 1000 && v < 10000) return v / 10;
      return v;
    }, label: "tgp_alt decimal fix" },
    ggt:               { min: 3, max: 1000 },
    fosfatase_alcalina: { min: 10, max: 1000 },
    bilirrubina_direta: { min: 0, max: 15 },

    // ── Tireoide (extras) ──
    t4_total:          { min: 1, max: 25 },
    t3_reverso:        { min: 5, max: 50 },
    anti_tpo:          { min: 0, max: 2000 },
    anti_tg:           { min: 0, max: 2000 },
    trab:              { min: 0, max: 50 },

    // ── Hormônios (extras) ──
    testosterona_total: { min: 1, max: 1500 },
    fsh:               { min: 0.1, max: 200 },
    lh:                { min: 0.1, max: 200 },
    progesterona:      { min: 0.05, max: 50 },
    dhea_s:            { min: 5, max: 700 },
    shbg:              { min: 5, max: 200 },
    amh:               { min: 0.01, max: 25 },

    // ── Lipídios (extras) ──
    vldl:              { min: 1, max: 200 },
  };

  // ── Conversão de unidade PCR: mg/dL → mg/L ──
  // PCR target unit é mg/L. Alguns labs reportam em mg/dL (10x menor).
  // Detectar pela referência: se lab_ref_text menciona "mg/dL" ou ref_max <= 1 (indicando mg/dL), converter.
  for (const r of results) {
    if (r.marker_id !== 'pcr') continue;
    if (typeof r.value !== 'number' || r.value === 0) continue;
    const refText = (r.lab_ref_text || '').toLowerCase();
    const isInMgDl = refText.includes('mg/dl') || 
                     (r.value > 0 && r.value < 0.5 && !refText.includes('mg/l'));
    if (isInMgDl) {
      const original = r.value;
      r.value = r.value * 10;
      console.log(`PCR unit conversion mg/dL→mg/L: ${original} → ${r.value}`);
      // Também converter lab_ref_min e lab_ref_max se existem e parecem mg/dL
      if (typeof r.lab_ref_max === 'number' && r.lab_ref_max <= 10) {
        console.log(`PCR ref conversion mg/dL→mg/L: max ${r.lab_ref_max} → ${r.lab_ref_max * 10}`);
        r.lab_ref_max = r.lab_ref_max * 10;
      }
      if (typeof r.lab_ref_min === 'number' && r.lab_ref_min > 0 && r.lab_ref_min < 1) {
        r.lab_ref_min = r.lab_ref_min * 10;
      }
      // Limpar lab_ref_text para usar mg/L
      if (r.lab_ref_text) {
        r.lab_ref_text = r.lab_ref_text.replace(/mg\/dL/gi, 'mg/L');
      }
    }
  }

  for (const r of results) {
    if (typeof r.value !== "number") continue;
    if (QUALITATIVE_IDS.has(r.marker_id)) continue;
    if (r.text_value && /^[<>≤≥]=?\s*\d/.test(r.text_value.trim())) continue; // legitimate operator, skip
    const range = sanityRanges[r.marker_id];
    if (!range || !range.fix) continue;
    if (r.value < range.min || r.value > range.max) {
      const original = r.value;
      r.value = range.fix(r.value, r.unit);
      if (r.value < range.min * 0.3 || r.value > range.max * 3) {
        r.value = original; // revert — fix didn't help
      } else {
        console.log(`Fixed ${r.marker_id}: ${original} → ${r.value} (${range.label || 'decimal fix'})`);
      }
    }
  }

  // Fix lab references for absolute WBC markers that came in mil/mm³
  const absWbcMarkers = new Set(['neutrofilos_abs', 'linfocitos_abs', 'monocitos_abs', 'eosinofilos_abs', 'basofilos_abs']);
  for (const r of results) {
    if (!absWbcMarkers.has(r.marker_id)) continue;
    if (typeof r.lab_ref_max === 'number' && r.lab_ref_max < 20) {
      console.log(`[wbc-ref-fix] Multiplying lab_ref for ${r.marker_id}: ${r.lab_ref_min}-${r.lab_ref_max} → ${(r.lab_ref_min || 0) * 1000}-${r.lab_ref_max * 1000}`);
      if (typeof r.lab_ref_min === 'number') r.lab_ref_min = r.lab_ref_min * 1000;
      r.lab_ref_max = r.lab_ref_max * 1000;
    }
  }

  // UNIT_CONVERSIONS removed — values are stored exactly as the lab reports them.

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

  // ── Remove urina_densidade e urina_ph com valores implausíveis ──
  // Se a IA extraiu valor 0 ou fora do range fisiológico, marcar para remoção
  // para permitir que o regex fallback re-extraia do PDF.
  for (const r of results) {
    if (r.marker_id === 'urina_densidade') {
      if (typeof r.value === 'number' && (r.value === 0 || r.value > 2 || (r.value >= 900 && r.value <= 1100))) {
        // Valor 0, ou > 2 (impossível), ou 900-1100 (parseBrNum interpretou 1.0XX como milhar)
        console.log(`Removing implausible urina_densidade: ${r.value}`);
        (r as any)._remove = true;
      }
    }
    if (r.marker_id === 'urina_ph') {
      if (typeof r.value === 'number' && (r.value === 0 || r.value > 14)) {
        console.log(`Removing implausible urina_ph: ${r.value}`);
        (r as any)._remove = true;
      }
    }
  }
  results = results.filter((r: any) => !r._remove);

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
  // === VALIDAÇÃO DE REFERÊNCIA POR SEXO ===
  // Quando o lab_ref_text contém ambos os sexos (ex: "Homens: 3,4 a 7,0 / Mulheres: 2,4 a 6,0"),
  // extrair o segmento correspondente ao sexo do paciente ao invés de descartar tudo.
  if (patientSex) {
    for (const r of results) {
      if (!r.lab_ref_text) continue;
      const text = String(r.lab_ref_text);
      const hasBothSexes = /\b(homens?|masculino)\b/i.test(text) && /\b(mulheres?|feminino)\b/i.test(text);
      if (hasBothSexes) {
        // Split by common delimiters and find the segment matching patient sex
        const segments = text.split(/[\/;]|\n/).map((s: string) => s.trim()).filter(Boolean);
        let extracted = '';
        const malePattern = /\b(homens?|masc(?:ulino)?)\b/i;
        const femalePattern = /\b(mulheres?|fem(?:inino)?)\b/i;
        const targetPattern = patientSex === 'M' ? malePattern : femalePattern;
        
        for (const seg of segments) {
          if (targetPattern.test(seg)) {
            // Remove the sex prefix and keep only the range
            extracted = seg
              .replace(/\b(homens?|mulheres?|masc(?:ulino)?|fem(?:inino)?)\b\s*:?\s*/gi, '')
              .trim();
            break;
          }
        }

        if (extracted) {
          console.log(`Extracted ${patientSex}-specific ref for ${r.marker_id}: "${text}" → "${extracted}"`);
          r.lab_ref_text = extracted;
          // Re-parse the extracted segment to update min/max
          const rangeMatch = extracted.match(/([\d.,]+)\s*(?:a|até|to|-|–|—)\s*([\d.,]+)/i);
          if (rangeMatch) {
            const min = parseFloat(rangeMatch[1].replace(/\./g, '').replace(',', '.'));
            const max = parseFloat(rangeMatch[2].replace(/\./g, '').replace(',', '.'));
            if (!isNaN(min) && !isNaN(max) && min < max) {
              r.lab_ref_min = min;
              r.lab_ref_max = max;
            }
          }
        } else {
          // Fallback: could not extract segment — clear (same behavior as before)
          console.log(`Could not extract ${patientSex}-specific ref for ${r.marker_id}: "${text}" — clearing`);
          r.lab_ref_text = '';
        }
      }
    }
  }
  // === ANTI-ALUCINAÇÃO: urina_hemoglobina e urina_hemacias ===
  // Gemini sometimes copies hemoglobina/eritrocitos from hemograma into urina fields.
  // Urina hemoglobina is QUALITATIVE (negativo/positivo/traços) — never a numeric like 13.4.
  // Urina hemacias qualitative is /campo (0-50), quantitative is /mL (0-50000).

  // Build lookup for cross-validation: blood hemoglobina and eritrocitos values
  const bloodHemoglobina = results.find((r: any) => r.marker_id === 'hemoglobina' && typeof r.value === 'number');
  const bloodEritrocitos = results.find((r: any) => r.marker_id === 'eritrocitos' && typeof r.value === 'number');

  for (const r of results) {
    // --- urina_hemoglobina ---
    if (r.marker_id === 'urina_hemoglobina') {
      // Case 1: numeric value > 5 → hemograma hallucination (urina hemoglobina is qualitative)
      const numVal = typeof r.value === 'number' ? r.value : (typeof r.value === 'string' ? parseFloat(String(r.value).replace(',', '.')) : NaN);
      if (!isNaN(numVal) && numVal > 5) {
        console.log(`ANTI-HALLUCINATION: removed urina_hemoglobina numeric ${r.value} (likely from hemograma)`);
        r._remove = true;
      }
      // Case 2: string containing 'g/dL' or 'milhões' or a reference range like '11,7 a 14,9'
      if (typeof r.value === 'string') {
        const v = r.value as string;
        if (
          /g\/dL/i.test(v) ||
          /milh[õo]es/i.test(v) ||
          /\d+[,.]\d+\s+a\s+\d+[,.]\d+/.test(v) ||
          /\d{2,}[,.]\d+/.test(v)
        ) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemoglobina string "${v}" (likely from hemograma)`);
          r._remove = true;
        }
      }
      // Case 2b: text_value containing hemograma units (defense-in-depth)
      if (typeof r.text_value === 'string') {
        const tv = r.text_value;
        if (
          /g\/[dD]?[lL]/i.test(tv) ||
          /milh[õo]es/i.test(tv) ||
          /mm[³3]/i.test(tv) ||
          /µL/i.test(tv) ||
          (/\d{2,}[,.]\d+/.test(tv) && /\d+[,.]\d+\s+a\s+\d+[,.]\d+/.test(tv))
        ) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemoglobina text_value "${tv}" (hemograma in text_value)`);
          r._remove = true;
        }
      }
      // Case 3: lab_ref_text contains hemograma-like reference (g/dL, "11,7 a 14,9", etc.)
      const refText = r.lab_ref_text || r.lab_ref_range || '';
      if (/g\/dL/i.test(refText) || /\d{2,}[,.]\d+\s*a\s*\d{2,}[,.]\d+/.test(refText)) {
        console.log(`ANTI-HALLUCINATION: removed urina_hemoglobina with hemograma ref "${refText}"`);
        r._remove = true;
      }
      // Case 4: lab_ref_min/max form a hemograma-like range (e.g. 11.7-16.5 g/dL)
      if (r.lab_ref_min != null && r.lab_ref_max != null) {
        const refMin = parseFloat(r.lab_ref_min);
        const refMax = parseFloat(r.lab_ref_max);
        if (!isNaN(refMin) && !isNaN(refMax) && refMin >= 5 && refMax <= 20 && refMax > refMin) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemoglobina with hemograma-like lab_ref range ${refMin}-${refMax}`);
          r._remove = true;
        }
      }
      // Case 5: cross-validation — if blood hemoglobina exists with similar value
      if (!r._remove && bloodHemoglobina && !isNaN(numVal)) {
        const bloodVal = bloodHemoglobina.value;
        if (Math.abs(numVal - bloodVal) < 1) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemoglobina ${numVal} (matches blood hemoglobina ${bloodVal})`);
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
      // Case 2b: text_value containing hemograma units (defense-in-depth)
      if (typeof r.text_value === 'string') {
        const tv = r.text_value;
        if (
          /milh[õo]es/i.test(tv) ||
          /mm[³3]/i.test(tv) ||
          /µL/i.test(tv) ||
          /g\/[dD]?[lL]/i.test(tv) ||
          (/\d+[,.]\d+\s+a\s+\d+[,.]\d+/.test(tv) && /\d{2,}[,.]\d+/.test(tv))
        ) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemacias text_value "${tv}" (hemograma in text_value)`);
          r._remove = true;
        }
      }
      // Case 3: lab_ref_min/max form a hemograma-like range (e.g. 3.83-4.99 milhões/µL)
      if (r.lab_ref_min != null && r.lab_ref_max != null) {
        const refMin = parseFloat(r.lab_ref_min);
        const refMax = parseFloat(r.lab_ref_max);
        // Hemograma eritrocitos ref is typically 3.5-5.5 milhões/µL; urina hemacias ref is 0-3 /campo
        if (!isNaN(refMin) && !isNaN(refMax) && refMin > 1 && refMax > 3 && refMax < 10) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemacias with hemograma-like lab_ref range ${refMin}-${refMax}`);
          r._remove = true;
        }
      }
      // Case 4: cross-validation — if blood eritrocitos exists with similar value
      if (!r._remove && bloodEritrocitos && typeof r.value === 'number') {
        const bloodVal = bloodEritrocitos.value;
        if (Math.abs(r.value - bloodVal) < 0.5) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemacias ${r.value} (matches blood eritrocitos ${bloodVal})`);
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

    // Caso 1: text_value contém valor hemograma + unidade (ex: "13,4 g/dL 11,7 a 14,9", "5,09 milhões/mm3 4,32 a 5,67")
    // Detectar padrão: número + g/dL ou g/L ou milhões ou mm³ ou µL → alucinação do hemograma → remover
    if (/[\d.,]+\s*(?:g\/[dD]?[lL]|milh[õo]es|mm[³3]|µL)/i.test(tv)) {
      console.log(`ANTI-HALLUCINATION: removed ${r.marker_id} text_value "${tv}" (hemograma hallucination)`);
      r._remove = true;
      continue;
    }

    // Caso 2: text_value contém resultado + referência concatenados
    // Ex: "15.900 /mL Até 25.000 /mL", "3.600 /mL até 23.000 /mL", "1.000/mL inferior a 30.000/mL"
    // Separar resultado da referência: extrair valor antes do delimitador e mover o resto para lab_ref_text
    const splitMatch = tv.match(/^(\d[\d.,]*\s*(?:\/mL|\/campo)?)\s+(Até|até|inferior\s+a|superior\s+a|menor\s+que|maior\s+que|Ref\.?|ref\.?|[<>≤≥]=?\s*)\s*(.+)$/i);
    if (splitMatch) {
      const resultPart = splitMatch[1].trim();
      const refPart = `${splitMatch[2].trim()} ${splitMatch[3].trim()}`;
      console.log(`Split text_value for ${r.marker_id}: "${tv}" → result="${resultPart}", ref="${refPart}"`);
      r.text_value = resultPart;
      if (!r.lab_ref_text) {
        r.lab_ref_text = refPart;
      }
      continue;
    }

    // Caso 3: text_value contém "VALOR a VALOR" sem unidade — provavelmente resultado + referência juntos
    // Ex: "14,9 13,3 a 16,5" (valor seguido de referência sem separador claro)
    const numRefMatch = tv.match(/^(\d+[.,]?\d*)\s+(\d+[.,]?\d*\s+a\s+\d+[.,]?\d*)$/i);
    if (numRefMatch) {
      console.log(`Split num+ref text_value for ${r.marker_id}: "${tv}" → result="${numRefMatch[1]}", ref="${numRefMatch[2]}"`);
      r.text_value = numRefMatch[1];
      if (!r.lab_ref_text) {
        r.lab_ref_text = numRefMatch[2];
      }
      continue;
    }

    // Caso 4: text_value é um texto qualitativo válido (ex: "Negativo", "Positivo", "1+", "AUSENTE")
    // Não fazer nada — manter como está
  }

  // === DEDUP: redirecionar marcadores qualitativos de urina que receberam valores quantitativos ===
  // Gemini às vezes coloca "1.000/mL" no urina_leucocitos (qualitativo) ao invés de urina_leucocitos_quant.
  // Mesma situação para urina_hemacias vs urina_hemacias_quant.
  const QUALITATIVE_TO_QUANT_MAP: Record<string, string> = {
    'urina_leucocitos': 'urina_leucocitos_quant',
    'urina_hemacias': 'urina_hemacias_quant',
  };

  for (const r of results) {
    const quantId = QUALITATIVE_TO_QUANT_MAP[r.marker_id];
    if (!quantId) continue;

    // Detect quantitative value in qualitative marker:
    // - text_value contains /mL unit
    // - text_value contains a numeric pattern (e.g., "23.500", "1300")
    // - numeric value > 50
    const hasMLUnit = typeof r.text_value === 'string' && /\/mL/i.test(r.text_value);
    const hasNumericTextValue = typeof r.text_value === 'string' && /^\d[\d.\s]*\s*\/?\s*m?L?$/i.test(r.text_value.trim());
    const hasHighNumeric = typeof r.value === 'number' && r.value > 50;

    if (hasMLUnit || hasNumericTextValue || hasHighNumeric) {
      // Check if the quantitative marker already exists
      const quantExists = results.some((q: any) => q.marker_id === quantId && !q._remove);
      if (quantExists) {
        // Quantitative version already present — just remove the qualitative duplicate
        console.log(`DEDUP: removed ${r.marker_id} (quantitative data "${r.text_value || r.value}"; ${quantId} already exists)`);
        r._remove = true;
      } else {
        // Redirect: convert qualitative to quantitative
        const numVal = hasHighNumeric ? r.value : parseFloat(String(r.text_value).replace(/[.\s]/g, '').replace(',', '.').replace(/\/mL/i, ''));
        console.log(`DEDUP: redirected ${r.marker_id} → ${quantId} (value: ${numVal})`);
        r.marker_id = quantId;
        r.value = isNaN(numVal) ? r.value : numVal;
        delete r.text_value;
      }
    }
  }

   return results.filter((r: any) => !r._remove);
}

/**
 * convertLabRefUnits — REMOVED (no more unit conversions).
 * Values and references are stored exactly as the lab reports them.
 * Only structural fixes (percent markers, age ranges, sanity bounds) remain.
 */
function convertLabRefUnits(results: any[]): any[] {

  // Sanity check: marcadores em % (diferenciais do leucograma) sempre vêm com referência
  // laboratorial em valores absolutos (/mm³) no PDF. Como o app armazena esses marcadores
  // como percentuais, a referência do laboratório nunca é compatível — sempre descartar.
  // Exemplos: Neutrófilos 35% com ref "1.526 a 5.020" (/mm³), Basófilos 1.3% com ref "10 a 80" (/mm³)
  const percentOnlyMarkers = new Set([
    'neutrofilos', 'linfocitos', 'monocitos', 'eosinofilos', 'basofilos',
  ]);
  for (const r of results) {
    if (percentOnlyMarkers.has(r.marker_id) && (r.lab_ref_min != null || r.lab_ref_max != null)) {
      // Check if the reference looks like a percentage range (both values <= 100)
      // or an absolute count range (values typically > 100, e.g. "1.526 a 5.020 /mm³").
      // Only discard if it's clearly an absolute count reference.
      const refMin = typeof r.lab_ref_min === 'number' ? r.lab_ref_min : 0;
      const refMax = typeof r.lab_ref_max === 'number' ? r.lab_ref_max : 0;
      const looksLikeAbsolute = refMax > 100 || refMin > 100;
      if (looksLikeAbsolute) {
        console.log(`Discarding absolute-unit lab_ref for percent marker ${r.marker_id}: ${r.lab_ref_min}-${r.lab_ref_max} (text: ${r.lab_ref_text})`);
        r.lab_ref_min = null;
        r.lab_ref_max = null;
        r.lab_ref_text = '';
      } else {
        console.log(`Keeping percentage lab_ref for ${r.marker_id}: ${r.lab_ref_min}-${r.lab_ref_max} (text: ${r.lab_ref_text})`);
      }
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

  // Bug: Homocisteína — ref capturando faixa etária (ex: "15 a 65 anos") em vez do valor de referência.
  // Homocisteína normal: < 15 µmol/L. Se lab_ref_min >= 10 e lab_ref_max >= 40, é faixa etária — descartar.
  for (const r of results) {
    if (r.marker_id === 'homocisteina' && typeof r.lab_ref_min === 'number' && typeof r.lab_ref_max === 'number') {
      if (r.lab_ref_min >= 10 && r.lab_ref_max >= 40) {
        console.log(`Discarding age-range lab_ref for homocisteina: ${r.lab_ref_min}-${r.lab_ref_max}`);
        r.lab_ref_min = null;
        r.lab_ref_max = null;
        r.lab_ref_text = '';
      }
    }
  }


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

  // Ref converters removed — no more unit conversions.
  return results;
}
// Post-processing: calculate derived values if missing
function postProcessResults(results: any[]): any[] {
  const resultMap = new Map<string, any>();
  for (const r of results) {
    resultMap.set(r.marker_id, r);
  }

  // Fix psa_ratio: ALWAYS recalculate from psa_livre/psa_total when both are available.
  // The AI often confuses the reference text (e.g. "> 25%") with the actual result value.
  // Recalculating from primary values is always more reliable.
  if (resultMap.has("psa_ratio")) {
    const existing = resultMap.get("psa_ratio");
    if (typeof existing.value === "number") {
      if (resultMap.has("psa_livre") && resultMap.has("psa_total")) {
        const psaL = resultMap.get("psa_livre").value;
        const psaT = resultMap.get("psa_total").value;
        if (typeof psaL === "number" && typeof psaT === "number" && psaT > 0) {
          const recalculated = Math.round((psaL / psaT) * 100 * 10) / 10;
          console.log(`[PSA] Recalculated psa_ratio: ${existing.value} → ${recalculated}% (from ${psaL}/${psaT})`);
          existing.value = recalculated;
        }
      } else if (existing.value < 1.0 && existing.value > 0) {
        // No psa_livre/psa_total available — assume fraction and convert to %
        existing.value = Math.round(existing.value * 100 * 10) / 10;
        console.log(`[PSA] Converted psa_ratio from fraction: ${existing.value}%`);
      }
    }
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

  // Calculate Relação PSA Livre/Total (%)
  // Interpretação clínica: ≥ 15% = risco baixo de câncer de próstata
  if (!resultMap.has("psa_ratio") && resultMap.has("psa_livre") && resultMap.has("psa_total")) {
    const psaLivre = resultMap.get("psa_livre").value;
    const psaTotal = resultMap.get("psa_total").value;
    if (typeof psaLivre === "number" && typeof psaTotal === "number" && psaTotal > 0) {
      const ratio = Math.round((psaLivre / psaTotal) * 100 * 10) / 10; // 1 casa decimal
      results.push({ marker_id: "psa_ratio", value: ratio });
      console.log(`Calculated psa_ratio: (${psaLivre} / ${psaTotal}) * 100 = ${ratio}%`);
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

    // ── Textos com prefixos descritivos ou multi-categoria de risco ──
    const riskCategoryPattern = /(?:desej[áa]vel|[oó]timo|normal|limit[ír]ofe|borderline|elevado|alto|muito\s+alto|baixo)/i;
    if (riskCategoryPattern.test(t)) {
      const riskSegments = t.split(/[\/\n]/).map(s => s.trim()).filter(Boolean);
      let cleanedInput: string | null = null;
      if (riskSegments.length > 1) {
        const desejavel = riskSegments.find(s => /desej[áa]vel/i.test(s));
        const otimo = riskSegments.find(s => /[oó]timo/i.test(s));
        const normal = riskSegments.find(s => /^normal\b/i.test(s.replace(/^\s*/, '')));
        const chosen = desejavel || otimo || normal || riskSegments[0];
        cleanedInput = chosen.replace(/^[^:]*:\s*/, '').trim();
      } else {
        cleanedInput = t.replace(/^[^:]*:\s*/, '').trim();
      }
      if (cleanedInput && cleanedInput.length > 0) {
        cleanedInput = cleanedInput.replace(/\s*mg\/[dDlL][lL]?\s*$/i, '').trim();
        let riskMatched = false;
        for (const { pattern: op, operator } of OPERATOR_PATTERNS) {
          if (op.test(cleanedInput)) {
            const numStr = cleanedInput.replace(op, '').trim();
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
                riskMatched = true;
                break;
              }
            }
          }
        }
        if (riskMatched) continue;
        const rangeM = cleanedInput.match(/([\d.,]+)\s*(?:a|até|to|-|–|—)\s*([\d.,]+)/i);
        if (rangeM) {
          const rMin = toFloat(rangeM[1]);
          const rMax = toFloat(rangeM[2]);
          if (rMin !== null && rMax !== null && rMin < rMax) {
            r.lab_ref_min = rMin;
            r.lab_ref_max = rMax;
            r.lab_ref_text = `${rMin} a ${rMax}`;
            continue;
          }
        }
      }
    }

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
  tryFleury('tiroglobulina', 'TIREOGLOBULINA(?!\\s*ANTI)|TIROGLOBULINA(?!\\s*ANTI)', NUM);
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
  tryGeneric('tiroglobulina', [
    /(?:TIREOGLOBULINA|TIROGLOBULINA)(?!\s*(?:ANTI|anti))[\s:.\-]*?(\d+[.,]?\d*)/i,
  ]);
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
  
  tryGeneric('urina_albumina', [/(?:Albumina\s*(?:\(urina\)|urin[áa]ria)|Microalbumin[úu]ria)[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('urina_creatinina', [/(?:Creatinina\s*(?:\(urina\)|urin[áa]ria))[\s:.\-]*?(\d+[.,]?\d*)/i]);
  tryGeneric('urina_acr', [/(?:Raz[ãa]o\s+Albumina\s*\/\s*Creatinina|RAC|ACR)[\s:.\-]*?(\d+[.,]?\d*)/i]);


  // URINA TIPO I — formato em colunas do Fleury
  // =============================================
  const urinaMatch = pdfText.match(/URINA\s+(?:TIPO\s+)?I(?:[\s,]|$)[\s\S]{0,5000}/i);
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
      const m = pdfText.match(/(?:Densidade)[\s:.\-]*?(1[.,]\d{3}|1[.,]0\d{2})/i);
      if (m) {
        // Tratamento especial: densidade urinária é sempre 1.0XX
        // parseBrNum interpretaria "1.030" como 1030 (milhar), então parseamos manualmente
        const densStr = m[1].replace(',', '.');
        const densVal = parseFloat(densStr);
        if (densVal >= 1.000 && densVal <= 1.060) {
          additional.push({ marker_id: 'urina_densidade', value: densVal });
          found.add('urina_densidade');
          console.log(`Regex fallback urina_densidade: ${densVal}`);
        }
      }
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

// ── Global Cross-Validation: verify marker names exist in PDF text ──
// Markers that are calculated/derived and don't need to appear in the PDF text
const CALCULATED_MARKERS = new Set([
  'bilirrubina_indireta', 'colesterol_nao_hdl', 'relacao_ct_hdl', 'relacao_tg_hdl',
  'relacao_apob_apoa1', 'homa_ir', 'neutrofilos', 'fixacao_latente_ferro', 'urina_acr',
  'glicemia_media_estimada', 'neutrofilos_abs',
]);

// Search terms for each marker — at least one must appear in pdfText for the marker to be accepted
const MARKER_TEXT_TERMS: Record<string, string[]> = {
  hemoglobina: ['hemoglobina', 'hb ', 'hgb', 'hemograma'],
  hematocrito: ['hematócrito', 'hematocrito', 'hct', 'hemograma'],
  eritrocitos: ['eritrócitos', 'eritrocitos', 'hemácias', 'hemacias', 'rbc', 'glóbulos vermelhos', 'hemograma', 'eritrograma'],
  vcm: ['vcm', 'v.c.m', 'volume corpuscular', 'hemograma'],
  hcm: ['hcm', 'h.c.m', 'hemoglobina corpuscular', 'hemograma'],
  chcm: ['chcm', 'c.h.c.m', 'concentração de hemoglobina', 'hemograma'],
  rdw: ['rdw', 'r.d.w', 'amplitude', 'hemograma'],
  leucocitos: ['leucócitos', 'leucocitos', 'wbc', 'glóbulos brancos', 'leucograma', 'hemograma', 'série branca'],
  linfocitos: ['linfócitos', 'linfocitos', 'linf', 'lymph', 'leucograma', 'hemograma'],
  linfocitos_abs: ['linfócitos', 'linfocitos', 'linf', 'lymph', 'leucograma', 'hemograma'],
  monocitos: ['monócitos', 'monocitos', 'mono', 'leucograma', 'hemograma'],
  monocitos_abs: ['monócitos', 'monocitos', 'mono', 'leucograma', 'hemograma'],
  eosinofilos: ['eosinófilos', 'eosinofilos', 'eos', 'leucograma', 'hemograma'],
  eosinofilos_abs: ['eosinófilos', 'eosinofilos', 'eos', 'leucograma', 'hemograma'],
  basofilos: ['basófilos', 'basofilos', 'baso', 'leucograma', 'hemograma'],
  basofilos_abs: ['basófilos', 'basofilos', 'baso', 'leucograma', 'hemograma'],
  bastonetes: ['bastonetes', 'bastões', 'bastoes', 'band', 'stab', 'leucograma', 'hemograma'],
  segmentados: ['segmentados', 'segs', 'leucograma', 'hemograma'],
  plaquetas: ['plaquetas', 'plt', 'trombócitos', 'trombocitos', 'plaquetograma', 'hemograma'],
  vpm: ['vpm', 'v.p.m', 'mpv', 'volume plaquetário', 'plaquetograma', 'hemograma'],
  ferro_serico: ['ferro', 'fe ', 'iron'],
  ferritina: ['ferritina', 'ferritin'],
  transferrina: ['transferrina', 'transferrin'],
  sat_transferrina: ['saturação de transferrina', 'saturacao de transferrina', 'sat. transferrina', 'sat transferrina', 'índice de saturação', 'ist '],
  tibc: ['tibc', 'ctff', 'capacidade ferropéxica', 'capacidade ferroxica', 'capacidade total de ligação', 'ctlf'],
  ferro_metabolismo: ['metabolismo do ferro', 'ferro sérico', 'ferro serico'],
  glicose_jejum: ['glicose', 'glicemia', 'glucose', 'glycemia'],
  hba1c: ['hba1c', 'hemoglobina glicada', 'hemoglobina glicosilada', 'a1c', 'hb glicada'],
  insulina_jejum: ['insulina', 'insulin'],
  colesterol_total: ['colesterol total', 'colesterol, soro', 'colesterol sérico', 'colesterol serico', 'perfil lipídico', 'perfil lipidico'],
  hdl: ['hdl', 'colesterol hdl'],
  ldl: ['ldl', 'colesterol ldl'],
  vldl: ['vldl', 'colesterol vldl'],
  triglicerides: ['triglicérides', 'triglicerides', 'triglicerídeos', 'triglicerideos', 'triglicerídios', 'trigliceridios'],
  apo_a1: ['apolipoproteína a', 'apolipoproteina a', 'apo a', 'apo a1', 'apo a-1'],
  apo_b: ['apolipoproteína b', 'apolipoproteina b', 'apo b', 'apo b100'],
  lipoproteina_a: ['lipoproteína(a)', 'lipoproteina(a)', 'lp(a)', 'lpa', 'lipoproteína (a)', 'lipoproteina (a)'],
  tsh: ['tsh', 'tirotropina', 'tireotropina', 'tiroestimulante'],
  t4_livre: ['t4 livre', 't4l', 'tiroxina livre', 'ft4', 'free t4', 'tiroxina (t4) livre', 'tiroxina(t4) livre'],
  t4_total: ['t4 total', 'tiroxina total', 'tiroxina (t4)', 'tt4'],
  t3_livre: ['t3 livre', 't3l', 'triiodotironina livre', 'ft3', 'free t3', 'triiodotironina (t3) livre', 'triiodotironina(t3) livre'],
  t3_total: ['t3 total', 'triiodotironina total', 'triiodotironina (t3)', 'tt3'],
  t3_reverso: ['t3 reverso', 't3r', 'reverse t3', 'triiodotironina reversa', 'rt3'],
  anti_tpo: ['anti-tpo', 'anti tpo', 'anticorpo anti tpo', 'anti-peroxidase', 'atpo', 'peroxidase tireoidiana', 'peroxidase tiroidiana'],
  anti_tg: ['anti-tg', 'anti tg', 'anti-tireoglobulina', 'anti tireoglobulina', 'antitiroglobulina', 'atg', 'tgab'],
  trab: ['trab', 'anti-receptor de tsh', 'anti receptor tsh', 'anti receptor de tsh', 'anticorpos anti receptores de tsh'],
  tiroglobulina: ['tireoglobulina', 'tiroglobulina'],
  testosterona_total: ['testosterona total', 'testosterona, soro', 'testosterona sérica', 'testosterona soro'],
  testosterona_livre: ['testosterona livre', 'testosterona livre calculada', 'fte'],
  testosterona_biodisponivel: ['testosterona biodisponível', 'testosterona biodisponivel'],
  estradiol: ['estradiol', '17-beta-estradiol', '17β-estradiol', 'e2'],
  estrona: ['estrona', 'e1'],
  progesterona: ['progesterona', 'p4'],
  dhea_s: ['dhea', 'sdhea', 's-dhea', 'dehidroepiandrosterona', 'deidroepiandrosterona'],
  cortisol: ['cortisol'],
  shbg: ['shbg', 's h b g', 'globulina ligadora de hormônios', 'globulina ligadora de hormonios', 'sex hormone binding'],
  fsh: ['fsh', 'folículo estimulante', 'foliculo estimulante', 'foliculoestimulante', 'folitropina'],
  lh: ['lh', 'luteinizante', 'lutropina'],
  prolactina: ['prolactina', 'prl'],
  amh: ['amh', 'anti-mülleriano', 'anti-mulleriano', 'antimülleriano', 'antimulleriano', 'ham'],
  igf1: ['igf-1', 'igf1', 'igf 1', 'igf i', 'somatomedina', 'fator de crescimento insulina'],
  igfbp3: ['igfbp-3', 'igfbp3', 'igfbp 3'],
  acth: ['acth', 'a.c.t.h', 'corticotropina', 'corticotrofina', 'adrenocorticotrófico', 'adrenocorticotrofico'],
  cortisol_livre_urina: ['cortisol', 'urina 24h', 'urina de 24 horas'],
  aldosterona: ['aldosterona'],
  dihidrotestosterona: ['dihidrotestosterona', 'dht', 'd.h.t', 'dihydrotestosterone', '5α-dht', '5-alfa-dihidrotestosterona'],
  androstenediona: ['androstenediona', 'androstenedione'],
  vitamina_d: ['vitamina d', '25-oh', '25-hidroxi', 'calcidiol', '25(oh)'],
  vitamina_d_125: ['1,25', '1.25', 'calcitriol', 'dihidroxi'],
  vitamina_b12: ['vitamina b12', 'b12', 'cianocobalamina', 'cobalamina'],
  acido_folico: ['ácido fólico', 'acido folico', 'folato', 'folic acid'],
  vitamina_a: ['vitamina a', 'retinol'],
  vitamina_e: ['vitamina e', 'tocoferol'],
  vitamina_c: ['vitamina c', 'ácido ascórbico', 'acido ascorbico'],
  vitamina_b6: ['vitamina b6', 'piridoxina', 'piridoxal'],
  vitamina_b1: ['vitamina b1', 'tiamina'],
  magnesio: ['magnésio', 'magnesio', 'mg '],
  zinco: ['zinco', 'zinc', 'zn '],
  selenio: ['selênio', 'selenio', 'selenium', 'se '],
  cobre: ['cobre', 'copper', 'cu '],
  manganes: ['manganês', 'manganes', 'manganese', 'mn '],
  cromo: ['cromo', 'chromium', 'cr '],
  iodo_urinario: ['iodo', 'iodúria', 'ioduria'],
  chumbo: ['chumbo', 'plumbemia', 'lead', 'pb '],
  tgo_ast: ['tgo', 'ast', 'aspartato aminotransferase', 'transaminase oxalacética', 'transaminase oxalacetica'],
  tgp_alt: ['tgp', 'alt', 'alanina aminotransferase', 'transaminase pirúvica', 'transaminase piruvica'],
  ggt: ['ggt', 'gama glutamil', 'gama-glutamil', 'γ-glutamil', 'gamaglutamil'],
  fosfatase_alcalina: ['fosfatase alcalina', 'alkaline phosphatase', 'fa '],
  bilirrubina_total: ['bilirrubina total', 'bilirrubinas'],
  bilirrubina_direta: ['bilirrubina direta', 'bilirrubinas'],
  albumina: ['albumina', 'albumin'],
  proteinas_totais: ['proteínas totais', 'proteinas totais', 'total protein'],
  ldh: ['ldh', 'desidrogenase láctica', 'desidrogenase lactica', 'lactato desidrogenase'],
  ck: ['ck ', 'ck-total', 'creatinoquinase', 'creatinofosfoquinase', 'cpk', 'creatina quinase'],
  creatinina: ['creatinina', 'creatinine'],
  ureia: ['ureia', 'uréia', 'bun', 'ureia sérica', 'ureia serica'],
  acido_urico: ['ácido úrico', 'acido urico', 'uric acid'],
  tfg: ['tfg', 'taxa de filtração', 'taxa de filtracao', 'ckd-epi', 'egfr', 'filtração glomerular', 'filtracao glomerular'],
  cistatina_c: ['cistatina c', 'cistatina-c', 'cystatin'],
  sodio: ['sódio', 'sodio', 'na+', 'na '],
  potassio: ['potássio', 'potassio', 'k+', 'k '],
  calcio_total: ['cálcio total', 'calcio total', 'cálcio sérico', 'calcio serico', 'ca total', 'cálcio', 'calcio'],
  calcio_ionico: ['cálcio iônico', 'calcio ionico', 'cálcio ionizado', 'calcio ionizado', 'ca++', 'ca2+', 'ca ionico'],
  fosforo: ['fósforo', 'fosforo', 'phosphorus', 'p inorgânico'],
  cloro: ['cloro', 'cloreto', 'chloride', 'cl '],
  bicarbonato: ['bicarbonato', 'hco3', 'co2 total'],
  pth: ['pth', 'paratormônio', 'paratormonio', 'paratireoidiano', 'parathormônio'],
  calcitonina: ['calcitonina', 'calcitonin'],
  pcr: ['pcr', 'proteína c reativa', 'proteina c reativa', 'proteina c-reativa', 'c-reactive', 'pcrhs', 'pcr-us', 'pcr ultra'],
  vhs: ['vhs', 'v.h.s', 'velocidade de hemossedimentação', 'velocidade de eritrossedimentação', 'eritrossedimentacao'],
  homocisteina: ['homocisteína', 'homocisteina', 'homocysteine'],
  fibrinogenio: ['fibrinogênio', 'fibrinogenio', 'fator i', 'clauss'],
  dimeros_d: ['dímeros d', 'dimeros d', 'd-dímero', 'd-dimero', 'dímero d', 'dimero d', 'fragmento d'],
  amilase: ['amilase', 'amylase', 'α-amilase', 'alfa-amilase', 'ams'],
  lipase: ['lipase', 'lps'],
  mercurio: ['mercúrio', 'mercurio', 'mercury', 'hg sangue'],
  cadmio: ['cádmio', 'cadmio', 'cadmium'],
  aluminio: ['alumínio', 'aluminio', 'aluminum'],
  cobalto: ['cobalto', 'cobalt'],
  arsenico: ['arsênico', 'arsenico', 'arsenic'],
  niquel: ['níquel', 'niquel', 'nickel'],
  fan: ['fan', 'fator anti-núcleo', 'fator antinúcleo', 'fator antinucleo', 'anticorpo antinúcleo'],
  fator_reumatoide: ['fator reumatoide', 'fator reumatóide', 'fr ', 'rheumatoid'],
  anti_endomisio_iga: ['anti-endomísio', 'anti-endomisio', 'antiendomísio', 'antiendomisio'],
  anti_transglutaminase_iga: ['anti-transglutaminase', 'transglutaminase', 'antitransglutaminase'],
  g6pd: ['g6pd', 'glicose-6-fosfato', 'glicose 6 fosfato'],
  hiv: ['hiv'],
  hbsag: ['hbsag', 'antígeno austrália', 'antigeno australia', 'hepatite b'],
  anti_hbs: ['anti-hbs', 'anti hbs', 'hepatite b'],
  anti_hbc_total: ['anti-hbc', 'anti hbc', 'hepatite b'],
  anti_hcv: ['anti-hcv', 'anti hcv', 'hepatite c'],
  sifilis_treponemico: ['sífilis', 'sifilis', 'treponema', 't. pallidum', 'anti-t. pallidum'],
  sifilis_vdrl: ['vdrl', 'cardiolipina', 'sífilis', 'sifilis'],
  toxoplasma_igg: ['toxoplasma', 'toxoplasmose'],
  toxoplasma_igm: ['toxoplasma', 'toxoplasmose'],
  vzv_igg: ['varicela', 'varicella', 'vzv', 'zoster'],
  vzv_igm: ['varicela', 'varicella', 'vzv', 'zoster'],
  hsv_igm: ['herpes simplex', 'herpes simples', 'hsv'],
  hsv1_igg: ['herpes simplex', 'herpes simples', 'hsv'],
  hsv2_igg: ['herpes simplex', 'herpes simples', 'hsv'],
  eletroforese_albumina: ['eletroforese', 'eletroforese de proteínas', 'eletroforese de proteinas'],
  eletroforese_alfa1: ['eletroforese', 'alfa 1', 'alfa-1'],
  eletroforese_alfa2: ['eletroforese', 'alfa 2', 'alfa-2'],
  eletroforese_beta1: ['eletroforese', 'beta 1', 'beta-1'],
  eletroforese_beta2: ['eletroforese', 'beta 2', 'beta-2'],
  eletroforese_gama: ['eletroforese', 'gama'],
  relacao_ag: ['eletroforese', 'relação a/g', 'relacao a/g', 'a/g'],
  ca_19_9: ['ca 19-9', 'ca 19.9', 'ca19-9', 'ca-19-9'],
  ca_125: ['ca-125', 'ca 125', 'ca125'],
  ca_72_4: ['ca 72-4', 'ca 72.4', 'ca72-4', 'ca-72-4'],
  ca_15_3: ['ca 15-3', 'ca 15.3', 'ca15-3', 'ca-15-3'],
  afp: ['afp', 'alfafetoproteína', 'alfafetoproteina', 'alfa-fetoproteína', 'alfa fetoproteina'],
  cea: ['cea', 'carcinoembrionário', 'carcinoembrionario', 'antígeno carcinoembrionário'],
  psa_total: ['psa total', 'psa', 'antígeno prostático', 'antigeno prostatico'],
  psa_livre: ['psa livre'],
  urina_cor: ['urina', 'eas', 'sumário de urina', 'sumario de urina', 'urina tipo'],
  urina_aspecto: ['urina', 'eas', 'sumário de urina', 'sumario de urina', 'urina tipo'],
  urina_densidade: ['urina', 'eas', 'densidade', 'urina tipo'],
  urina_ph: ['urina', 'eas', 'ph urin', 'urina tipo'],
  urina_proteinas: ['urina', 'eas', 'proteínas', 'urina tipo'],
  urina_glicose: ['urina', 'eas', 'glicose', 'urina tipo'],
  urina_hemoglobina: ['urina', 'eas', 'hemoglobina', 'urina tipo'],
  urina_leucocitos: ['urina', 'eas', 'leucócitos', 'leucocitos', 'urina tipo'],
  urina_leucocitos_quant: ['urina', 'eas', 'leucócitos', 'leucocitos', 'urina tipo'],
  urina_hemacias: ['urina', 'eas', 'hemácias', 'hemacias', 'urina tipo'],
  urina_hemacias_quant: ['urina', 'eas', 'hemácias', 'hemacias', 'urina tipo'],
  urina_bacterias: ['urina', 'eas', 'bactérias', 'bacterias', 'urina tipo'],
  urina_celulas: ['urina', 'eas', 'células epiteliais', 'celulas epiteliais', 'urina tipo'],
  urina_cilindros: ['urina', 'eas', 'cilindros', 'urina tipo'],
  urina_cristais: ['urina', 'eas', 'cristais', 'urina tipo'],
  urina_nitritos: ['urina', 'eas', 'nitritos', 'urina tipo'],
  urina_bilirrubina: ['urina', 'eas', 'bilirrubina', 'urina tipo'],
  urina_urobilinogenio: ['urina', 'eas', 'urobilinogênio', 'urobilinogenio', 'urina tipo'],
  urina_cetona: ['urina', 'eas', 'cetonas', 'cetona', 'urina tipo'],
  urina_muco: ['urina', 'eas', 'muco', 'filamento', 'urina tipo'],
  urina_albumina: ['urina', 'albumina', 'microalbuminúria', 'microalbuminuria'],
  urina_creatinina: ['urina', 'creatinina'],
  copro_cor: ['coprológico', 'coprologico', 'coprograma', 'parasitológico', 'parasitologico', 'fezes'],
  copro_consistencia: ['coprológico', 'coprologico', 'coprograma', 'fezes', 'consistência'],
  copro_muco: ['coprológico', 'coprologico', 'coprograma', 'fezes', 'muco'],
  copro_sangue: ['coprológico', 'coprologico', 'coprograma', 'fezes', 'sangue oculto'],
  copro_leucocitos: ['coprológico', 'coprologico', 'coprograma', 'fezes'],
  copro_hemacias: ['coprológico', 'coprologico', 'coprograma', 'fezes'],
  copro_parasitas: ['coprológico', 'coprologico', 'coprograma', 'parasitológico', 'parasitologico', 'fezes', 'parasita'],
  copro_gordura: ['coprológico', 'coprologico', 'coprograma', 'fezes', 'gordura'],
  copro_gordura_quant: ['coprológico', 'coprologico', 'coprograma', 'fezes', 'gordura'],
  copro_fibras: ['coprológico', 'coprologico', 'coprograma', 'fezes', 'fibras musculares'],
  copro_amido: ['coprológico', 'coprologico', 'coprograma', 'fezes', 'amido'],
  copro_residuos: ['coprológico', 'coprologico', 'coprograma', 'fezes', 'resíduos'],
  copro_ac_graxos: ['coprológico', 'coprologico', 'coprograma', 'fezes', 'ácidos graxos', 'acidos graxos'],
  copro_flora: ['coprológico', 'coprologico', 'coprograma', 'fezes', 'flora'],
  copro_ph: ['coprológico', 'coprologico', 'coprograma', 'fezes', 'ph'],
  copro_celulose: ['coprológico', 'coprologico', 'coprograma', 'fezes', 'celulose'],
  complemento_c3: ['complemento c3', 'c3 complemento', 'c3'],
  complemento_c4: ['complemento c4', 'c4 complemento', 'c4'],
  anti_dna: ['anti-dna', 'anti dna', 'anti-dsdna', 'anticorpo anti-dna'],
  anti_sm: ['anti-sm', 'anti sm', 'anticorpo anti-sm'],
  renina: ['renina', 'atividade de renina', 'arp'],
};

function crossCheckAllMarkers(results: any[], pdfText: string, beforeFallbackIds: Set<string>): any[] {
  // Normalize hyphens between letters and digits so "B-12"→"B12", "IGF-1"→"IGF1", "CA-125"→"CA125"
  const pdfLower = pdfText.toLowerCase().replace(/([a-z])-(\d)/gi, '$1$2');
  let discardCount = 0;
  
  const checked = results.filter(r => {
    // Exempt: regex fallback markers (already matched text patterns)
    if (!beforeFallbackIds.has(r.marker_id) && r._fromFallback) return true;
    
    // Exempt: calculated markers
    if (CALCULATED_MARKERS.has(r.marker_id)) return true;
    
    // Exempt: markers without defined terms (accept by default — better safe than sorry)
    const terms = MARKER_TEXT_TERMS[r.marker_id];
    if (!terms) return true;
    
    // Check if at least one term appears in the PDF text
    const found = terms.some(t => pdfLower.includes(t));
    if (!found) {
      console.log(`CROSS-CHECK: discarding ${r.marker_id} = ${r.value ?? r.text_value} — marker name NOT found in PDF text`);
      discardCount++;
      return false;
    }
    return true;
  });
  
  if (discardCount > 0) {
    console.log(`CROSS-CHECK: discarded ${discardCount} phantom markers total`);
  }
  return checked;
}

// ── Structural Validator ──
// Markers that can legitimately have negative values
const ALLOW_NEGATIVE = new Set<string>([]);

function validateExtraction(results: any[]): {
  results: any[];
  quality_score: number;
  issues: { level: string; marker_id?: string; message: string }[];
} {
  const issues: { level: string; marker_id?: string; message: string }[] = [];
  const validResults: any[] = [];
  const seenMarkers = new Map<string, any>();

  for (const r of results) {
    // 1. marker_id must be present
    if (!r.marker_id || typeof r.marker_id !== "string" || r.marker_id.trim() === "") {
      issues.push({ level: "error", message: "Item sem marker_id — removido" });
      continue;
    }

    const isQual = QUALITATIVE_IDS.has(r.marker_id);

    // 2. Must have value OR text_value
    const hasValue = typeof r.value === "number";
    const hasTextValue = typeof r.text_value === "string" && r.text_value.trim().length > 0;
    if (!hasValue && !hasTextValue) {
      issues.push({ level: "error", marker_id: r.marker_id, message: `${r.marker_id}: sem value nem text_value — removido` });
      continue;
    }

    // 3. Reject NaN / Infinity
    if (hasValue && (!Number.isFinite(r.value))) {
      issues.push({ level: "error", marker_id: r.marker_id, message: `${r.marker_id}: valor ${r.value} inválido (NaN/Infinity) — removido` });
      continue;
    }

    // 4. Reject negative values where clinically impossible
    if (hasValue && r.value < 0 && !ALLOW_NEGATIVE.has(r.marker_id) && !isQual) {
      issues.push({ level: "warning", marker_id: r.marker_id, message: `${r.marker_id}: valor negativo ${r.value} — zerado` });
      r.value = 0;
    }

    // 5. Duplicate detection — keep the one with lab_ref_text or higher value (more likely real)
    if (seenMarkers.has(r.marker_id)) {
      const existing = seenMarkers.get(r.marker_id);
      const existingHasRef = typeof existing.lab_ref_text === "string" && existing.lab_ref_text.length > 0;
      const newHasRef = typeof r.lab_ref_text === "string" && r.lab_ref_text.length > 0;

      if (newHasRef && !existingHasRef) {
        // Replace existing with this one
        const idx = validResults.indexOf(existing);
        if (idx !== -1) validResults[idx] = r;
        seenMarkers.set(r.marker_id, r);
        issues.push({ level: "warning", marker_id: r.marker_id, message: `${r.marker_id}: duplicata — mantido o com referência` });
      } else {
        issues.push({ level: "warning", marker_id: r.marker_id, message: `${r.marker_id}: duplicata descartada` });
      }
      continue;
    }

    seenMarkers.set(r.marker_id, r);
    validResults.push(r);
  }

  // Quality score
  const totalExtracted = results.length || 1;
  const validCount = validResults.length;
  const withRefCount = validResults.filter(
    (r) => typeof r.lab_ref_text === "string" && r.lab_ref_text.trim().length > 0
  ).length;

  const validRatio = validCount / totalExtracted;
  const refRatio = validCount > 0 ? withRefCount / validCount : 0;
  const quality_score = Math.round((validRatio * 0.7 + refRatio * 0.3) * 100) / 100;

  if (quality_score < 0.5) {
    issues.push({ level: "warning", message: `Quality score baixo: ${quality_score}` });
  }

  return { results: validResults, quality_score, issues };
}

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
            content: `Extract lab results from this Brazilian lab report. Extract ONLY markers that are EXPLICITLY PRESENT in this document with a clear result value. Do NOT guess or infer values for markers not shown.
${patientAge != null ? `\nPATIENT AGE: ${patientAge} years old. Use this to select the correct age-specific reference range when multiple ranges are listed.\n` : ''}
${patientSex ? `\nPATIENT SEX: ${patientSex}. Use this to select the correct sex-specific reference range when the lab shows separate ranges for males and females.\n` : ''}

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

Check all sections of the document including panels (Hemograma, Lipídios, Bilirrubinas, Ferro, Eletroforese, Urina, Fezes, Marcadores Tumorais, etc.) and standalone exams. Only extract markers you can actually see with a clear result value. Do NOT invent values for markers not present in the document.

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

DATE FORMAT (CRITICAL): Brazilian dates are ALWAYS DD/MM/YYYY (day first, month second).
"05/11/2025" = November 5, 2025 (NOT May 11, 2025). "24/02/2026" = February 24, 2026.
When converting to YYYY-MM-DD, the SECOND pair of digits is the MONTH, NOT the first.

LIPID REFERENCE RANGES WITH CATEGORIES (Colesterol Total, LDL, Não-HDL, Triglicerídeos):
When a lab report shows multiple risk categories (Ótimo, Desejável, Limítrofe, Alto, Muito Alto):
- ALWAYS use the upper bound of "Desejável" as lab_ref_max (NOT "Ótimo" which is more restrictive).
- Example: LDL categories "Ótimo < 100, Desejável 100-129, Limítrofe 130-159, Alto 160-189"
  → use lab_ref_text = "< 130" (upper bound of Desejável range)
- Example: Colesterol Total "Desejável < 200" → lab_ref_text = "< 200"
- If only "Desejável < X" is shown, use that value directly.

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
                    description: "Date the exams were COLLECTED (Data de Coleta / Data da Coleta). This is NOT the emission date (Data de Emissão) nor the print date. Look for labels: 'Data de Coleta', 'Data da Coleta', 'Coletado em', 'Data do Exame'. ONLY use 'Data de Emissão' or 'Emitido em' as LAST RESORT if no collection date exists. Format: YYYY-MM-DD. Brazilian dates are DD/MM/YYYY — the FIRST number is the DAY, SECOND is MONTH. Example: '23/11/2025' in the PDF → return '2025-11-23' (November 23), NEVER '2025-04-23'. Return null if not found."
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
    validResults = validateAndFixValues(validResults, patientSex, patientAge);
    // Post-process: calculate derived values if AI missed them
    validResults = postProcessResults(validResults);
    // Regex fallback for markers the AI frequently misses
    const beforeFallbackIds = new Set<string>(validResults.map((r: any) => r.marker_id));
    validResults = regexFallback(pdfText, validResults);
    // Validate fallback-added markers
    const fallbackAdded = validResults.filter((r: any) => !beforeFallbackIds.has(r.marker_id));
    if (fallbackAdded.length > 0) {
      console.log(`Regex fallback added ${fallbackAdded.length} markers: ${fallbackAdded.map((r: any) => r.marker_id).join(', ')}`);
      // Validate fallback markers (anti-hallucination, sanity checks)
      const fallbackValidated = validateAndFixValues(fallbackAdded, patientSex, patientAge);
      const fallbackValidatedIds = new Set(fallbackValidated.map((r: any) => r.marker_id));
      // Remove unvalidated fallback markers, keep only those that passed validation
      validResults = validResults.filter((r: any) => beforeFallbackIds.has(r.marker_id) || fallbackValidatedIds.has(r.marker_id));
      // Replace fallback entries with their validated versions
      validResults = validResults.map((r: any) => {
        if (!beforeFallbackIds.has(r.marker_id)) {
          return fallbackValidated.find((fv: any) => fv.marker_id === r.marker_id) || r;
        }
        return r;
      });
      // Re-run derived calculations with full set
      validResults = postProcessResults(validResults);
    }
    // Parse lab_ref_text into numeric min/max fields
    validResults = parseLabRefRanges(validResults);
    // === VALIDAÇÃO DHEA-S: ref por idade (após parseLabRefRanges para garantir min/max) ===
    if (patientAge != null) {
      const dheaRangesByAge: { minAge: number; maxAge: number; M: [number, number]; F: [number, number] }[] = [
        { minAge: 10, maxAge: 14, M: [24, 247],  F: [24, 247] },
        { minAge: 15, maxAge: 19, M: [70, 492],  F: [63, 373] },
        { minAge: 20, maxAge: 34, M: [160, 492], F: [65, 368] },
        { minAge: 35, maxAge: 44, M: [89, 427],  F: [45, 320] },
        { minAge: 45, maxAge: 54, M: [44, 331],  F: [32, 240] },
        { minAge: 55, maxAge: 64, M: [44, 331],  F: [26, 200] },
        { minAge: 65, maxAge: 74, M: [34, 249],  F: [20, 155] },
        { minAge: 75, maxAge: 120, M: [16, 123], F: [15, 95] },
      ];
      const ageRange = dheaRangesByAge.find(r => patientAge! >= r.minAge && patientAge! <= r.maxAge);
      if (ageRange) {
        for (const r of validResults) {
          if (r.marker_id === 'dhea_s') {
            const sex = (patientSex === 'F') ? 'F' : 'M';
            const [correctMin, correctMax] = ageRange[sex];
            if (r.lab_ref_min != null && r.lab_ref_min !== correctMin) {
              console.log(`DHEA-S: patient age ${patientAge}, sex ${sex}. Replacing ref ${r.lab_ref_min}-${r.lab_ref_max} with age-appropriate ${correctMin}-${correctMax}`);
              r.lab_ref_min = correctMin;
              r.lab_ref_max = correctMax;
              r.lab_ref_text = `${correctMin}-${correctMax}`;
            } else if (r.lab_ref_min == null) {
              console.log(`DHEA-S: no ref extracted. Setting age-appropriate ref ${correctMin}-${correctMax} for age ${patientAge}`);
              r.lab_ref_min = correctMin;
              r.lab_ref_max = correctMax;
              r.lab_ref_text = `${correctMin}-${correctMax}`;
            }
          }
        }
      }
    }
    // VLDL guard: discard inverted references (">=" or ">" is nonsensical for VLDL — lower is better)
    for (const r of validResults) {
      if (r.marker_id === 'vldl' && r.lab_ref_text && /^[>≥]/i.test(String(r.lab_ref_text).trim())) {
        console.log(`[VLDL-guard] Discarding inverted VLDL ref: "${r.lab_ref_text}"`);
        delete r.lab_ref_text; delete r.lab_ref_min; delete r.lab_ref_max;
      }
    }
    // Convert lab_ref units to match the stored value units (e.g. pmol/L → ng/dL for testosterona_livre)
    validResults = convertLabRefUnits(validResults);
    // Cross-check ALL markers against PDF text (anti-hallucination)
    validResults = crossCheckAllMarkers(validResults, pdfText, beforeFallbackIds);

    // ── Reference Overrides: force correct clinical limits for problematic markers ──
    const REFERENCE_OVERRIDES: Record<string, { min: number | null; max: number | null; text: string }> = {
      colesterol_total:   { min: null, max: 190,  text: '< 190 mg/dL' },
      hdl:                { min: 40,   max: null, text: '> 40 mg/dL' },
      ldl:                { min: null, max: 129,  text: '< 130 mg/dL' },
      colesterol_nao_hdl: { min: null, max: 130,  text: '< 130 mg/dL' },
      triglicerides:      { min: null, max: 150,  text: '< 150 mg/dL' },
      vldl:               { min: null, max: 30,   text: '< 30 mg/dL' },
      vitamina_b12:       { min: 300,  max: null, text: '> 300 pg/mL' },
      hba1c:              { min: null, max: 5.7,  text: '< 5,7%' },
    };
    for (const r of validResults) {
      const override = REFERENCE_OVERRIDES[r.marker_id];
      if (override) {
        // Only apply override if the lab didn't provide a valid reference.
        // This preserves personalized references (e.g. LDL < 70 for high-risk patients).
        const hasLabRef = r.lab_ref_text && r.lab_ref_text.trim().length > 0;
        if (hasLabRef) {
          console.log(`[REF-OVERRIDE] ${r.marker_id}: KEEPING lab ref "${r.lab_ref_text}" (override skipped — lab provided a reference)`);
        } else {
          console.log(`[REF-OVERRIDE] ${r.marker_id}: ref ${r.lab_ref_min}-${r.lab_ref_max} "${r.lab_ref_text}" → ${override.min}-${override.max} "${override.text}"`);
          r.lab_ref_min = override.min;
          r.lab_ref_max = override.max;
          r.lab_ref_text = override.text;
        }
      }
    }

    // ── Structural Validator ──
    const validation = validateExtraction(validResults);
    validResults = validation.results;

    // Extract exam_date from parsed response
    let examDate: string | null = (typeof parsed.exam_date === "string" && parsed.exam_date.match(/^\d{4}-\d{2}-\d{2}$/))
      ? parsed.exam_date
      : null;

    // ── Step 1: Try HIGH-CONFIDENCE "Data de Coleta" patterns FIRST ──
    // These unconditionally override ANY AI-extracted date.
    const highConfPatterns = [
      /(?:Data\s+d[aeo]\s+[Cc]olet[ao]|Colet(?:a|ado)\s*(?:em)?)[:\s]*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i,
    ];
    let highConfDateFound = false;
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
          examDate = candidate;
          highConfDateFound = true;
          break;
        }
        // If month > 12, day/month are probably swapped (DD/MM vs MM/DD)
        if (dayNum >= 1 && dayNum <= 12 && monthNum >= 1 && monthNum <= 31) {
          const candidate = `${year}-${dd.padStart(2, "0")}-${mm.padStart(2, "0")}`;
          console.log(`[DATE] High-confidence SWAPPED d/m: ${candidate} (overrides AI: ${examDate})`);
          examDate = candidate;
          highConfDateFound = true;
          break;
        }
      }
    }

    // ── Step 2: Only if NO high-confidence match, fall back to lower-priority patterns ──
    if (!highConfDateFound && !examDate) {
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

    console.log(`Extracted ${validResults.length} valid markers:`, validResults.map((r: any) => r.marker_id).join(', '));
    console.log(`Quality score: ${validation.quality_score}, issues: ${validation.issues.length}`);
    if (examDate) console.log(`Exam date extracted: ${examDate}`);
    return new Response(JSON.stringify({ results: validResults, exam_date: examDate, quality_score: validation.quality_score, issues: validation.issues }), {
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
