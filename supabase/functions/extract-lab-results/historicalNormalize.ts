/**
 * historicalNormalize.ts
 *
 * Pipeline de normalização para dados históricos.
 * Espelha as etapas do pipeline atual (normalize → infer → convert → scale)
 * mas opera sobre HistoricalEntry[] em vez de any[] (formato currentResults).
 *
 * Responsabilidades:
 * - Preservar raw_* para auditoria
 * - Normalizar operadores textuais
 * - Inferir unidade + converter para canônica
 * - Aplicar scale adjustments
 * - Marcar conversion_applied + conversion_reason
 *
 * NÃO modifica currentResults — opera exclusivamente sobre historicalResults.
 */

import { UNIT_CONVERSIONS, type ConversionRule } from "./unitInference.ts";
import { QUALITATIVE_IDS, MARKER_LIST } from "./constants.ts";
import type { HistoricalEntry, HistoricalMarkerTimeline } from "./historicalTypes.ts";

// ---------------------------------------------------------------------------
// Scale adjustments (subset of scale.ts — replicated inline to avoid
// importing Deno-specific module structures; kept in sync manually)
// ---------------------------------------------------------------------------

const HIST_SCALE_ADJUSTMENTS: Record<string, { min: number; max: number; fix: (v: number) => number }> = {
  leucocitos: { min: 1000, max: 30000, fix: (v) => {
    if (v < 30) return v * 1000;
    if (v < 100) return v * 100;
    if (v < 1000) return v * 10;
    return v;
  }},
  eritrocitos: { min: 1, max: 10, fix: (v) => v > 1000 ? v / 1000000 : v > 10 ? v / 10 : v },
  plaquetas: { min: 50, max: 700, fix: (v) => v > 1000 ? v / 1000 : v },
  tsh: { min: 0.01, max: 100, fix: (v) => v > 200 ? v / 100 : v },
  ferritina: { min: 1, max: 2000, fix: (v) => v > 2000 ? v / 10 : v },
};

// ---------------------------------------------------------------------------
// Operator normalization (subset of normalize.ts)
// ---------------------------------------------------------------------------

function normalizeOperator(textValue: string): { normalized: string; value: number | null } {
  const tv = textValue.trim();

  // "inferior a 34" → "< 34"
  const infMatch = tv.match(/^inferior\s+a\s+(\d+[.,]?\d*)/i);
  if (infMatch) {
    const num = parseFloat(infMatch[1].replace(",", "."));
    return { normalized: `< ${num}`, value: num };
  }

  // "superior a 90" → "> 90"
  const supMatch = tv.match(/^superior\s+a\s+(\d+[.,]?\d*)/i);
  if (supMatch) {
    const num = parseFloat(supMatch[1].replace(",", "."));
    return { normalized: `> ${num}`, value: num };
  }

  // Already symbolic: "< 34", "> 90"
  const symMatch = tv.match(/^([<>]=?)\s*([\d,\.]+)/);
  if (symMatch) {
    const num = parseFloat(symMatch[2].replace(",", "."));
    return { normalized: `${symMatch[1]} ${num}`, value: num };
  }

  return { normalized: tv, value: null };
}

// ---------------------------------------------------------------------------
// Unit conversion for a single entry
// ---------------------------------------------------------------------------

function findConversionRule(
  markerId: string,
  unitRaw: string | undefined,
  value: number | undefined,
): { rule: ConversionRule; reason: string } | null {
  const rules = UNIT_CONVERSIONS[markerId];
  if (!rules) return null;

  // Priority 1: match by unit
  if (unitRaw) {
    const matched = rules.find(r => r.from_unit_pattern.test(unitRaw));
    if (matched) {
      return { rule: matched, reason: `unit ${unitRaw} → ${matched.to_unit}` };
    }
  }

  // Priority 2: value heuristic
  if (value !== undefined) {
    const matched = rules.find(r => r.value_heuristic?.(value));
    if (matched) {
      return { rule: matched, reason: `heuristic: value ${value} suggests ${matched.from_unit_label}` };
    }
  }

  return null;
}

function applyFactor(value: number, factor: number): number {
  return Math.round(value * factor * 10000) / 10000;
}

function roundValue(value: number): number {
  if (value === 0) return 0;
  const abs = Math.abs(value);
  let decimals: number;
  if (abs >= 100) decimals = 0;
  else if (abs >= 10) decimals = 1;
  else if (abs >= 1) decimals = 2;
  else if (abs >= 0.1) decimals = 3;
  else decimals = 4;
  return parseFloat(value.toFixed(decimals));
}

// ---------------------------------------------------------------------------
// Main normalization function
// ---------------------------------------------------------------------------

/**
 * Normaliza um array de HistoricalMarkerTimeline[]:
 * 1. Preserva raw_* para auditoria
 * 2. Normaliza operadores textuais
 * 3. Infere unidade + converte para canônica
 * 4. Aplica scale adjustments
 * 5. Arredonda valores
 *
 * Opera in-place sobre os timelines.
 */
export function normalizeHistoricalResults(
  timelines: HistoricalMarkerTimeline[]
): HistoricalMarkerTimeline[] {
  for (const tl of timelines) {
    const markerId = tl.marker_id;
    const markerDef = MARKER_LIST.find(m => m.id === markerId);
    const canonicalUnit = markerDef?.unit || "";
    const isQualitative = QUALITATIVE_IDS.has(markerId);

    for (const entry of tl.entries) {
      // ── 1. Preserve raw values ──
      entry.raw_value = entry.value;
      entry.raw_text_value = entry.text_value;
      entry.raw_unit = entry.unit;
      entry.raw_ref_text = tl.reference_text;

      // ── 2. Normalize operators ──
      if (entry.text_value) {
        const { normalized, value: opValue } = normalizeOperator(entry.text_value);
        entry.text_value = normalized;
        if (opValue !== null && entry.value === undefined) {
          entry.value = opValue;
        }
      }

      // Skip further processing for qualitative markers
      if (isQualitative) {
        entry.unit = canonicalUnit;
        entry.conversion_applied = false;
        continue;
      }

      // ── 3. Infer unit + convert ──
      if (typeof entry.value === "number") {
        const match = findConversionRule(markerId, entry.unit, entry.value);
        if (match) {
          const originalValue = entry.value;
          entry.value = applyFactor(entry.value, match.rule.factor);
          entry.unit = match.rule.to_unit;
          entry.conversion_applied = true;
          entry.conversion_reason = `${match.reason}: ${originalValue} × ${match.rule.factor} = ${entry.value}`;
          console.log(`[HIST-CONVERT] ${markerId}: ${originalValue} ${match.rule.from_unit_label} → ${entry.value} ${match.rule.to_unit}`);
        } else {
          entry.unit = canonicalUnit;
          entry.conversion_applied = false;
        }

        // ── 4. Scale adjustment ──
        const adj = HIST_SCALE_ADJUSTMENTS[markerId];
        if (adj && (entry.value < adj.min || entry.value > adj.max)) {
          const before = entry.value;
          const fixed = adj.fix(entry.value);
          if (fixed >= adj.min * 0.3 && fixed <= adj.max * 3) {
            entry.value = fixed;
            console.log(`[HIST-SCALE] ${markerId}: ${before} → ${fixed}`);
          }
        }

        // ── 5. Round ──
        entry.value = roundValue(entry.value);
      } else {
        entry.unit = canonicalUnit;
        entry.conversion_applied = false;
      }
    }
  }

  return timelines;
}
