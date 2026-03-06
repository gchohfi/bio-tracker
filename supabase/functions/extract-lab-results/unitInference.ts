/**
 * unitInference.ts
 *
 * Camada de inferência de unidade fonte.
 * Responsável por DETECTAR qual unidade o lab usou e MARCAR o resultado
 * com _sourceUnit, _targetUnit, _conversionFactor, _conversionReason e _conversionConfidence.
 *
 * NÃO faz conversão — apenas marca. A conversão é feita por convert.ts.
 *
 * Regras:
 * 1. Toda decisão de "qual unidade é essa?" vive aqui
 * 2. Prioridade: unit_raw > lab_ref_text > heurística de valor
 * 3. Se não há sinal suficiente, não marca (resultado fica sem conversão)
 * 4. Tabela declarativa única (UNIT_CONVERSIONS) é a fonte de verdade
 */

// ---------------------------------------------------------------------------
// Tabela declarativa de conversões (fonte de verdade compartilhada)
// ---------------------------------------------------------------------------

export interface ConversionRule {
  /** Regex para detectar a unidade fonte (case-insensitive) */
  from_unit_pattern: RegExp;
  /** Nome legível da unidade fonte */
  from_unit_label: string;
  /** Unidade alvo canônica */
  to_unit: string;
  /** Fator de multiplicação: valor_destino = valor_origem × factor */
  factor: number;
  /** Heurística de valor: se unit_raw ausente, aplica se valor satisfaz esta condição */
  value_heuristic?: (v: number) => boolean;
}

/**
 * Tabela de conversão por marker_id.
 * A primeira regra que casa (por unit_raw ou heurística) é aplicada.
 * ADICIONAR NOVAS CONVERSÕES APENAS AQUI.
 */
export const UNIT_CONVERSIONS: Record<string, ConversionRule[]> = {
  t3_livre: [
    {
      from_unit_pattern: /ng\/d/i,
      from_unit_label: "ng/dL",
      to_unit: "pg/mL",
      factor: 10,
      value_heuristic: (v) => v < 1.0,
    },
    {
      from_unit_pattern: /pmol/i,
      from_unit_label: "pmol/L",
      to_unit: "pg/mL",
      factor: 1 / 15.36,
      value_heuristic: (v) => v > 10,
    },
  ],

  estradiol: [
    {
      from_unit_pattern: /ng\/d/i,
      from_unit_label: "ng/dL",
      to_unit: "pg/mL",
      factor: 10,
      // Values < 10 are plausibly ng/dL (1-9 ng/dL = 10-90 pg/mL).
      // Values >= 10 are likely already in pg/mL (e.g. 44 pg/mL follicular).
      value_heuristic: (v) => v < 10,
    },
    {
      from_unit_pattern: /pmol/i,
      from_unit_label: "pmol/L",
      to_unit: "pg/mL",
      factor: 0.2724,
    },
  ],

  zinco: [
    {
      from_unit_pattern: /[uµ]g\/m[lL]/i,
      from_unit_label: "µg/mL",
      to_unit: "µg/dL",
      factor: 100,
      value_heuristic: (v) => v < 10,
    },
    {
      from_unit_pattern: /mg\/[lL]/i,
      from_unit_label: "mg/L",
      to_unit: "µg/dL",
      factor: 100,
    },
  ],

  testosterona_livre: [
    {
      from_unit_pattern: /pmol/i,
      from_unit_label: "pmol/L",
      to_unit: "ng/dL",
      factor: 1 / 34.7,
      value_heuristic: (v) => v > 100,
    },
    {
      from_unit_pattern: /pg\/m/i,
      from_unit_label: "pg/mL",
      to_unit: "ng/dL",
      factor: 0.001,
    },
  ],

  pcr: [
    {
      from_unit_pattern: /mg\/d/i,
      from_unit_label: "mg/dL",
      to_unit: "mg/L",
      factor: 10,
      value_heuristic: (v) => v > 0 && v < 0.5,
    },
  ],

  igfbp3: [
    {
      from_unit_pattern: /ng\/m/i,
      from_unit_label: "ng/mL",
      to_unit: "µg/mL",
      factor: 0.001,
      value_heuristic: (v) => v > 100,
    },
  ],

  magnesio: [
    {
      from_unit_pattern: /mmol/i,
      from_unit_label: "mmol/L",
      to_unit: "mg/dL",
      factor: 2.4305,
    },
    {
      from_unit_pattern: /mEq/i,
      from_unit_label: "mEq/L",
      to_unit: "mg/dL",
      factor: 1.2153,
    },
  ],

  vitamina_d: [
    {
      from_unit_pattern: /nmol/i,
      from_unit_label: "nmol/L",
      to_unit: "ng/mL",
      factor: 0.4006,
    },
  ],

  progesterona: [
    {
      from_unit_pattern: /ng\/d/i,
      from_unit_label: "ng/dL",
      to_unit: "ng/mL",
      factor: 0.01,
      value_heuristic: (v) => v > 10,
    },
    {
      from_unit_pattern: /nmol/i,
      from_unit_label: "nmol/L",
      to_unit: "ng/mL",
      factor: 0.3145,
    },
  ],

  dht: [
    {
      from_unit_pattern: /ng\/d/i,
      from_unit_label: "ng/dL",
      to_unit: "pg/mL",
      factor: 10,
      value_heuristic: (v) => v < 5,
    },
  ],
};

