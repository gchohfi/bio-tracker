import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { MARKER_LIST, QUALITATIVE_IDS, VALID_MARKER_IDS, CALCULATED_MARKERS, ALLOW_NEGATIVE, MARKER_TEXT_TERMS, DHEA_RANGES_BY_AGE, REFERENCE_OVERRIDES } from "./constants.ts";
import { toFloat, parseBrNum, OPERATOR_PATTERNS } from "./utils.ts";
import { normalizeOperatorText, deduplicateResults, parseLabRefRanges } from "./normalize.ts";
import { inferSourceUnit } from "./unitInference.ts";
import { applyUnitConversions } from "./convert.ts";
import { calculateDerivedValues, applyReferenceOverrides, enrichDheaReference, guardVldlReference } from "./derive.ts";
import { validateAndFixValues, sanitizeLabReferences, crossCheckAllMarkers, validateExtraction } from "./validate.ts";

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


// normalizeOperatorText and deduplicateResults moved to ./normalize.ts

// validateAndFixValues, sanitizeLabReferences moved to ./validate.ts
// calculateDerivedValues moved to ./derive.ts

// toFloat, OPERATOR_PATTERNS moved to ./utils.ts
// parseLabRefRanges moved to ./normalize.ts

/**
 * Regex fallback: busca marcadores que a AI perdeu diretamente no texto do PDF.
 * Roda DEPOIS da extração da AI. Só adiciona marcadores que a AI NÃO encontrou.
 * Otimizado para o formato Fleury onde o valor aparece APÓS "VALOR(ES) DE REFERÊNCIA".
 */
function regexFallback(pdfText: string, aiResults: any[]): any[] {
  const found = new Set(aiResults.map(r => r.marker_id));
  const additional: any[] = [];

  // parseBrNum imported from ./utils.ts

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

// validateExtraction moved to ./validate.ts


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
    let validResults = (parsed.results || []).filter((r: any) => {
      if (!VALID_MARKER_IDS.has(r.marker_id)) return false;
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
    // STEP 1a: Infer source units (unitInference.ts)
    validResults = inferSourceUnit(validResults);
    // STEP 1b: Apply conversions (convert.ts) — BEFORE scale fixes
    validResults = applyUnitConversions(validResults);
    // STEP 2: Scale adjustments and validation
    validResults = validateAndFixValues(validResults, patientSex, patientAge);
    // Calculate derived values (HOMA-IR, ratios, etc.) if AI missed them
    validResults = calculateDerivedValues(validResults);
    // Regex fallback for markers the AI frequently misses
    const beforeFallbackIds = new Set<string>(validResults.map((r: any) => r.marker_id));
    validResults = regexFallback(pdfText, validResults);
    // Validate fallback-added markers
    const fallbackAdded = validResults.filter((r: any) => !beforeFallbackIds.has(r.marker_id));
    if (fallbackAdded.length > 0) {
      console.log(`Regex fallback added ${fallbackAdded.length} markers: ${fallbackAdded.map((r: any) => r.marker_id).join(', ')}`);
      // Infer + convert units for fallback markers, then validate
      inferSourceUnit(fallbackAdded);
      applyUnitConversions(fallbackAdded);
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
      validResults = calculateDerivedValues(validResults);
    }
    // Parse lab_ref_text into numeric min/max fields
    validResults = parseLabRefRanges(validResults);
    // === DHEA-S: ref por idade (após parseLabRefRanges para garantir min/max) ===
    validResults = enrichDheaReference(validResults, patientAge, patientSex);
    // VLDL guard: discard inverted references
    validResults = guardVldlReference(validResults);
    // Sanitize lab references (percent markers, age ranges, sanity bounds) — NOT unit conversion
    validResults = sanitizeLabReferences(validResults);
    // Cross-check ALL markers against PDF text (anti-hallucination)
    validResults = crossCheckAllMarkers(validResults, pdfText, beforeFallbackIds);
    // Reference Overrides: force correct clinical limits for problematic markers
    validResults = applyReferenceOverrides(validResults);

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
