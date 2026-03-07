/**
 * unitInference.ts
 *
 * Camada de inferência de unidade fonte.
 * Responsável por DETECTAR qual unidade o lab usou e MARCAR o resultado
 * com metadados de conversão e auditoria.
 *
 * NÃO faz conversão — apenas marca. A conversão é feita por convert.ts.
 *
 * Prioridade de sinais (ordem decrescente de confiança):
 *   1. unit_raw — campo explícito de unidade do resultado (HIGH)
 *   2. lab_ref_text — unidade adjacente a valor numérico na referência (MEDIUM)
 *      Guards: value_heuristic + adjacência numérica obrigatórias
 *   3. value_heuristic — range do valor sozinho (LOW)
 *
 * Regra de ouro: na dúvida, NÃO converter.
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
// Build UNIT_CONVERSIONS from the shared conversionRules.ts source of truth.
// Value heuristics are kept here because they are runtime-only (not serializable).
import {
  CONVERSION_RULES as SHARED_RULES,
  compilePattern,
  getConversionRules,
} from "./pipeline/conversionRules.ts";
import { resolveMarkerId } from "./pipeline/markerAliases.ts";

/** Value heuristics per marker_id (canonical) + from_unit_label */
const VALUE_HEURISTICS: Record<string, Record<string, (v: number) => boolean>> = {
  t3_livre: {
    "ng/dL": (v) => v < 1.0,
    "pmol/L": (v) => v > 10,
  },
  estradiol: {
    "ng/dL": (v) => v < 10,
    "pmol/L": (v) => v > 500,
  },
  zinco: {
    "µg/mL": (v) => v < 10,
  },
  testosterona_livre: {
    "pmol/L": (v) => v > 100,
    "pg/mL": (v) => v > 1,
  },
  pcr: {
    "mg/dL": (v) => v > 0 && v < 0.5,
  },
  igfbp3: {
    "ng/mL": (v) => v > 100,
  },
  progesterona: {
    "ng/dL": (v) => v > 50,
  },
  dihidrotestosterona: {
    "pg/mL": (v) => v > 50,
  },
};

/**
 * Build UNIT_CONVERSIONS from shared rules + local heuristics.
 * Keys use the SAME IDs as the shared rules (canonical), plus aliases.
 */
function buildConversions(): Record<string, ConversionRule[]> {
  const result: Record<string, ConversionRule[]> = {};

  for (const [markerId, rules] of Object.entries(SHARED_RULES)) {
    const heuristics = VALUE_HEURISTICS[markerId] ?? {};
    result[markerId] = rules.map((r) => ({
      from_unit_pattern: compilePattern(r),
      from_unit_label: r.from_unit_label,
      to_unit: r.to_unit,
      factor: r.factor,
      value_heuristic: heuristics[r.from_unit_label],
    }));
  }

  return result;
}

export const UNIT_CONVERSIONS: Record<string, ConversionRule[]> = buildConversions();

// ---------------------------------------------------------------------------
// Confidence levels
// ---------------------------------------------------------------------------

export type InferenceConfidence = "high" | "medium" | "low";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Checks if a unit pattern appears adjacent to a numeric value in the text.
 * Prevents matching units from multi-line headers or unrelated sections.
 *
 * Valid: "1.5 a 6 ng/dL", "< 0.5 mg/dL", "Inferior a 34 U/mL"
 * Invalid: "Fase folicular:\nng/dL\n12.5 a 166 pg/mL" (ng/dL not near numbers)
 */
function isUnitAdjacentToNumber(text: string, unitPattern: RegExp): boolean {
  // Build a pattern: number (with optional decimal/comma) followed by optional
  // whitespace then the unit, OR the unit preceded by number context
  const unitSource = unitPattern.source;
  const adjacencyPattern = new RegExp(
    `\\d[\\d.,]*\\s*${unitSource}|${unitSource}\\s*[\\d.,]`,
    "i",
  );
  return adjacencyPattern.test(text);
}

// ---------------------------------------------------------------------------
// Detection logic
// ---------------------------------------------------------------------------

interface InferenceResult {
  rule: ConversionRule;
  confidence: InferenceConfidence;
  reason: string;
  evidence: string;
}

/**
 * Finds the applicable conversion rule for a result.
 * Returns the rule + confidence + reason + evidence trail.
 *
 * Guards (layered defense against false positives):
 *   - Priority 1 (unit_raw): No extra guard — explicit unit field is authoritative.
 *   - Priority 1b (lab_ref_text):
 *       a) Unit must appear adjacent to a numeric value in the text
 *       b) value_heuristic must pass if defined
 *   - Priority 2 (heuristic only): Only value range, weakest signal.
 */
function findApplicableRule(
  markerId: string,
  unitRaw: string | undefined,
  value: number | undefined,
  labRefText: string | undefined,
): InferenceResult | null {
  // Resolve alias before lookup (e.g. "dht" → "dihidrotestosterona")
  const canonicalId = resolveMarkerId(markerId);
  const rules = UNIT_CONVERSIONS[canonicalId];
  if (!rules) return null;

  // Priority 1: match by unit_raw (high confidence)
  // The result's own unit field is the strongest signal — no guards needed.
  if (unitRaw) {
    const matched = rules.find((r) => r.from_unit_pattern.test(unitRaw));
    if (matched) {
      return {
        rule: matched,
        confidence: "high",
        reason: `unit field matches ${matched.from_unit_label}`,
        evidence: `unit_raw="${unitRaw}"`,
      };
    }
  }

  // Priority 1b: match by lab_ref_text (medium confidence)
  // Double guard:
  //   a) Unit must be adjacent to a number (not a stray mention from multi-line header)
  //   b) value_heuristic must pass if defined (value must be plausible for the source unit)
  if (labRefText) {
    const matched = rules.find((r) => {
      if (!r.from_unit_pattern.test(labRefText)) return false;

      // Guard A: unit must appear next to a numeric value
      if (!isUnitAdjacentToNumber(labRefText, r.from_unit_pattern)) return false;

      // Guard B: if heuristic exists and value is available, require it to pass
      if (r.value_heuristic && value !== undefined && !r.value_heuristic(value)) return false;

      return true;
    });
    if (matched) {
      return {
        rule: matched,
        confidence: "medium",
        reason: `lab_ref_text contains ${matched.from_unit_label}`,
        evidence: `lab_ref_text="${labRefText}", value=${value}`,
      };
    }
  }

  // Priority 2: value heuristic only (low confidence)
  if (value !== undefined) {
    const matched = rules.find((r) => r.value_heuristic?.(value));
    if (matched) {
      return {
        rule: matched,
        confidence: "low",
        reason: `value ${value} matches heuristic for ${matched.from_unit_label}`,
        evidence: `value=${value}, no unit_raw, no lab_ref_text match`,
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
 * - _inferenceEvidence: raw evidence trail for auditability
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
    r._inferenceEvidence = match.evidence;

    console.log(
      `[INFER] ${r.marker_id}: detected ${r._sourceUnit} → ${r._targetUnit} (${r._conversionConfidence}: ${r._conversionReason})`,
    );
  }

  return results;
}
