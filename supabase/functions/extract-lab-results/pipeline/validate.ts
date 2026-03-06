/**
 * pipeline/validate.ts
 *
 * Camada de validação: verifica consistência dos dados após conversão.
 *
 * Responsabilidades:
 * - Validar compatibilidade entre unidade do resultado e da referência
 * - Validar coerência de ordem de grandeza
 * - Sinalizar baixa confiança
 * - Retornar warnings e error_reason
 * - NÃO converter silenciosamente — apenas sinalizar problemas
 * - Calcular status (normal/low/high) a partir da referência do laudo
 */

import type {
  PersistedExamResult,
  ValidationOutput,
  ValidationIssue,
  ValidationSeverity,
  MarkerStatus,
  UnitConfidence,
  ConversionMetadata,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Funções auxiliares
// ---------------------------------------------------------------------------

function issue(
  markerId: string,
  severity: ValidationSeverity,
  code: string,
  message: string
): ValidationIssue {
  return { marker_id: markerId, severity, code, message };
}

// ---------------------------------------------------------------------------
// Cálculo de status (normal/low/high)
// ---------------------------------------------------------------------------

/**
 * Calcula o status de um marcador em relação à sua referência.
 * Usa EXCLUSIVAMENTE os valores lab_ref_min/max/text do resultado convertido.
 *
 * Esta é a função canônica de status — deve ser usada em generateReport.ts
 * em vez de recalcular a partir de markers.ts.
 */
export function calculateStatus(result: Partial<PersistedExamResult>): MarkerStatus {
  const { value, text_value, lab_ref_min, lab_ref_max, lab_ref_text } = result;

  // Resultado qualitativo: comparar texto
  if (text_value && (lab_ref_min === null || lab_ref_min === undefined) &&
      (lab_ref_max === null || lab_ref_max === undefined) && lab_ref_text) {
    const refLower = lab_ref_text.trim().toLowerCase();
    const valLower = text_value.trim().toLowerCase();
    if (refLower && valLower) {
      return valLower === refLower ? "normal" : "qualitative_mismatch";
    }
    return "unknown";
  }

  // Resultado numérico com operador (ex: "< 34") — comparar com referência
  if (text_value && /^[<>≤≥]=?\s*[\d.,]/.test(text_value.trim())) {
    // Para valores com operador, não calcular status automaticamente
    // (ex: PSA Livre "< 0.01" com ref "< 1" — ambos são "< X", status é normal)
    if (lab_ref_max !== null && lab_ref_max !== undefined) {
      const match = text_value.match(/^[<>≤≥]=?\s*([\d.,]+)/);
      if (match) {
        const numVal = parseFloat(match[1].replace(",", "."));
        if (!isNaN(numVal)) {
          if (numVal > lab_ref_max) return "high";
          if (numVal < (lab_ref_min ?? 0)) return "low";
          return "normal";
        }
      }
    }
    return "unknown";
  }

  // Resultado numérico puro
  if (typeof value !== "number" || isNaN(value)) return "unknown";

  // Referência com apenas máximo (ex: "< 5", "<= 75")
  if ((lab_ref_min === null || lab_ref_min === undefined) &&
      lab_ref_max !== null && lab_ref_max !== undefined) {
    return value > lab_ref_max ? "high" : "normal";
  }

  // Referência com apenas mínimo (ex: "> 20", ">= 3.9")
  if (lab_ref_min !== null && lab_ref_min !== undefined &&
      (lab_ref_max === null || lab_ref_max === undefined)) {
    return value < lab_ref_min ? "low" : "normal";
  }

  // Referência com faixa completa
  if (lab_ref_min !== null && lab_ref_min !== undefined &&
      lab_ref_max !== null && lab_ref_max !== undefined) {
    if (value < lab_ref_min) return "low";
    if (value > lab_ref_max) return "high";
    return "normal";
  }

  return "unknown";
}

// ---------------------------------------------------------------------------
// Validação principal
// ---------------------------------------------------------------------------

/**
 * Valida um resultado convertido e calcula seu status final.
 * Não modifica os dados — apenas adiciona metadados de validação e status.
 */
export function validateResult(
  result: Partial<PersistedExamResult>,
  conversionMetadata?: ConversionMetadata
): { validated: PersistedExamResult; validation: ValidationOutput } {
  const markerId = result.marker_id ?? "unknown";
  const issues: ValidationIssue[] = [];

  // --- Verificação 1: Valor ausente ---
  if (result.value === undefined && !result.text_value) {
    issues.push(issue(markerId, "error", "NO_VALUE", "Resultado sem valor numérico ou textual"));
  }

  // --- Verificação 2: Referência ausente ---
  if (!result.lab_ref_text && result.lab_ref_min === null && result.lab_ref_max === null) {
    issues.push(issue(markerId, "warning", "NO_REFERENCE", "Referência do laboratório ausente — status não pode ser calculado"));
  }

  // --- Verificação 3: Baixa confiança na inferência de unidade ---
  if (conversionMetadata?.conversion_applied === false &&
      conversionMetadata?.conversion_reason?.includes("sem regra")) {
    issues.push(issue(markerId, "warning", "NO_CONVERSION_RULE",
      `Conversão necessária mas sem regra definida: ${conversionMetadata.source_unit_inferred} → ${conversionMetadata.target_unit}`));
  }

  // --- Verificação 4: Coerência de ordem de grandeza pós-conversão ---
  // Se o valor convertido é 0 ou negativo quando não deveria ser
  if (typeof result.value === "number" && result.value < 0) {
    issues.push(issue(markerId, "error", "NEGATIVE_VALUE", `Valor negativo após conversão: ${result.value}`));
  }

  // --- Verificação 5: Referência min > max (inversão) ---
  if (result.lab_ref_min !== null && result.lab_ref_min !== undefined &&
      result.lab_ref_max !== null && result.lab_ref_max !== undefined &&
      result.lab_ref_min > result.lab_ref_max) {
    issues.push(issue(markerId, "error", "REF_INVERTED",
      `Referência invertida: min=${result.lab_ref_min} > max=${result.lab_ref_max}`));
  }

  // --- Calcular status ---
  const status = calculateStatus(result);

  // Determinar confiança geral
  const hasErrors = issues.some((i) => i.severity === "error");
  const hasWarnings = issues.some((i) => i.severity === "warning");
  const confidence: UnitConfidence = hasErrors ? "low" : hasWarnings ? "medium" : "high";

  const validation: ValidationOutput = {
    marker_id: markerId,
    is_valid: !hasErrors,
    confidence,
    issues,
    error_reason: hasErrors ? issues.filter((i) => i.severity === "error").map((i) => i.message).join("; ") : undefined,
  };

  const validated: PersistedExamResult = {
    marker_id: markerId,
    value: result.value,
    text_value: result.text_value,
    unit: result.unit ?? "unknown",
    lab_ref_min: result.lab_ref_min ?? null,
    lab_ref_max: result.lab_ref_max ?? null,
    lab_ref_text: result.lab_ref_text,
    status,
    conversion: conversionMetadata,
    validation,
  };

  return { validated, validation };
}

/**
 * Valida um array de resultados convertidos.
 */
export function validateResults(
  results: Array<{ converted: Partial<PersistedExamResult>; metadata: ConversionMetadata }>
): PersistedExamResult[] {
  return results.map(({ converted, metadata }) => {
    const { validated } = validateResult(converted, metadata);
    return validated;
  });
}
