/**
 * functionalRanges.ts
 *
 * Referências funcionais (medicina funcional / integrativa) para marcadores laboratoriais.
 * Camada paralela — NÃO sobrescreve labRange, lab_ref_text, lab_ref_min ou lab_ref_max.
 * Usada exclusivamente na exportação Excel evolutivo.
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
  // ── Hemograma ──
  { marker_id: "hemoglobina",     range: { M: [14.0, 16.0], F: [12.5, 14.5] }, unit: "g/dL" },
  { marker_id: "hematocrito",     range: { M: [42, 48], F: [37, 43] }, unit: "%" },
  { marker_id: "vcm",             range: { M: [85, 95], F: [85, 95] }, unit: "fL" },
  { marker_id: "rdw",             range: { M: [11.5, 13.0], F: [11.5, 13.0] }, unit: "%" },
  { marker_id: "leucocitos",      range: { M: [5000, 8000], F: [5000, 8000] }, unit: "/µL" },
  { marker_id: "linfocitos",      range: { M: [25, 40], F: [25, 40] }, unit: "%" },
  { marker_id: "neutrofilos",     range: { M: [45, 65], F: [45, 65] }, unit: "%" },
  { marker_id: "plaquetas",       range: { M: [200, 350], F: [200, 350] }, unit: "mil/µL" },

  // ── Ferro ──
  { marker_id: "ferritina",       range: { M: [50, 200], F: [40, 150] }, unit: "ng/mL" },
  { marker_id: "ferro_serico",    range: { M: [80, 150], F: [70, 140] }, unit: "µg/dL" },
  { marker_id: "sat_transferrina", range: { M: [25, 45], F: [20, 45] }, unit: "%" },

  // ── Inflamação ──
  { marker_id: "pcr",             range: { M: [0, 1.0], F: [0, 1.0] }, unit: "mg/L" },
  { marker_id: "vhs",             range: { M: [0, 10], F: [0, 15] }, unit: "mm/h" },
  { marker_id: "homocisteina",    range: { M: [5, 8], F: [5, 8] }, unit: "µmol/L" },

  // ── Glicemia ──
  { marker_id: "glicose_jejum",   range: { M: [75, 90], F: [75, 90] }, unit: "mg/dL" },
  { marker_id: "hba1c",           range: { M: [4.5, 5.3], F: [4.5, 5.3] }, unit: "%" },
  { marker_id: "insulina_jejum",  range: { M: [2.0, 8.0], F: [2.0, 8.0] }, unit: "µU/mL" },
  { marker_id: "homa_ir",         range: { M: [0, 1.5], F: [0, 1.5] }, unit: "" },

  // ── Lipídios ──
  { marker_id: "colesterol_total", range: { M: [160, 200], F: [160, 200] }, unit: "mg/dL" },
  { marker_id: "hdl",             range: { M: [50, 999], F: [60, 999] }, unit: "mg/dL" },
  { marker_id: "ldl",             range: { M: [0, 100], F: [0, 100] }, unit: "mg/dL" },
  { marker_id: "triglicerides",   range: { M: [0, 100], F: [0, 100] }, unit: "mg/dL" },
  { marker_id: "relacao_tg_hdl",  range: { M: [0, 1.5], F: [0, 1.5] }, unit: "" },

  // ── Tireoide ──
  { marker_id: "tsh",             range: { M: [1.0, 2.5], F: [1.0, 2.5] }, unit: "mUI/L" },
  { marker_id: "t4_livre",        range: { M: [1.0, 1.5], F: [1.0, 1.5] }, unit: "ng/dL" },
  { marker_id: "t3_livre",        range: { M: [3.0, 4.0], F: [3.0, 4.0] }, unit: "pg/mL" },
  { marker_id: "t3_reverso",      range: { M: [9, 18], F: [9, 18] }, unit: "ng/dL" },

  // ── Hormônios ──
  { marker_id: "testosterona_total", range: { M: [500, 900], F: [20, 45] }, unit: "ng/dL" },
  { marker_id: "testosterona_livre", range: { M: [8, 20], F: [0.2, 0.8] }, unit: "ng/dL" },
  { marker_id: "estradiol",       range: { M: [15, 35], F: [50, 350] }, unit: "pg/mL" },
  { marker_id: "progesterona",    range: { M: [0.1, 1.0], F: [1.0, 20.0] }, unit: "ng/mL" },
  { marker_id: "dhea_s",          range: { M: [200, 450], F: [100, 350] }, unit: "µg/dL" },
  { marker_id: "cortisol",        range: { M: [10, 18], F: [10, 18] }, unit: "µg/dL" },
  { marker_id: "shbg",            range: { M: [20, 50], F: [40, 100] }, unit: "nmol/L" },

  // ── Vitaminas ──
  { marker_id: "vitamina_d",      range: { M: [40, 80], F: [40, 80] }, unit: "ng/mL" },
  { marker_id: "vitamina_b12",    range: { M: [500, 1000], F: [500, 1000] }, unit: "pg/mL" },
  { marker_id: "acido_folico",    range: { M: [10, 9999], F: [10, 9999] }, unit: "ng/mL" },

  // ── Minerais ──
  { marker_id: "magnesio",        range: { M: [2.0, 2.5], F: [2.0, 2.5] }, unit: "mg/dL" },
  { marker_id: "zinco",           range: { M: [80, 120], F: [80, 110] }, unit: "µg/dL" },
  { marker_id: "selenio",         range: { M: [70, 150], F: [70, 150] }, unit: "µg/L" },

  // ── Hepático ──
  { marker_id: "tgo_ast",         range: { M: [15, 30], F: [15, 25] }, unit: "U/L" },
  { marker_id: "tgp_alt",         range: { M: [10, 30], F: [10, 25] }, unit: "U/L" },
  { marker_id: "ggt",             range: { M: [10, 40], F: [6, 30] }, unit: "U/L" },
  { marker_id: "albumina",        range: { M: [4.0, 5.0], F: [4.0, 5.0] }, unit: "g/dL" },

  // ── Renal ──
  { marker_id: "creatinina",      range: { M: [0.8, 1.2], F: [0.6, 1.0] }, unit: "mg/dL" },
  { marker_id: "ureia",           range: { M: [15, 30], F: [15, 30] }, unit: "mg/dL" },
  { marker_id: "acido_urico",     range: { M: [3.5, 6.0], F: [2.5, 5.0] }, unit: "mg/dL" },

  // ── Eixo GH ──
  { marker_id: "igf1",            range: { M: [150, 300], F: [150, 300] }, unit: "ng/mL" },
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

  const [min, max] = effectiveRange;
  const refText = max >= 9000
    ? `> ${min} ${displayUnit}`
    : `${min} – ${max} ${displayUnit}`;

  if (value === null || value === undefined) {
    return { refText, status: null };
  }

  const status = value >= min && value <= max ? "normal" : "fora";
  return { refText, status };
}
