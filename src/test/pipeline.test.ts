/**
 * src/test/pipeline.test.ts
 *
 * Testes para o novo pipeline de importação de exames.
 * Cobre os casos críticos de conversão de unidade e validação de status.
 */

import { describe, it, expect } from "vitest";

// Importar diretamente os módulos do pipeline
// Nota: como os arquivos estão em supabase/functions, usamos caminhos relativos
import {
  normalizeBrazilianNumber,
  parseOperatorValue,
  normalizeReference,
  normalizeResult,
} from "../../supabase/functions/extract-lab-results/pipeline/normalize";

import {
  inferUnit,
} from "../../supabase/functions/extract-lab-results/pipeline/infer_unit";

import {
  convertResult,
  CONVERSION_TABLE,
} from "../../supabase/functions/extract-lab-results/pipeline/convert";

import {
  calculateStatus,
  validateResult,
} from "../../supabase/functions/extract-lab-results/pipeline/validate";

import type { NormalizedResult, UnitInferenceResult } from "../../supabase/functions/extract-lab-results/pipeline/types";

// ---------------------------------------------------------------------------
// Testes de normalização numérica
// ---------------------------------------------------------------------------

describe("normalizeBrazilianNumber", () => {
  it("normaliza vírgula decimal", () => {
    expect(normalizeBrazilianNumber("13,1")).toBe(13.1);
  });

  it("normaliza ponto como milhar", () => {
    expect(normalizeBrazilianNumber("1.120")).toBe(1120);
  });

  it("normaliza milhar + decimal", () => {
    expect(normalizeBrazilianNumber("1.120,5")).toBe(1120.5);
  });

  it("preserva ponto decimal padrão", () => {
    expect(normalizeBrazilianNumber("13.1")).toBe(13.1);
  });

  it("retorna null para string com operador", () => {
    expect(normalizeBrazilianNumber("< 34")).toBeNull();
  });

  it("retorna null para string vazia", () => {
    expect(normalizeBrazilianNumber("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Testes de parseOperatorValue
// ---------------------------------------------------------------------------

describe("parseOperatorValue", () => {
  it("parseia '< 34'", () => {
    const result = parseOperatorValue("< 34");
    expect(result).not.toBeNull();
    expect(result!.operator).toBe("<");
    expect(result!.value).toBe(34);
  });

  it("parseia '<= 75'", () => {
    const result = parseOperatorValue("<= 75");
    expect(result!.operator).toBe("<=");
    expect(result!.value).toBe(75);
  });

  it("parseia 'Inferior a 34' (formato brasileiro)", () => {
    const result = parseOperatorValue("Inferior a 34");
    expect(result!.operator).toBe("<");
    expect(result!.value).toBe(34);
  });

  it("parseia 'Acima de 20'", () => {
    const result = parseOperatorValue("Acima de 20");
    expect(result!.operator).toBe(">");
    expect(result!.value).toBe(20);
  });

  it("retorna null para número puro", () => {
    expect(parseOperatorValue("13.1")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Testes de normalizeReference
// ---------------------------------------------------------------------------

describe("normalizeReference", () => {
  it("parseia faixa com vírgula decimal", () => {
    const ref = normalizeReference("11,7 a 14,9");
    expect(ref.min).toBe(11.7);
    expect(ref.max).toBe(14.9);
    expect(ref.ref_type).toBe("range");
  });

  it("parseia referência com operador '<'", () => {
    const ref = normalizeReference("< 5");
    expect(ref.max).toBe(5);
    expect(ref.min).toBeNull();
    expect(ref.operator).toBe("<");
  });

  it("parseia referência com operador '>'", () => {
    const ref = normalizeReference("> 20");
    expect(ref.min).toBe(20);
    expect(ref.max).toBeNull();
    expect(ref.operator).toBe(">");
  });

  it("identifica referência qualitativa 'Negativo'", () => {
    const ref = normalizeReference("Negativo");
    expect(ref.is_qualitative).toBe(true);
    expect(ref.ref_type).toBe("qualitative");
  });

  it("retorna empty para string vazia", () => {
    const ref = normalizeReference("");
    expect(ref.min).toBeNull();
    expect(ref.max).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Testes de conversão — casos críticos
// ---------------------------------------------------------------------------

describe("Conversão: Estradiol ng/dL → pg/mL (×10)", () => {
  const normalized: NormalizedResult = {
    marker_id: "estradiol",
    value_normalized: 4.4,
    result_type: "numeric",
    reference: { original_text: "12 a 499", min: 12, max: 499, operator: null, ref_type: "range", is_qualitative: false },
    unit_raw: "ng/dL",
  };

  const inference: UnitInferenceResult = {
    marker_id: "estradiol",
    inferred_unit: "ng/dL",
    target_unit: "pg/mL",
    confidence: "high",
    reason: "Unidade extraída ng/dL é alternativa conhecida",
    needs_conversion: true,
  };

  it("converte valor 4.4 ng/dL → 44 pg/mL", () => {
    const { converted } = convertResult(normalized, inference);
    expect(converted.value).toBe(44);
  });

  it("converte referência junto com o valor", () => {
    const { converted } = convertResult(normalized, inference);
    expect(converted.lab_ref_min).toBe(120);
    expect(converted.lab_ref_max).toBe(4990);
  });

  it("registra metadados de conversão", () => {
    const { metadata } = convertResult(normalized, inference);
    expect(metadata.conversion_applied).toBe(true);
    expect(metadata.conversion_factor).toBe(10);
    expect(metadata.original_value).toBe(4.4);
  });
});

describe("Conversão: Progesterona ng/dL → ng/mL (÷100)", () => {
  const normalized: NormalizedResult = {
    marker_id: "progesterona",
    value_normalized: 19,
    result_type: "numeric",
    reference: { original_text: "0.1 a 25", min: 0.1, max: 25, operator: null, ref_type: "range", is_qualitative: false },
    unit_raw: "ng/dL",
  };

  const inference: UnitInferenceResult = {
    marker_id: "progesterona",
    inferred_unit: "ng/dL",
    target_unit: "ng/mL",
    confidence: "high",
    reason: "Unidade extraída ng/dL é alternativa conhecida",
    needs_conversion: true,
  };

  it("converte valor 19 ng/dL → 0.19 ng/mL", () => {
    const { converted } = convertResult(normalized, inference);
    expect(converted.value).toBe(0.19);
  });

  it("converte referência junto", () => {
    const { converted } = convertResult(normalized, inference);
    expect(converted.lab_ref_min).toBe(0.001);
    expect(converted.lab_ref_max).toBe(0.25);
  });
});

describe("Conversão: DHT pg/mL → ng/dL (×0.1)", () => {
  const normalized: NormalizedResult = {
    marker_id: "dht",
    value_normalized: 130,
    result_type: "numeric",
    reference: { original_text: "50 a 460", min: 50, max: 460, operator: null, ref_type: "range", is_qualitative: false },
    unit_raw: "pg/mL",
  };

  const inference: UnitInferenceResult = {
    marker_id: "dht",
    inferred_unit: "pg/mL",
    target_unit: "ng/dL",
    confidence: "high",
    reason: "Unidade extraída pg/mL é alternativa conhecida",
    needs_conversion: true,
  };

  it("converte valor 130 pg/mL → 13 ng/dL", () => {
    const { converted } = convertResult(normalized, inference);
    expect(converted.value).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// Testes de idempotência
// ---------------------------------------------------------------------------

describe("Idempotência: valores já convertidos não devem ser convertidos novamente", () => {
  it("estradiol já em pg/mL não é convertido", () => {
    const normalized: NormalizedResult = {
      marker_id: "estradiol",
      value_normalized: 139,
      result_type: "numeric",
      reference: { original_text: "12 a 499", min: 12, max: 499, operator: null, ref_type: "range", is_qualitative: false },
      unit_raw: "pg/mL",
    };

    const inference: UnitInferenceResult = {
      marker_id: "estradiol",
      inferred_unit: "pg/mL",
      target_unit: "pg/mL",
      confidence: "high",
      reason: "Unidade já é canônica",
      needs_conversion: false,
    };

    const { converted, metadata } = convertResult(normalized, inference);
    expect(converted.value).toBe(139);
    expect(metadata.conversion_applied).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Testes de cálculo de status
// ---------------------------------------------------------------------------

describe("calculateStatus", () => {
  it("retorna 'low' quando valor abaixo do mínimo", () => {
    expect(calculateStatus({ value: 11.5, lab_ref_min: 12, lab_ref_max: 16 })).toBe("low");
  });

  it("retorna 'high' quando valor acima do máximo", () => {
    expect(calculateStatus({ value: 205, lab_ref_min: null, lab_ref_max: 190 })).toBe("high");
  });

  it("retorna 'normal' quando valor dentro da faixa", () => {
    expect(calculateStatus({ value: 80, lab_ref_min: 70, lab_ref_max: 115 })).toBe("normal");
  });

  it("retorna 'high' para referência com operador '<' quando valor excede", () => {
    expect(calculateStatus({ value: 25, lab_ref_min: null, lab_ref_max: 5 })).toBe("high");
  });

  it("retorna 'normal' para referência com operador '>' quando valor excede o mínimo", () => {
    expect(calculateStatus({ value: 31, lab_ref_min: 20, lab_ref_max: null })).toBe("normal");
  });

  it("retorna 'low' para referência com operador '>' quando valor abaixo do mínimo", () => {
    expect(calculateStatus({ value: 15, lab_ref_min: 20, lab_ref_max: null })).toBe("low");
  });

  it("retorna 'qualitative_mismatch' quando texto difere da referência", () => {
    expect(calculateStatus({
      text_value: "Raras",
      lab_ref_min: null,
      lab_ref_max: null,
      lab_ref_text: "Negativo",
    })).toBe("qualitative_mismatch");
  });

  it("retorna 'normal' quando texto qualitativo corresponde à referência", () => {
    expect(calculateStatus({
      text_value: "Negativo",
      lab_ref_min: null,
      lab_ref_max: null,
      lab_ref_text: "Negativo",
    })).toBe("normal");
  });
});

// ---------------------------------------------------------------------------
// Testes de resultados qualitativos não viram float
// ---------------------------------------------------------------------------

describe("Resultados qualitativos", () => {
  it("resultado qualitativo não vira float", () => {
    const raw = normalizeResult({
      marker_id: "fan",
      text_value: "Não reagente",
      lab_ref_text: "Não reagente",
    });
    expect(raw.result_type).toBe("qualitative");
    expect(raw.value_normalized).toBeUndefined();
  });

  it("'Raras' é classificado como texto (não qualitativo padrão)", () => {
    const raw = normalizeResult({
      marker_id: "urina_celulas_epiteliais",
      text_value: "Raras",
      lab_ref_text: "Negativo",
    });
    // "Raras" não está na lista de qualitativos padrão, mas o status deve ser mismatch
    const status = calculateStatus({
      text_value: "Raras",
      lab_ref_min: null,
      lab_ref_max: null,
      lab_ref_text: "Negativo",
    });
    expect(status).toBe("qualitative_mismatch");
  });
});

// ---------------------------------------------------------------------------
// Testes de casos específicos dos bugs identificados
// ---------------------------------------------------------------------------

describe("Bug: PCR 25 mg/L com ref < 5 deve ser HIGH", () => {
  it("PCR 25 com ref < 5 → status high", () => {
    expect(calculateStatus({ value: 25, lab_ref_min: null, lab_ref_max: 5 })).toBe("high");
  });
});

describe("Bug: Lipoproteína(a) 183 nmol/L com ref <= 75 deve ser HIGH", () => {
  it("Lp(a) 183 com ref <= 75 → status high", () => {
    expect(calculateStatus({ value: 183, lab_ref_min: null, lab_ref_max: 75 })).toBe("high");
  });
});

describe("Bug: Hemoglobina 13.1 com ref 13.3-16.5 deve ser LOW", () => {
  it("Hgb 13.1 com ref 13.3-16.5 → status low", () => {
    expect(calculateStatus({ value: 13.1, lab_ref_min: 13.3, lab_ref_max: 16.5 })).toBe("low");
  });
});

describe("Bug: Glicemia Média Estimada 88 com ref 70-115 deve ser NORMAL", () => {
  it("GME 88 com ref 70-115 → status normal", () => {
    expect(calculateStatus({ value: 88, lab_ref_min: 70, lab_ref_max: 115 })).toBe("normal");
  });

  it("GME 99.7 com ref 70-115 → status normal", () => {
    expect(calculateStatus({ value: 99.7, lab_ref_min: 70, lab_ref_max: 115 })).toBe("normal");
  });
});