// ---------------------------------------------------------------------------
// Confidence levels
// ---------------------------------------------------------------------------

export type InferenceConfidence = "high" | "medium" | "low";

// ---------------------------------------------------------------------------
// Detection logic
// ---------------------------------------------------------------------------

/**
 * Finds the applicable conversion rule for a result.
 * Returns the rule + confidence + reason.
 */
function findApplicableRule(
  markerId: string,
  unitRaw: string | undefined,
  value: number | undefined,
  labRefText: string | undefined,
): { rule: ConversionRule; confidence: InferenceConfidence; reason: string } | null {
  const rules = UNIT_CONVERSIONS[markerId];
  if (!rules) return null;

  // Priority 1: match by unit_raw (high confidence)
  if (unitRaw) {
    const matched = rules.find((r) => r.from_unit_pattern.test(unitRaw));
    if (matched) {
      return {
        rule: matched,
        confidence: "high",
        reason: `unit field matches ${matched.from_unit_label}`,
      };
    }
  }

  // Priority 1b: match by lab_ref_text (medium confidence)
  // Guard: if the rule has a value_heuristic, the value must also satisfy it.
  // This prevents false positives where the lab_ref_text mentions a unit
  // (e.g. in multi-line reference ranges) but the value is already canonical.
  if (labRefText) {
    const matched = rules.find((r) => {
      if (!r.from_unit_pattern.test(labRefText)) return false;
      // If heuristic exists and value is available, require it to pass
      if (r.value_heuristic && value !== undefined && !r.value_heuristic(value)) return false;
      return true;
    });
    if (matched) {
      return {
        rule: matched,
        confidence: "medium",
        reason: `lab_ref_text contains ${matched.from_unit_label}`,
      };
    }
  }

  // Priority 2: value heuristic (low confidence)
  if (value !== undefined) {
    const matched = rules.find((r) => r.value_heuristic?.(value));
    if (matched) {
      return {
        rule: matched,
        confidence: "low",
        reason: `value ${value} matches heuristic for ${matched.from_unit_label}`,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main inference function
// ---------------------------------------------------------------------------

/**
 * Infers the source unit for each result and marks them with:
 * - _sourceUnit: detected source unit label
 * - _targetUnit: canonical target unit
 * - _conversionFactor: multiplication factor
 * - _conversionReason: human-readable reason
 * - _conversionConfidence: "high" | "medium" | "low"
 *
 * Does NOT convert values. Only marks results for convert.ts.
 */
export function inferSourceUnit(results: any[]): any[] {
  for (const r of results) {
    // Already inferred or converted: skip
    if (r._sourceUnit || r._converted) continue;

    // Non-numeric: skip
    if (typeof r.value !== "number") continue;

    const match = findApplicableRule(
      r.marker_id,
      r.unit,
      r.value,
      r.lab_ref_text,
    );

    if (!match) continue;

    r._sourceUnit = match.rule.from_unit_label;
    r._targetUnit = match.rule.to_unit;
    r._conversionFactor = match.rule.factor;
    r._conversionReason = match.reason;
    r._conversionConfidence = match.confidence;

    console.log(
      `[INFER] ${r.marker_id}: detected ${r._sourceUnit} → ${r._targetUnit} (${r._conversionConfidence}: ${r._conversionReason})`,
    );
  }

  return results;
}
