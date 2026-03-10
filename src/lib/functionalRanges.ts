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
 * Faixas mais estreitas que o laboratório convencional.
 */
export const FUNCTIONAL_RANGES: FunctionalRange[] = [
  // ═══════════════════════════════════════════════════════════════════
  // HEMOGRAMA
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "hemoglobina",     range: { M: [13.5, 17.5], F: [12, 15.5] },   unit: "g/dL" },
  { marker_id: "hematocrito",     range: { M: [40, 50], F: [35, 45] },         unit: "%" },
  { marker_id: "vcm",             range: { M: [85, 95], F: [85, 95] },         unit: "fL" },
  { marker_id: "hcm",             range: { M: [26, 34], F: [26, 34] },         unit: "pg" },
  { marker_id: "chcm",            range: { M: [31, 36], F: [31, 36] },         unit: "g/dL" },
  { marker_id: "rdw",             range: { M: [10, 13], F: [10, 13] },         unit: "%" },
  { marker_id: "leucocitos",      range: { M: [3500, 6500], F: [3500, 6500] }, unit: "/µL" },
  { marker_id: "neutrofilos",     range: { M: [45, 55], F: [45, 55] },         unit: "%" },
  { marker_id: "linfocitos",      range: { M: [25, 35], F: [25, 35] },         unit: "%" },
  { marker_id: "monocitos",       range: { M: [3, 8], F: [3, 8] },             unit: "%" },
  { marker_id: "eosinofilos",     range: { M: [0, 3], F: [0, 3] },             unit: "%" },
  { marker_id: "basofilos",       range: { M: [0, 1], F: [0, 1] },             unit: "%" },
  { marker_id: "plaquetas",       range: { M: [150, 300], F: [150, 300] },     unit: "mil/µL" },

  // ═══════════════════════════════════════════════════════════════════
  // FERRO E METABOLISMO
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "ferritina",       range: { M: [70, 200], F: [50, 150] },       unit: "ng/mL" },
  { marker_id: "ferro_serico",    range: { M: [80, 120], F: [80, 120] },       unit: "µg/dL" },
  { marker_id: "sat_transferrina", range: { M: [20, 50], F: [20, 50] },        unit: "%" },
  { marker_id: "tibc",            range: { M: [300, 400], F: [300, 400] },     unit: "µg/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // GLICEMIA E METABOLISMO
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "glicose_jejum",   range: { M: [75, 90], F: [75, 90] },         unit: "mg/dL" },
  { marker_id: "hba1c",           range: { M: [0, 5.4], F: [0, 5.4] },         unit: "%" },
  { marker_id: "insulina_jejum",  range: { M: [0, 7], F: [0, 7] },             unit: "µU/mL" },
  { marker_id: "homa_ir",         range: { M: [0, 1.5], F: [0, 1.5] },         unit: "" },

  // ═══════════════════════════════════════════════════════════════════
  // PERFIL LIPÍDICO
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "colesterol_total", range: { M: [160, 200], F: [160, 200] },    unit: "mg/dL" },
  { marker_id: "hdl",             range: { M: [40, 9999], F: [46, 9999] },     unit: "mg/dL" },
  { marker_id: "ldl",             range: { M: [0, 115], F: [0, 115] },         unit: "mg/dL" },
  { marker_id: "vldl",            range: { M: [0, 15], F: [0, 15] },           unit: "mg/dL" },
  { marker_id: "triglicerides",   range: { M: [0, 100], F: [0, 100] },         unit: "mg/dL" },
  { marker_id: "apo_a1",          range: { M: [120, 9999], F: [120, 9999] },   unit: "mg/dL" },
  { marker_id: "apo_b",           range: { M: [0, 100], F: [0, 100] },         unit: "mg/dL" },
  { marker_id: "lipoproteina_a",  range: { M: [0, 30], F: [0, 30] },           unit: "nmol/L" },

  // ── Relações lipídicas ──
  { marker_id: "relacao_ct_hdl",  range: { M: [0, 3.5], F: [0, 3.5] },         unit: "" },
  { marker_id: "relacao_tg_hdl",  range: { M: [0, 2.0], F: [0, 2.0] },         unit: "" },
  { marker_id: "relacao_apob_apoa1", range: { M: [0, 0.7], F: [0, 0.6] },      unit: "" },

  // ═══════════════════════════════════════════════════════════════════
  // INFLAMAÇÃO E RISCO CARDIOVASCULAR
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "homocisteina",    range: { M: [0, 7], F: [0, 7] },             unit: "µmol/L" },
  { marker_id: "pcr",             range: { M: [0, 1.0], F: [0, 1.0] },         unit: "mg/L" },
  { marker_id: "vhs",             range: { M: [0, 10], F: [0, 15] },           unit: "mm/h" },
  { marker_id: "fibrinogenio",    range: { M: [0, 300], F: [0, 300] },         unit: "mg/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // TIREOIDE
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "tsh",             range: { M: [0.3, 2.5], F: [0.3, 2.5] },     unit: "mUI/L" },
  { marker_id: "t4_livre",        range: { M: [0.9, 1.5], F: [0.9, 1.5] },     unit: "ng/dL" },
  { marker_id: "t3_livre",        range: { M: [2.3, 4.2], F: [2.3, 4.2] },     unit: "pg/mL" },
  { marker_id: "t3_reverso",      range: { M: [11, 18], F: [11, 18] },         unit: "ng/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // HORMÔNIOS
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "testosterona_total", range: { M: [600, 900], F: [25, 50] },    unit: "ng/dL" },
  { marker_id: "testosterona_livre", range: { M: [6.6, 19.1], F: [1.1, 2.2] }, unit: "pg/mL" },
  { marker_id: "estradiol",       range: { M: [11, 43], F: [50, 350] },        unit: "pg/mL" },
  { marker_id: "progesterona",    range: { M: [0.1, 1.0], F: [1.0, 20.0] },   unit: "ng/mL" },
  { marker_id: "dhea_s",          range: { M: [200, 450], F: [100, 350] },     unit: "µg/dL" },
  { marker_id: "cortisol",        range: { M: [10, 15], F: [10, 15] },         unit: "µg/dL" },
  { marker_id: "shbg",            range: { M: [20, 50], F: [60, 90] },         unit: "nmol/L" },
  { marker_id: "prolactina",      range: { M: [0, 30], F: [0, 30] },           unit: "ng/mL" },
  { marker_id: "amh",             range: { M: [0.7, 19], F: [1.5, 4.0] },      unit: "ng/mL" },
  { marker_id: "fsh",             range: { M: [0, 10], F: [3.5, 12.5] },       unit: "mUI/mL" },
  { marker_id: "lh",              range: { M: [0, 9], F: [2.4, 12.6] },        unit: "mUI/mL" },
  { marker_id: "psa_total",       range: { M: [0, 2.5], F: [0, 2.5] },         unit: "ng/mL" },

  // ═══════════════════════════════════════════════════════════════════
  // VITAMINAS
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "vitamina_d",      range: { M: [40, 100], F: [40, 100] },       unit: "ng/mL" },
  { marker_id: "vitamina_b12",    range: { M: [650, 9999], F: [650, 9999] },   unit: "pg/mL" },
  { marker_id: "acido_folico",    range: { M: [15, 9999], F: [15, 9999] },     unit: "ng/mL" },
  { marker_id: "vitamina_a",      range: { M: [0.5, 0.7], F: [0.5, 0.7] },     unit: "µg/L" },
  { marker_id: "vitamina_c",      range: { M: [1.0, 9999], F: [1.0, 9999] },   unit: "mg/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // MINERAIS
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "magnesio",        range: { M: [2.1, 2.5], F: [2.1, 2.5] },     unit: "mg/dL" },
  { marker_id: "zinco",           range: { M: [90, 120], F: [90, 120] },        unit: "µg/dL" },
  { marker_id: "selenio",         range: { M: [90, 150], F: [90, 150] },        unit: "µg/L" },
  { marker_id: "cobre",           range: { M: [90, 130], F: [90, 130] },        unit: "µg/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // HEPÁTICO
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "tgo_ast",         range: { M: [0, 36], F: [0, 36] },           unit: "U/L" },
  { marker_id: "tgp_alt",         range: { M: [0, 31], F: [0, 31] },           unit: "U/L" },
  { marker_id: "ggt",             range: { M: [0, 35], F: [0, 35] },           unit: "U/L" },
  { marker_id: "fosfatase_alcalina", range: { M: [40, 129], F: [40, 129] },    unit: "U/L" },
  { marker_id: "albumina",        range: { M: [4.0, 5.0], F: [4.0, 5.0] },     unit: "g/dL" },
  { marker_id: "proteinas_totais", range: { M: [6.9, 7.4], F: [6.9, 7.4] },   unit: "g/dL" },
  { marker_id: "ldh",             range: { M: [135, 180], F: [135, 180] },     unit: "U/L" },
  { marker_id: "ck",              range: { M: [0, 150], F: [0, 100] },          unit: "U/L" },

  // ═══════════════════════════════════════════════════════════════════
  // RENAL
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "creatinina",      range: { M: [0.7, 1.1], F: [0.7, 1.1] },     unit: "mg/dL" },
  { marker_id: "ureia",           range: { M: [13, 25], F: [13, 25] },         unit: "mg/dL" },
  { marker_id: "acido_urico",     range: { M: [0, 5.5], F: [0, 5.5] },         unit: "mg/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // ELETRÓLITOS
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "sodio",           range: { M: [134, 140], F: [134, 140] },     unit: "mEq/L" },
  { marker_id: "potassio",        range: { M: [4.5, 5.1], F: [4.5, 5.1] },     unit: "mEq/L" },
  { marker_id: "cloro",           range: { M: [100, 106], F: [100, 106] },     unit: "mEq/L" },
  { marker_id: "calcio_total",    range: { M: [8.6, 10.3], F: [8.6, 10.3] },   unit: "mg/dL" },
  { marker_id: "pth",             range: { M: [15, 50], F: [15, 50] },         unit: "pg/mL" },

  // ═══════════════════════════════════════════════════════════════════
  // EIXO GH
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "igf1",            range: { M: [150, 300], F: [150, 300] },     unit: "ng/mL" },
  { marker_id: "igfbp3",          range: { M: [3.0, 5.0], F: [3.0, 5.0] },     unit: "µg/mL" },

  // ═══════════════════════════════════════════════════════════════════
  // EIXO ADRENAL
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "acth",            range: { M: [10, 46], F: [10, 46] },         unit: "pg/mL" },
  { marker_id: "aldosterona",     range: { M: [5, 15], F: [5, 15] },           unit: "ng/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // PANCREÁTICO
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "amilase",         range: { M: [30, 110], F: [30, 110] },       unit: "U/L" },
  { marker_id: "lipase",          range: { M: [0, 80], F: [0, 80] },           unit: "U/L" },
];

// ── Index for fast lookup ──
const _index = new Map<string, FunctionalRange>();
for (const fr of FUNCTIONAL_RANGES) {
  _index.set(fr.marker_id, fr);
}

export function getFunctionalRange(markerId: string): FunctionalRange | undefined {
  return _index.get(markerId);
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
