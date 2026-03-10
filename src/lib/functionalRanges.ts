/**
 * functionalRanges.ts
 *
 * Referências funcionais (medicina funcional / integrativa) para marcadores laboratoriais.
 * Camada paralela — NÃO sobrescreve labRange, lab_ref_text, lab_ref_min ou lab_ref_max.
 * Usada exclusivamente na exportação Excel evolutivo.
 *
 * Fonte: tabela "Valores de Referência Otimizados – Medicina Funcional" (VR_BARBARA.pdf).
 *
 * Estrutura:
 *   - marker_id: deve coincidir com MARKERS[].id
 *   - range: { M: [min, max], F: [min, max] }
 *   - unit: unidade da faixa funcional (pode diferir da canônica do marcador)
 *
 * Se a unidade funcional diferir da unidade canônica do marcador,
 * a conversão é aplicada na faixa funcional antes da comparação.
 */

export interface FunctionalRange {
  marker_id: string;
  range: { M: [number, number]; F: [number, number] };
  /** Unidade em que a faixa funcional está expressa */
  unit: string;
}

/**
 * Tabela de referências funcionais da médica.
 * Fonte: VR_Barbara_Pozitel_2.pdf (V2 — março 2026).
 * Faixas mais estreitas que o laboratório convencional.
 */
