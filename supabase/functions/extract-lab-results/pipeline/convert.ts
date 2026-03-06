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

/** Definição de uma conversão de unidade */
interface ConversionRule {
  /** Unidade de origem */
  from_unit: string;
  /** Unidade de destino (canônica) */
  to_unit: string;
  /** Fator de multiplicação: valor_destino = valor_origem × factor */
  factor: number;
  /** Descrição legível da conversão */
  description: string;
}

/**
 * Tabela de conversão: marker_id → lista de regras.
 * A primeira regra com from_unit correspondente à unidade inferida é aplicada.
 *
 * IMPORTANTE: Adicionar novas conversões APENAS aqui.
 */
export const CONVERSION_TABLE: Record<string, ConversionRule[]> = {
  // Estradiol: ng/dL → pg/mL (fator 10)
  estradiol: [
    {
      from_unit: "ng/dL",
      to_unit: "pg/mL",
      factor: 10,
      description: "Estradiol ng/dL → pg/mL (×10)",
    },
    {
      from_unit: "pmol/L",
      to_unit: "pg/mL",
      factor: 0.2724,
      description: "Estradiol pmol/L → pg/mL (÷3.671)",
    },
  ],

  // Progesterona: ng/dL → ng/mL (fator 0.01)
  progesterona: [
    {
      from_unit: "ng/dL",
      to_unit: "ng/mL",
      factor: 0.01,
      description: "Progesterona ng/dL → ng/mL (÷100)",
    },
    {
      from_unit: "nmol/L",
      to_unit: "ng/mL",
      factor: 0.3145,
      description: "Progesterona nmol/L → ng/mL (÷3.18)",
    },
  ],

  // DHT (Dihidrotestosterona): ng/dL → pg/mL (fator 10)
  dht: [
    {
      from_unit: "ng/dL",
      to_unit: "pg/mL",
      factor: 10,
      description: "DHT ng/dL → pg/mL (×10)",
    },
  ],

  // Testosterona Livre: pmol/L → ng/dL (fator 1/34.7)
  testosterona_livre: [
    {
      from_unit: "pmol/L",
      to_unit: "ng/dL",
      factor: 1 / 34.7,
      description: "Testosterona Livre pmol/L → ng/dL (÷34.7)",
    },
    {
      from_unit: "pg/mL",
      to_unit: "ng/dL",
      factor: 0.001,
      description: "Testosterona Livre pg/mL → ng/dL (÷1000)",
    },
  ],

  // T3 Livre: pg/mL → ng/dL (fator 0.1) ou pmol/L → ng/dL (fator 1/15.36)
  t3_livre: [
    {
      from_unit: "pg/mL",
      to_unit: "ng/dL",
      factor: 0.1,
      description: "T3 Livre pg/mL → ng/dL (÷10)",
    },
    {
      from_unit: "pmol/L",
      to_unit: "ng/dL",
      factor: 1 / 15.36,
      description: "T3 Livre pmol/L → ng/dL (÷15.36)",
    },
  ],

  // Zinco: µg/mL → µg/dL (fator 100) ou mg/L → µg/dL (fator 100)
  zinco: [
    {
      from_unit: "µg/mL",
      to_unit: "µg/dL",
      factor: 100,
      description: "Zinco µg/mL → µg/dL (×100)",
    },
    {
      from_unit: "mg/L",
      to_unit: "µg/dL",
      factor: 100,
      description: "Zinco mg/L → µg/dL (×100)",
    },
  ],

  // PCR: mg/dL → mg/L (fator 10)
  pcr: [
    {
      from_unit: "mg/dL",
      to_unit: "mg/L",
      factor: 10,
      description: "PCR mg/dL → mg/L (×10)",
    },
  ],

  // Magnésio: mmol/L → mg/dL (fator 2.4305)
  magnesio: [
    {
      from_unit: "mmol/L",
      to_unit: "mg/dL",
      factor: 2.4305,
      description: "Magnésio mmol/L → mg/dL (×2.4305)",
    },
    {
      from_unit: "mEq/L",
      to_unit: "mg/dL",
      factor: 1.2153,
      description: "Magnésio mEq/L → mg/dL (×1.2153)",
    },
  ],

  // Vitamina D: nmol/L → ng/mL (fator 0.4006)
  vitamina_d: [
    {
      from_unit: "nmol/L",
      to_unit: "ng/mL",
      factor: 0.4006,
      description: "Vitamina D nmol/L → ng/mL (÷2.496)",
    },
  ],

  // Urina albumina: g/L → mg/L (fator 1000)
  urina_albumina: [
    {
      from_unit: "g/L",
      to_unit: "mg/L",
      factor: 1000,
      description: "Albumina urinária g/L → mg/L (×1000)",
    },
  ],
};

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

function findRule(markerId: string, fromUnit: string): ConversionRule | null {
  const rules = CONVERSION_TABLE[markerId];
  if (!rules) return null;
  const fromNorm = normalizeUnit(fromUnit);
  return rules.find((r) => normalizeUnit(r.from_unit) === fromNorm) ?? null;
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
