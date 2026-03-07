/**
 * pipeline/convert.ts
 *
 * Camada de conversão centralizada: único ponto de conversão de unidades.
 *
 * Regras fundamentais:
 * 1. Toda conversão acontece aqui — em nenhum outro lugar
 * 2. Resultado e referência são convertidos juntos (mesma função, mesmo fator)
 * 3. A função é idempotente — aplicar duas vezes produz o mesmo resultado
 * 4. Cada conversão é registrada em ConversionMetadata para auditoria
 * 5. Sem conversão silenciosa — se não há regra, retorna sem alterar
 */

import type {
  NormalizedResult,
  UnitInferenceResult,
  ConversionMetadata,
  PersistedExamResult,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Tabela de conversão centralizada
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Conversion rules: imported from the shared single source of truth
// ---------------------------------------------------------------------------

import {
  CONVERSION_RULES as SHARED_RULES,
  getConversionRules,
  type ConversionRuleDef,
} from "./conversionRules.ts";
import { resolveMarkerId } from "./markerAliases.ts";

// Re-export for consumers that depend on CONVERSION_TABLE
export { SHARED_RULES as CONVERSION_TABLE };

// ---------------------------------------------------------------------------
// Normalização de unidade para lookup na tabela
// ---------------------------------------------------------------------------

function normalizeUnit(unit: string): string {
  return unit
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace("μ", "µ")
    .replace("micro", "µ");
}

function findRule(markerId: string, fromUnit: string): ConversionRuleDef | null {
  const rules = getConversionRules(markerId);
  if (!rules) return null;
  const fromNorm = normalizeUnit(fromUnit);
  return rules.find((r) => normalizeUnit(r.from_unit_label) === fromNorm) ?? null;
}

// ---------------------------------------------------------------------------
// Função de conversão de um único valor (com idempotência)
// ---------------------------------------------------------------------------

/**
 * Aplica uma regra de conversão a um valor numérico.
 * Arredonda para 4 casas decimais para evitar floating point noise.
 */
function applyFactor(value: number, factor: number): number {
  return Math.round(value * factor * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Função principal de conversão
// ---------------------------------------------------------------------------

/**
 * Converte resultado e referência juntos para a unidade canônica.
 *
 * Idempotência garantida: se a unidade inferida já é a unidade canônica,
 * nenhuma conversão é aplicada e needs_conversion = false.
 */
export function convertResult(
  result: NormalizedResult,
  unitInference: UnitInferenceResult
): { converted: Partial<PersistedExamResult>; metadata: ConversionMetadata } {
  const noConversion: ConversionMetadata = {
    marker_id: result.marker_id,
    conversion_applied: false,
    conversion_reason: "Nenhuma conversão necessária",
    source_unit_inferred: unitInference.inferred_unit,
    target_unit: unitInference.target_unit,
    conversion_factor: null,
    original_value: result.value_normalized,
    original_ref_min: result.reference.min ?? null,
    original_ref_max: result.reference.max ?? null,
  };

  // Sem necessidade de conversão
  if (!unitInference.needs_conversion) {
    return {
      converted: {
        marker_id: result.marker_id,
        value: result.value_normalized,
        text_value: result.text_normalized,
        unit: unitInference.target_unit,
        lab_ref_min: result.reference.min ?? null,
        lab_ref_max: result.reference.max ?? null,
        lab_ref_text: result.reference.original_text,
      },
      metadata: noConversion,
    };
  }

  // Buscar regra de conversão
  const rule = findRule(result.marker_id, unitInference.inferred_unit);
  if (!rule) {
    return {
      converted: {
        marker_id: result.marker_id,
        value: result.value_normalized,
        text_value: result.text_normalized,
        unit: unitInference.inferred_unit, // mantém unidade original se sem regra
        lab_ref_min: result.reference.min ?? null,
        lab_ref_max: result.reference.max ?? null,
        lab_ref_text: result.reference.original_text,
      },
      metadata: {
        ...noConversion,
        conversion_reason: `Conversão necessária mas sem regra para ${unitInference.inferred_unit} → ${unitInference.target_unit}`,
      },
    };
  }

  // Aplicar conversão ao valor
  const convertedValue = result.value_normalized !== undefined
    ? applyFactor(result.value_normalized, rule.factor)
    : undefined;

  // Aplicar conversão à referência (resultado e referência juntos)
  const convertedRefMin = result.reference.min !== null && result.reference.min !== undefined
    ? applyFactor(result.reference.min, rule.factor)
    : null;
  const convertedRefMax = result.reference.max !== null && result.reference.max !== undefined
    ? applyFactor(result.reference.max, rule.factor)
    : null;

  // Reconstruir texto de referência com valores convertidos
  let convertedRefText = result.reference.original_text;
  if (convertedRefMin !== null && convertedRefMax !== null) {
    convertedRefText = `${convertedRefMin} a ${convertedRefMax}`;
  } else if (result.reference.operator && convertedRefMax !== null) {
    convertedRefText = `${result.reference.operator} ${convertedRefMax}`;
  } else if (result.reference.operator && convertedRefMin !== null) {
    convertedRefText = `${result.reference.operator} ${convertedRefMin}`;
  }

  return {
    converted: {
      marker_id: result.marker_id,
      value: convertedValue,
      text_value: result.text_normalized,
      unit: rule.to_unit,
      lab_ref_min: convertedRefMin,
      lab_ref_max: convertedRefMax,
      lab_ref_text: convertedRefText,
    },
    metadata: {
      marker_id: result.marker_id,
      conversion_applied: true,
      conversion_reason: rule.description,
      source_unit_inferred: rule.from_unit,
      target_unit: rule.to_unit,
      conversion_factor: rule.factor,
      original_value: result.value_normalized,
      original_ref_min: result.reference.min ?? null,
      original_ref_max: result.reference.max ?? null,
    },
  };
}

/**
 * Converte um array de resultados normalizados usando as inferências de unidade.
 */
export function convertResults(
  results: NormalizedResult[],
  unitInferences: Map<string, UnitInferenceResult>
): Array<{ converted: Partial<PersistedExamResult>; metadata: ConversionMetadata }> {
  return results.map((result) => {
    const inference = unitInferences.get(result.marker_id);
    if (!inference) {
      // Sem inferência — retornar sem conversão
      return {
        converted: {
          marker_id: result.marker_id,
          value: result.value_normalized,
          text_value: result.text_normalized,
          unit: result.unit_raw ?? "unknown",
          lab_ref_min: result.reference.min ?? null,
          lab_ref_max: result.reference.max ?? null,
          lab_ref_text: result.reference.original_text,
        },
        metadata: {
          marker_id: result.marker_id,
          conversion_applied: false,
          conversion_reason: "Sem inferência de unidade disponível",
          source_unit_inferred: result.unit_raw ?? "unknown",
          target_unit: result.unit_raw ?? "unknown",
          conversion_factor: null,
        },
      };
    }
    return convertResult(result, inference);
  });
}
