/**
 * pipeline/infer_unit.ts
 *
 * Camada de inferência de unidade: determina a unidade real do valor extraído
 * e se uma conversão é necessária para atingir a unidade canônica do sistema.
 *
 * Sinais usados (em ordem de prioridade):
 * 1. lab_ref_text / lab_ref_min / lab_ref_max — referência do laudo (sinal mais forte)
 * 2. unit_raw — unidade extraída pela IA
 * 3. Faixa de valor plausível — último recurso
 *
 * Retorna confidence e reason para auditoria.
 */

import type {
  NormalizedResult,
  UnitInferenceResult,
  UnitConfidence,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Tabela de unidades canônicas por marcador
// ---------------------------------------------------------------------------

/** Definição de unidade canônica e regras de inferência por marcador */
interface MarkerUnitDef {
  /** Unidade canônica esperada pelo sistema */
  canonical_unit: string;
  /** Unidades alternativas que indicam necessidade de conversão */
  alt_units: string[];
  /** Faixa plausível na unidade canônica (para inferência por magnitude) */
  plausible_range?: { min: number; max: number };
  /** Faixa da referência esperada na unidade canônica (sinal forte) */
  expected_ref_range?: { min: number; max: number };
}

export const MARKER_UNIT_DEFS: Record<string, MarkerUnitDef> = {
  // Hormônios sexuais
  estradiol: {
    canonical_unit: "pg/mL",
    alt_units: ["ng/dL", "ng/L", "pmol/L"],
    plausible_range: { min: 5, max: 5000 },
    expected_ref_range: { min: 10, max: 600 },
  },
  progesterona: {
    canonical_unit: "ng/mL",
    alt_units: ["ng/dL", "nmol/L"],
    plausible_range: { min: 0.01, max: 50 },
    expected_ref_range: { min: 0.1, max: 30 },
  },
  testosterona_total: {
    canonical_unit: "ng/dL",
    alt_units: ["nmol/L", "ng/mL", "pg/mL"],
    plausible_range: { min: 1, max: 1500 },
    expected_ref_range: { min: 5, max: 900 },
  },
  testosterona_livre: {
    canonical_unit: "ng/dL",
    alt_units: ["pmol/L", "pg/mL", "nmol/L"],
    plausible_range: { min: 0.01, max: 30 },
    expected_ref_range: { min: 0.05, max: 25 },
  },
  dht: {
    canonical_unit: "pg/mL",
    alt_units: ["ng/dL", "nmol/L"],
    plausible_range: { min: 10, max: 1000 },
    expected_ref_range: { min: 20, max: 500 },
  },
  dhea_s: {
    canonical_unit: "µg/dL",
    alt_units: ["µmol/L", "nmol/L", "mg/dL"],
    plausible_range: { min: 10, max: 700 },
    expected_ref_range: { min: 30, max: 500 },
  },
  // Tireoide
  t3_livre: {
    canonical_unit: "pg/mL",
    alt_units: ["ng/dL", "pmol/L"],
    plausible_range: { min: 1, max: 10 },
    expected_ref_range: { min: 1.5, max: 6 },
  },
  t4_livre: {
    canonical_unit: "ng/dL",
    alt_units: ["pmol/L", "ng/mL"],
    plausible_range: { min: 0.5, max: 3 },
    expected_ref_range: { min: 0.7, max: 2.5 },
  },
  tsh: {
    canonical_unit: "mUI/L",
    alt_units: ["µUI/mL", "mIU/L"],
    plausible_range: { min: 0.01, max: 100 },
  },
  // Inflamação
  pcr: {
    canonical_unit: "mg/L",
    alt_units: ["mg/dL"],
    plausible_range: { min: 0, max: 300 },
    expected_ref_range: { min: 0, max: 10 },
  },
  // Lipídios
  lipoproteina_a: {
    canonical_unit: "nmol/L",
    alt_units: ["mg/dL", "mg/L"],
    plausible_range: { min: 0, max: 500 },
    expected_ref_range: { min: 0, max: 125 },
  },
  // Minerais
  zinco: {
    canonical_unit: "µg/dL",
    alt_units: ["µg/mL", "mg/L", "mmol/L"],
    plausible_range: { min: 40, max: 200 },
    expected_ref_range: { min: 50, max: 150 },
  },
  magnesio: {
    canonical_unit: "mg/dL",
    alt_units: ["mmol/L", "mEq/L"],
    plausible_range: { min: 1, max: 5 },
    expected_ref_range: { min: 1.5, max: 3 },
  },
  // Vitaminas
  vitamina_d: {
    canonical_unit: "ng/mL",
    alt_units: ["nmol/L"],
    plausible_range: { min: 3, max: 200 },
  },
  // Glicemia
  glicose_jejum: {
    canonical_unit: "mg/dL",
    alt_units: ["mmol/L"],
    plausible_range: { min: 40, max: 500 },
  },
  // Hemograma
  hemoglobina: {
    canonical_unit: "g/dL",
    alt_units: ["g/L"],
    plausible_range: { min: 5, max: 25 },
    expected_ref_range: { min: 10, max: 20 },
  },
};

// ---------------------------------------------------------------------------
// Normalização de string de unidade para comparação
// ---------------------------------------------------------------------------

/** Normaliza string de unidade para comparação case-insensitive */
function normalizeUnitString(unit: string): string {
  return unit
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace("μ", "µ")
    .replace("micro", "µ")
    .replace("miu", "mui")
    .replace("miu/l", "mui/l");
}

/** Verifica se duas unidades são equivalentes */
function unitsMatch(a: string, b: string): boolean {
  return normalizeUnitString(a) === normalizeUnitString(b);
}

// ---------------------------------------------------------------------------
// Inferência por referência do laboratório (sinal mais forte)
// ---------------------------------------------------------------------------

/**
 * Tenta inferir a unidade comparando a faixa de referência do laudo
 * com a faixa esperada na unidade canônica.
 *
 * Se a referência do laudo está na mesma ordem de grandeza que a faixa
 * esperada na unidade canônica → unidade já é a canônica.
 *
 * Se está na ordem de grandeza de uma unidade alternativa → precisa converter.
 */
function inferFromReference(
  markerId: string,
  refMin: number | null | undefined,
  refMax: number | null | undefined,
  def: MarkerUnitDef
): { unit: string; confidence: UnitConfidence; reason: string } | null {
  if (!def.expected_ref_range) return null;
  if (refMin === null || refMin === undefined) return null;
  if (refMax === null || refMax === undefined) return null;

  const refMid = (refMin + refMax) / 2;
  const expectedMid = (def.expected_ref_range.min + def.expected_ref_range.max) / 2;

  if (expectedMid <= 0 || refMid <= 0) return null;

  const ratio = Math.max(expectedMid / refMid, refMid / expectedMid);

  // Referência compatível com unidade canônica (ratio < 5x)
  if (ratio < 5) {
    return {
      unit: def.canonical_unit,
      confidence: "high",
      reason: `Referência do laudo [${refMin}–${refMax}] compatível com faixa esperada [${def.expected_ref_range.min}–${def.expected_ref_range.max}] na unidade canônica ${def.canonical_unit} (ratio=${ratio.toFixed(1)}x)`,
    };
  }

  // Referência incompatível — provavelmente unidade alternativa
  return {
    unit: "unknown",
    confidence: "low",
    reason: `Referência do laudo [${refMin}–${refMax}] incompatível com faixa esperada [${def.expected_ref_range.min}–${def.expected_ref_range.max}] (ratio=${ratio.toFixed(1)}x) — possível unidade alternativa`,
  };
}

// ---------------------------------------------------------------------------
// Função principal de inferência
// ---------------------------------------------------------------------------

/**
 * Infere a unidade de um resultado normalizado e determina se conversão é necessária.
 */
export function inferUnit(result: NormalizedResult): UnitInferenceResult {
  const def = MARKER_UNIT_DEFS[result.marker_id];

  // Marcador sem definição de unidade — nenhuma conversão necessária
  if (!def) {
    return {
      marker_id: result.marker_id,
      inferred_unit: result.unit_raw ?? "unknown",
      target_unit: result.unit_raw ?? "unknown",
      confidence: "low",
      reason: "Marcador sem definição de unidade canônica — sem conversão",
      needs_conversion: false,
    };
  }

  // --- Sinal 1: Unidade bruta da IA ---
  if (result.unit_raw) {
    const rawNorm = normalizeUnitString(result.unit_raw);
    const canonicalNorm = normalizeUnitString(def.canonical_unit);

    // Unidade já é a canônica
    if (unitsMatch(result.unit_raw, def.canonical_unit)) {
      return {
        marker_id: result.marker_id,
        inferred_unit: def.canonical_unit,
        target_unit: def.canonical_unit,
        confidence: "high",
        reason: `Unidade extraída "${result.unit_raw}" corresponde à unidade canônica ${def.canonical_unit}`,
        needs_conversion: false,
      };
    }

    // Unidade é uma das alternativas conhecidas
    const matchedAlt = def.alt_units.find((alt) => unitsMatch(result.unit_raw!, alt));
    if (matchedAlt) {
      return {
        marker_id: result.marker_id,
        inferred_unit: matchedAlt,
        target_unit: def.canonical_unit,
        confidence: "high",
        reason: `Unidade extraída "${result.unit_raw}" é alternativa conhecida de ${def.canonical_unit} — conversão necessária`,
        needs_conversion: true,
      };
    }
  }

  // --- Sinal 2: Referência do laboratório ---
  const refResult = inferFromReference(
    result.marker_id,
    result.reference.min,
    result.reference.max,
    def
  );

  if (refResult && refResult.confidence !== "low") {
    return {
      marker_id: result.marker_id,
      inferred_unit: refResult.unit,
      target_unit: def.canonical_unit,
      confidence: refResult.confidence,
      reason: refResult.reason,
      needs_conversion: refResult.unit !== def.canonical_unit,
    };
  }

  // --- Sinal 3: Magnitude do valor (último recurso) ---
  if (result.value_normalized !== undefined && def.plausible_range) {
    const v = result.value_normalized;
    const { min, max } = def.plausible_range;
    if (v >= min && v <= max) {
      return {
        marker_id: result.marker_id,
        inferred_unit: def.canonical_unit,
        target_unit: def.canonical_unit,
        confidence: "medium",
        reason: `Valor ${v} dentro da faixa plausível [${min}–${max}] para ${def.canonical_unit}`,
        needs_conversion: false,
      };
    }
  }

  // Não foi possível inferir com confiança
  return {
    marker_id: result.marker_id,
    inferred_unit: result.unit_raw ?? "unknown",
    target_unit: def.canonical_unit,
    confidence: "low",
    reason: `Não foi possível inferir unidade com confiança para ${result.marker_id}`,
    needs_conversion: false,
  };
}

/**
 * Infere unidades para um array de resultados normalizados.
 */
export function inferUnits(results: NormalizedResult[]): Map<string, UnitInferenceResult> {
  const map = new Map<string, UnitInferenceResult>();
  for (const result of results) {
    map.set(result.marker_id, inferUnit(result));
  }
  return map;
}