export const FUNCTIONAL_RANGES: FunctionalRange[] = [
  // ═══════════════════════════════════════════════════════════════════
  // HEMOGRAMA  (V2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "hemoglobina",     range: { M: [14, 16], F: [13.5, 15.5] },     unit: "g/dL" },
  { marker_id: "hematocrito",     range: { M: [42, 48], F: [39, 47] },         unit: "%" },
  { marker_id: "vcm",             range: { M: [88, 92], F: [88, 92] },         unit: "fL" },
  { marker_id: "hcm",             range: { M: [27, 33], F: [27, 33] },         unit: "pg" },
  { marker_id: "chcm",            range: { M: [31, 35], F: [31, 35] },         unit: "g/dL" },
  { marker_id: "rdw",             range: { M: [11.5, 13], F: [11.5, 13] },     unit: "%" },
  { marker_id: "leucocitos",      range: { M: [4000, 6500], F: [4000, 6500] }, unit: "/µL" },
  { marker_id: "neutrofilos",     range: { M: [45, 55], F: [45, 55] },         unit: "%" },
  { marker_id: "linfocitos",      range: { M: [25, 35], F: [25, 35] },         unit: "%" },
  { marker_id: "monocitos",       range: { M: [3, 8], F: [3, 8] },             unit: "%" },
  { marker_id: "eosinofilos",     range: { M: [0, 3], F: [0, 3] },             unit: "%" },
  { marker_id: "basofilos",       range: { M: [0, 1], F: [0, 1] },             unit: "%" },
  { marker_id: "plaquetas",       range: { M: [250, 300], F: [250, 300] },     unit: "mil/µL" },

  // ═══════════════════════════════════════════════════════════════════
  // FERRO E METABOLISMO  (V2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "ferritina",       range: { M: [70, 200], F: [50, 150] },       unit: "ng/mL" },
  { marker_id: "ferro_serico",    range: { M: [80, 120], F: [80, 120] },       unit: "µg/dL" },
  { marker_id: "sat_transferrina", range: { M: [25, 40], F: [25, 40] },        unit: "%" },
  { marker_id: "tibc",            range: { M: [300, 400], F: [300, 400] },     unit: "µg/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // GLICEMIA E METABOLISMO  (V2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "glicose_jejum",   range: { M: [75, 90], F: [75, 90] },         unit: "mg/dL" },
  { marker_id: "hba1c",           range: { M: [0, 5.2], F: [0, 5.2] },         unit: "%" },
  { marker_id: "insulina_jejum",  range: { M: [3, 8], F: [3, 8] },             unit: "µU/mL" },
  { marker_id: "homa_ir",         range: { M: [0, 1.5], F: [0, 1.5] },         unit: "" },
  { marker_id: "peptideo_c",      range: { M: [1.5, 3.0], F: [1.5, 3.0] },     unit: "ng/mL" }, // novo V2

  // ═══════════════════════════════════════════════════════════════════
  // PERFIL LIPÍDICO  (V2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "colesterol_total", range: { M: [160, 200], F: [160, 200] },    unit: "mg/dL" },
  { marker_id: "hdl",             range: { M: [55, 9999], F: [60, 9999] },     unit: "mg/dL" },
  { marker_id: "ldl",             range: { M: [0, 100], F: [0, 100] },         unit: "mg/dL" },
  { marker_id: "vldl",            range: { M: [0, 15], F: [0, 15] },           unit: "mg/dL" },
  { marker_id: "triglicerides",   range: { M: [0, 100], F: [0, 100] },         unit: "mg/dL" },
  { marker_id: "apo_a1",          range: { M: [140, 9999], F: [140, 9999] },   unit: "mg/dL" },
  { marker_id: "apo_b",           range: { M: [0, 90], F: [0, 90] },           unit: "mg/dL" },
  { marker_id: "lipoproteina_a",  range: { M: [0, 30], F: [0, 30] },           unit: "nmol/L" },
  // colesterol_nao_hdl: removido — não encontrado no V2

  // ── Relações lipídicas (V2) ──
  { marker_id: "relacao_ct_hdl",  range: { M: [0, 3.5], F: [0, 3.5] },         unit: "" },
  { marker_id: "relacao_tg_hdl",  range: { M: [0, 2.0], F: [0, 2.0] },         unit: "" },
  { marker_id: "relacao_apob_apoa1", range: { M: [0, 0.7], F: [0, 0.6] },      unit: "" },

  // ═══════════════════════════════════════════════════════════════════
  // INFLAMAÇÃO E RISCO CARDIOVASCULAR  (V2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "homocisteina",    range: { M: [5, 7], F: [5, 7] },             unit: "µmol/L" },
  { marker_id: "pcr",             range: { M: [0, 1.0], F: [0, 1.0] },         unit: "mg/L" },
  // vhs: removido — não encontrado no V2
  { marker_id: "fibrinogenio",    range: { M: [200, 300], F: [200, 300] },     unit: "mg/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // TIREOIDE  (V2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "tsh",             range: { M: [0.5, 2.0], F: [0.5, 2.0] },     unit: "mUI/L" },
  { marker_id: "t4_livre",        range: { M: [1.2, 1.5], F: [1.2, 1.5] },     unit: "ng/dL" },
  { marker_id: "t3_livre",        range: { M: [3.2, 4.0], F: [3.2, 4.0] },     unit: "pg/mL" },
  { marker_id: "t3_reverso",      range: { M: [11, 18], F: [11, 18] },         unit: "ng/dL" },
  { marker_id: "anti_tpo",        range: { M: [0, 9], F: [0, 9] },             unit: "UI/mL" },
  { marker_id: "anti_tg",         range: { M: [0, 4], F: [0, 4] },             unit: "UI/mL" },
  // TRAb: V2 diz "Negativo" → tratado como qualitativo

  // ═══════════════════════════════════════════════════════════════════
  // HORMÔNIOS  (V2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "testosterona_total", range: { M: [600, 900], F: [35, 50] },    unit: "ng/dL" },
  { marker_id: "testosterona_livre", range: { M: [70, 9999], F: [1.1, 2.2] },  unit: "pg/mL" }, // V2: M >70 pg/mL, F 1.1-2.2 pg/mL
  // estradiol: removido — F depende de fase do ciclo (vazio no V2); M tem faixa 20-30 pg/mL
  // mas manter aqui geraria "> 0 pg/mL" para F, violando regra de branco no PDF.
  // Para evitar alucinação, removido completamente. Estradiol M pode ser adicionado
  // quando houver suporte a "range por sexo sem sentinel".
  // progesterona: removido — vazio no V2 para ambos os sexos
  // dhea_s: removido — vazio no V2 para ambos os sexos
  { marker_id: "cortisol",        range: { M: [10, 18], F: [10, 18] },         unit: "µg/dL" },
  { marker_id: "shbg",            range: { M: [20, 40], F: [60, 90] },         unit: "nmol/L" },
  { marker_id: "prolactina",      range: { M: [5, 10], F: [5, 15] },           unit: "ng/mL" },
  { marker_id: "amh",             range: { M: [0, 9999], F: [1.5, 4.0] },      unit: "ng/mL" }, // V2: só F definido; M não mencionado
  { marker_id: "fsh",             range: { M: [2, 5], F: [0, 9999] },           unit: "mUI/mL" }, // V2: só M definido; F vazio no V2
  { marker_id: "lh",              range: { M: [2, 5], F: [0, 9999] },           unit: "mUI/mL" }, // V2: só M definido; F vazio no V2
  { marker_id: "psa_total",       range: { M: [0, 2.5], F: [0, 2.5] },         unit: "ng/mL" },
  // dihidrotestosterona: removido — vazio no V2

  // ═══════════════════════════════════════════════════════════════════
  // VITAMINAS  (V2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "vitamina_d",      range: { M: [50, 90], F: [50, 80] },         unit: "ng/mL" },
  { marker_id: "vitamina_b12",    range: { M: [500, 1000], F: [500, 800] },    unit: "pg/mL" },
  { marker_id: "acido_folico",    range: { M: [15, 20], F: [15, 20] },         unit: "ng/mL" },
  { marker_id: "vitamina_a",      range: { M: [0.5, 0.7], F: [0.5, 0.7] },     unit: "mg/L" },
  { marker_id: "vitamina_c",      range: { M: [1.0, 9999], F: [1.0, 9999] },   unit: "mg/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // MINERAIS  (V2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "magnesio",        range: { M: [2.0, 2.4], F: [2.0, 2.4] },     unit: "mg/dL" },
  { marker_id: "zinco",           range: { M: [90, 110], F: [90, 110] },        unit: "µg/dL" },
  { marker_id: "selenio",         range: { M: [100, 140], F: [100, 140] },      unit: "µg/L" },
  { marker_id: "cobre",           range: { M: [80, 120], F: [80, 120] },        unit: "µg/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // HEPÁTICO  (V2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "tgo_ast",         range: { M: [10, 26], F: [10, 26] },         unit: "U/L" },
  { marker_id: "tgp_alt",         range: { M: [10, 26], F: [10, 26] },         unit: "U/L" },
  { marker_id: "ggt",             range: { M: [10, 30], F: [10, 30] },         unit: "U/L" },
  { marker_id: "fosfatase_alcalina", range: { M: [60, 90], F: [60, 90] },      unit: "U/L" },
  { marker_id: "albumina",        range: { M: [4.0, 5.0], F: [4.0, 5.0] },     unit: "g/dL" },
  { marker_id: "proteinas_totais", range: { M: [6.9, 7.4], F: [6.9, 7.4] },   unit: "g/dL" },
  { marker_id: "bilirrubina_total", range: { M: [0, 0.8], F: [0, 0.8] },      unit: "mg/dL" }, // novo V2
  { marker_id: "ldh",             range: { M: [135, 180], F: [135, 180] },     unit: "U/L" },
  { marker_id: "ck",              range: { M: [0, 150], F: [0, 100] },          unit: "U/L" },

  // ═══════════════════════════════════════════════════════════════════
  // RENAL  (V2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "creatinina",      range: { M: [0.8, 1.1], F: [0.7, 0.9] },     unit: "mg/dL" },
  { marker_id: "ureia",           range: { M: [13, 25], F: [13, 25] },         unit: "mg/dL" },
  { marker_id: "acido_urico",     range: { M: [3.5, 5.5], F: [3.0, 5.0] },     unit: "mg/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // ELETRÓLITOS  (V2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "sodio",           range: { M: [134, 140], F: [134, 140] },     unit: "mEq/L" },
  { marker_id: "potassio",        range: { M: [4.5, 5.1], F: [4.5, 5.1] },     unit: "mEq/L" },
  { marker_id: "cloro",           range: { M: [100, 106], F: [100, 106] },     unit: "mEq/L" },
  { marker_id: "calcio_total",    range: { M: [9.2, 10.1], F: [9.2, 10.1] },   unit: "mg/dL" },
  { marker_id: "calcio_ionico",  range: { M: [4.8, 5.2], F: [4.8, 5.2] },     unit: "mg/dL" }, // V2: mg/dL (não mmol/L)
  { marker_id: "pth",             range: { M: [15, 65], F: [15, 65] },         unit: "pg/mL" },

  // ═══════════════════════════════════════════════════════════════════
  // EIXO GH  (V2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "igf1",            range: { M: [150, 300], F: [150, 300] },     unit: "ng/mL" },
  { marker_id: "igfbp3",          range: { M: [3.0, 5.0], F: [3.0, 5.0] },     unit: "µg/mL" }, // V2 usa mg/L = µg/mL

  // ═══════════════════════════════════════════════════════════════════
  // EIXO ADRENAL  (V2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "acth",            range: { M: [10, 46], F: [10, 46] },         unit: "pg/mL" },
  { marker_id: "aldosterona",     range: { M: [5, 15], F: [5, 15] },           unit: "ng/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // PANCREÁTICO  (V2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "amilase",         range: { M: [30, 110], F: [30, 110] },       unit: "U/L" },
  { marker_id: "lipase",          range: { M: [10, 140], F: [10, 140] },       unit: "U/L" },

  // METAIS PESADOS: removidos da camada numérica.
  // No V2, metais são tratados como qualitativos ("<5 negativo", "<10 negativo").
  // Referências movidas para QUALITATIVE_FUNCTIONAL_RANGES.

  // ═══════════════════════════════════════════════════════════════════
  // COPROLÓGICO  (V2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "copro_ph",        range: { M: [6.5, 7.5], F: [6.5, 7.5] },     unit: "" },        // V2: pH fecal 6,5–7,5
];

// ── Index for fast lookup ──
const _index = new Map<string, FunctionalRange>();
for (const fr of FUNCTIONAL_RANGES) {
  _index.set(fr.marker_id, fr);
}

export function getFunctionalRange(markerId: string): FunctionalRange | undefined {
  return _index.get(markerId);
}

// ═══════════════════════════════════════════════════════════════════════════
// QUALITATIVE FUNCTIONAL REFERENCES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Referência funcional qualitativa para marcadores textuais (urina, fezes etc.).
 * Estrutura separada das referências numéricas — sem min/max.
 */
export interface QualitativeFunctionalRef {
  marker_id: string;
  reference_type: "qualitative";
  /** Texto esperado como "normal" (exibido na coluna Ref. Funcional) */
  expected_text: string;
  /** Todos os valores textuais considerados normais (já normalizados) */
  accepted_values: string[];
  /** Map de equivalências brutas → valor normalizado para comparação */
  normalization_map?: Record<string, string>;
}

/**
 * Normaliza texto qualitativo para comparação:
 * - lowercase, sem acentos, sem espaços extras, sem pontuação
 */
export function normalizeQualitativeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;:!?()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mapa global de normalização: variantes brutas → forma canônica */
const GLOBAL_NORMALIZATION: Record<string, string> = {
  // negativo (inclui formas femininas e variantes)
  "negativo": "negativo",
  "negativa": "negativo",
  "neg": "negativo",
  "nao detectado": "negativo",
  "nao detectada": "negativo",
  "não detectado": "negativo",
  "não detectada": "negativo",
  "nao detectavel": "negativo",
  "não detectável": "negativo",
  "n/d": "negativo",
  "nenhum": "negativo",
  "nenhuma": "negativo",
  "nao reativo": "negativo",
  "nao reativa": "negativo",
  "não reativo": "negativo",
  "não reativa": "negativo",
  "nao reagente": "negativo",
  "não reagente": "negativo",
  "indetectavel": "negativo",
  "indetectável": "negativo",
  // ausente
  "ausente": "ausente",
  "ausentes": "ausente",
  "nao observado": "ausente",
  "nao observada": "ausente",
  "não observado": "ausente",
  "não observada": "ausente",
  "nao observados": "ausente",
  "não observados": "ausente",
  "nao encontrado": "ausente",
  "nao encontrada": "ausente",
  "não encontrado": "ausente",
  "não encontrada": "ausente",
  "nao encontrados": "ausente",
  "não encontrados": "ausente",
  "nao visualizado": "ausente",
  "nao visualizada": "ausente",
  "nao visualizados": "ausente",
  // raríssimos
  "rarissimos": "rarissimos",
  "raríssimos": "rarissimos",
  "rarissimas": "rarissimos",
  "rarissima": "rarissimos",
  "raros": "raros",
  "raras": "raros",
  "raro": "raros",
  "rara": "raros",
  // normal
  "normal": "normal",
  "normals": "normal",
  "dentro da normalidade": "normal",
  // presente
  "presente": "presente",
  "presentes": "presente",
  "positivo": "presente",
  "positiva": "presente",
  "pos": "presente",
  "detectado": "presente",
  "detectada": "presente",
  "detectavel": "presente",
  "reativo": "presente",
  "reativa": "presente",
  "reagente": "presente",
};

/**
 * Detects "below detection limit" patterns like "< 0.10", "< 0,3", "<1.0"
 * These are lab results that mean the substance was not detected at measurable levels.
 * Returns the canonical form they should map to, or null if not a BDL pattern.
 */
function detectBelowDetectionLimit(text: string): string | null {
  // Match patterns: < number, <= number, with optional spaces, commas as decimal
  const bdlPattern = /^[<≤]\s*\d+[.,]?\d*$/;
  if (bdlPattern.test(text.trim())) {
    return "negativo";
  }
  return null;
}

/**
 * Map of marker_ids where below-detection-limit should map to a specific
 * canonical form OTHER than "negativo". E.g. urobilinogênio: "< 1.0" → "normal"
 */
const BDL_MARKER_OVERRIDES: Record<string, string> = {
  "urina_urobilinogenio": "normal",
};

/**
 * Tabela de referências funcionais qualitativas.
 * Cada entrada define o valor esperado e equivalências aceitas como "normal".
 */
export const QUALITATIVE_FUNCTIONAL_RANGES: QualitativeFunctionalRef[] = [
  // ═══════════════════════════════════════════════════════════════════
  // URINA
  // ═══════════════════════════════════════════════════════════════════
  {
    marker_id: "urina_nitritos",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo"],
  },
  {
    marker_id: "urina_bilirrubina",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo"],
  },
  {
    marker_id: "urina_cetona",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo"],
  },
  {
    marker_id: "urina_proteinas",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "urina_glicose",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "normal"],
  },
  {
    marker_id: "urina_hemoglobina",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "urina_cilindros",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo", "rarissimos"],
  },
  {
    marker_id: "urina_celulas",
    reference_type: "qualitative",
    expected_text: "Raras",
    accepted_values: ["raros", "rarissimos", "ausente", "negativo"],
  },
  {
    marker_id: "urina_bacterias",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo", "rarissimos", "raros"],
  },
  {
    marker_id: "urina_cristais",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo"],
  },
  {
    marker_id: "urina_muco",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "urina_urobilinogenio",
    reference_type: "qualitative",
    expected_text: "Normal",
    accepted_values: ["normal", "negativo"],
  },
  {
    marker_id: "urina_fungos",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "urina_fibras",
    reference_type: "qualitative",
    expected_text: "Presentes",
    accepted_values: ["presente"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // COPROLÓGICO
  // ═══════════════════════════════════════════════════════════════════
  {
    marker_id: "copro_parasitas",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "copro_sangue",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "copro_muco",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo"],
  },
  {
    marker_id: "copro_leucocitos",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo", "rarissimos", "raros"],
  },
  {
    marker_id: "copro_hemacias",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo"],
  },
  {
    marker_id: "copro_gordura",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "copro_fibras",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo", "rarissimos", "raros"],
  },
  // ═══════════════════════════════════════════════════════════════════
  // TIREOIDE QUALITATIVO (V2)
  // ═══════════════════════════════════════════════════════════════════
  {
    marker_id: "trab",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  // ═══════════════════════════════════════════════════════════════════
  // AUTOIMUNIDADE (V2)
  // ═══════════════════════════════════════════════════════════════════
  {
    marker_id: "fan",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "anti_endomisio",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "copro_amido",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo"],
  },
  {
    marker_id: "copro_residuos",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo"],
  },
  {
    marker_id: "copro_ac_graxos",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo"],
  },
  {
    marker_id: "copro_celulose",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo", "rarissimos"],
  },
  // ═══════════════════════════════════════════════════════════════════
  // METAIS PESADOS (V2: qualitativo — "<5 negativo", "<10 negativo")
  // ═══════════════════════════════════════════════════════════════════
  {
    marker_id: "mercurio",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "chumbo",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "aluminio",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "cadmio",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "cobalto",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "arsenio",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "niquel",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  // ═══════════════════════════════════════════════════════════════════
  // AUTOIMUNIDADE adicional (V2)
  // ═══════════════════════════════════════════════════════════════════
  {
    marker_id: "anti_endomisio_iga",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "anti_transglutaminase_iga",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
];

// ── Qualitative index ──
const _qualIndex = new Map<string, QualitativeFunctionalRef>();
for (const qr of QUALITATIVE_FUNCTIONAL_RANGES) {
  _qualIndex.set(qr.marker_id, qr);
}

export function getQualitativeFunctionalRef(markerId: string): QualitativeFunctionalRef | undefined {
  return _qualIndex.get(markerId);
}

/**
 * Resolve qualitative functional reference status.
 * Returns FunctionalResult with refText and status.
 */
export function resolveQualitativeFunctionalRef(
  markerId: string,
  textValue: string | null | undefined,
): FunctionalResult | null {
  const qr = _qualIndex.get(markerId);
  if (!qr) return null;

  const refText = qr.expected_text;

  if (!textValue || textValue.trim() === "") {
    return { refText, status: null };
  }

  // Normalize the input text
  const normalized = normalizeQualitativeText(textValue);

  // Try global normalization map first
  let mapped = GLOBAL_NORMALIZATION[normalized] ?? null;

  // If no direct match, try below-detection-limit pattern (e.g. "< 0.10")
  if (!mapped) {
    const bdl = detectBelowDetectionLimit(normalized);
    if (bdl) {
      // Some markers override BDL mapping (e.g. urobilinogênio → "normal" instead of "negativo")
      mapped = BDL_MARKER_OVERRIDES[markerId] ?? bdl;
    } else {
      mapped = normalized; // fallback to normalized text as-is
    }
  }

  // Check if mapped value is in accepted_values
  const isNormal = qr.accepted_values.includes(mapped);

  return { refText, status: isNormal ? "normal" : "fora" };
}

// ── Simple unit conversion for functional range adaptation ──
// Only converts the *functional range* to match the marker's canonical unit.

interface ConversionRule {
  from: string;
  to: string;
  factor: number;
}

const UNIT_CONVERSIONS: ConversionRule[] = [
  { from: "ng/dL", to: "pg/mL", factor: 10 },
  { from: "pg/mL", to: "ng/dL", factor: 0.1 },
  { from: "mg/dL", to: "mg/L", factor: 10 },
  { from: "mg/L",  to: "mg/dL", factor: 0.1 },
  { from: "µg/dL", to: "µg/L", factor: 10 },
  { from: "µg/L",  to: "µg/dL", factor: 0.1 },
  { from: "ng/mL", to: "ng/dL", factor: 100 },
  { from: "ng/dL", to: "ng/mL", factor: 0.01 },
  { from: "µg/mL", to: "mg/L", factor: 1 },
  { from: "mg/L",  to: "µg/mL", factor: 1 },
  { from: "mUI/L", to: "µIU/mL", factor: 1 },
  { from: "µIU/mL", to: "mUI/L", factor: 1 },
  { from: "mEq/L", to: "mmol/L", factor: 1 },
  { from: "mmol/L", to: "mEq/L", factor: 1 },
];

function normalizeUnit(u: string): string {
  return u.toLowerCase().replace(/\s/g, "").replace(/μ/g, "µ");
}

function convertRange(
  range: [number, number],
  fromUnit: string,
  toUnit: string
): [number, number] | null {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return range;

  const rule = UNIT_CONVERSIONS.find(
    (r) => normalizeUnit(r.from) === from && normalizeUnit(r.to) === to
  );
  if (!rule) return null; // can't convert — skip functional ref
  return [range[0] * rule.factor, range[1] * rule.factor];
}

// ── Public API for Excel ──

export interface FunctionalResult {
  refText: string;       // e.g. "75 – 90 mg/dL"
  status: "normal" | "fora" | null;
}

/**
 * Resolve functional reference for a given marker, value, sex, and canonical unit.
 * Returns null if no functional range exists for the marker.
 */
export function resolveFunctionalRef(
  markerId: string,
  value: number | null,
  sex: "M" | "F",
  canonicalUnit: string
): FunctionalResult | null {
  const fr = getFunctionalRange(markerId);
  if (!fr) return null;

  const rawRange = fr.range[sex];
  // If range is a sentinel [0, 9999] (meaning "no ref for this sex"), return null
  if (rawRange[0] === 0 && rawRange[1] >= 9000) return null;
  let effectiveRange = rawRange;
  let displayUnit = fr.unit;

  // Convert functional range to canonical unit if different
  if (normalizeUnit(fr.unit) !== normalizeUnit(canonicalUnit) && canonicalUnit) {
    const converted = convertRange(rawRange, fr.unit, canonicalUnit);
    if (!converted) return null; // Can't convert — don't show
    effectiveRange = converted;
    displayUnit = canonicalUnit;
  }

  const [rawMin, rawMax] = effectiveRange;
  // Round to avoid floating-point artifacts (e.g. 0.11000000000000001)
  const min = parseFloat(rawMin.toPrecision(10));
  const max = parseFloat(rawMax.toPrecision(10));
  const refText = max >= 9000
    ? `> ${min} ${displayUnit}`
    : min === 0
      ? `< ${max} ${displayUnit}`
      : `${min} – ${max} ${displayUnit}`;

  if (value === null || value === undefined) {
    return { refText, status: null };
  }

  const status = value >= min && value <= max ? "normal" : "fora";
  return { refText, status };
}
