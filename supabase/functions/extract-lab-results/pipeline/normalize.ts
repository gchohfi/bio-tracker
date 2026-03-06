/**
 * pipeline/normalize.ts
 *
 * Camada de normalização: recebe dados brutos da IA e produz estruturas
 * tipadas e normalizadas, sem aplicar nenhuma conversão de unidade.
 *
 * Responsabilidades:
 * - Normalizar números com vírgula e ponto (formato brasileiro)
 * - Separar operador (<, >, <=, >=) do valor numérico
 * - Separar valor e unidade
 * - Identificar resultado qualitativo
 * - Normalizar referência em texto
 * - Classificar tipo do resultado: numeric, numeric_with_operator, qualitative, text, range
 */

import type {
  RawExamResult,
  NormalizedResult,
  NormalizedReference,
  ResultType,
  ComparisonOperator,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Funções auxiliares de normalização numérica
// ---------------------------------------------------------------------------

/**
 * Normaliza um número no formato brasileiro para float.
 * Suporta:
 *   - "13,1"    → 13.1
 *   - "1.120"   → 1120   (separador de milhar)
 *   - "1.120,5" → 1120.5 (milhar + decimal)
 *   - "13.1"    → 13.1   (já no formato correto)
 *   - "< 34"    → null   (tem operador — usar parseOperatorValue)
 */
export function normalizeBrazilianNumber(raw: string): number | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();

  // Rejeitar strings com operadores — devem usar parseOperatorValue
  if (/^[<>≤≥]=?\s/.test(trimmed)) return null;

  // Formato "1.120,5" — ponto como milhar, vírgula como decimal
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed.replace(/\./g, "").replace(",", "."));
  }

  // Formato "1.120" — ponto como separador de milhar (sem decimal)
  if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    return parseFloat(trimmed.replace(/\./g, ""));
  }

  // Formato "13,1" — vírgula como decimal
  if (/^\d+,\d+$/.test(trimmed)) {
    return parseFloat(trimmed.replace(",", "."));
  }

  // Formato padrão "13.1" ou "13"
  const parsed = parseFloat(trimmed);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Extrai operador e valor numérico de strings como "< 34", ">= 5", "<= 1.2".
 * Retorna null se não houver operador.
 */
export function parseOperatorValue(
  raw: string
): { operator: ComparisonOperator; value: number } | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();

  // Normalizar variações textuais brasileiras
  const normalized = trimmed
    .replace(/^inferior\s+a\s+/i, "< ")
    .replace(/^superior\s+a\s+/i, "> ")
    .replace(/^menor\s+(?:ou\s+igual\s+)?(?:a|que)\s+/i, "<= ")
    .replace(/^maior\s+(?:ou\s+igual\s+)?(?:a|que)\s+/i, ">= ")
    .replace(/^até\s+/i, "<= ")
    .replace(/^acima\s+de\s+/i, "> ")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=");

  const match = normalized.match(/^([<>]=?)\s*([\d.,]+)/);
  if (!match) return null;

  const operator = match[1] as ComparisonOperator;
  const value = normalizeBrazilianNumber(match[2]);
  if (value === null) return null;

  return { operator, value };
}

// ---------------------------------------------------------------------------
// Classificação do tipo de resultado
// ---------------------------------------------------------------------------

/** Lista de termos qualitativos conhecidos (lowercase) */
const QUALITATIVE_TERMS = new Set([
  "reagente",
  "não reagente",
  "nao reagente",
  "positivo",
  "negativo",
  "ausente",
  "presente",
  "normal",
  "alterado",
  "límpido",
  "limpido",
  "turvo",
  "amarelo",
  "amarelo claro",
  "amarelo escuro",
  "incolor",
  "pastosa",
  "sólida",
  "solida",
  "líquida",
  "liquida",
  "raras",
  "escassos",
  "escasso",
  "não reagente",
  "não reativo",
  "nao reativo",
  "reagente fraco",
  "indeterminado",
]);

/**
 * Classifica o tipo de um resultado.
 * Prioridade: numeric_with_operator > numeric > qualitative > text
 */
export function classifyResultType(
  value: number | undefined,
  textValue: string | undefined
): ResultType {
  // Tem operador explícito?
  if (textValue && parseOperatorValue(textValue) !== null) {
    return "numeric_with_operator";
  }

  // Tem valor numérico?
  if (typeof value === "number" && !isNaN(value)) {
    return "numeric";
  }

  // Texto qualitativo conhecido?
  if (textValue) {
    const lower = textValue.trim().toLowerCase();
    if (QUALITATIVE_TERMS.has(lower)) {
      return "qualitative";
    }
    // Parece um número com operador que ainda não foi parseado?
    if (/^[<>≤≥]=?\s*[\d.,]/.test(textValue.trim())) {
      return "numeric_with_operator";
    }
  }

  return "text";
}

// ---------------------------------------------------------------------------
// Normalização de referência
// ---------------------------------------------------------------------------

/**
 * Normaliza o texto de referência do laboratório em uma estrutura tipada.
 * Suporta formatos:
 *   - "11,7 a 14,9"     → range [11.7, 14.9]
 *   - "11.7 - 14.9"     → range [11.7, 14.9]
 *   - "< 34"            → operator "<", max 34
 *   - "> 20"            → operator ">", min 20
 *   - "<= 75"           → operator "<=", max 75
 *   - "Negativo"        → qualitative
 *   - ""                → empty/unknown
 */
export function normalizeReference(refText: string | undefined): NormalizedReference {
  if (!refText || refText.trim() === "") {
    return {
      original_text: "",
      min: null,
      max: null,
      operator: null,
      ref_type: "text",
      is_qualitative: false,
    };
  }

  const trimmed = refText.trim();

  // Verificar se é qualitativo
  const lower = trimmed.toLowerCase();
  if (QUALITATIVE_TERMS.has(lower) || /^(não|nao)\s+/i.test(lower)) {
    return {
      original_text: trimmed,
      min: null,
      max: null,
      operator: null,
      ref_type: "qualitative",
      is_qualitative: true,
    };
  }

  // Tentar parsear como operador + valor
  const opResult = parseOperatorValue(trimmed);
  if (opResult !== null) {
    return {
      original_text: trimmed,
      min: opResult.operator === ">" || opResult.operator === ">=" ? opResult.value : null,
      max: opResult.operator === "<" || opResult.operator === "<=" ? opResult.value : null,
      operator: opResult.operator,
      ref_type: "numeric_with_operator",
      is_qualitative: false,
    };
  }

  // Tentar parsear como faixa: "11,7 a 14,9" ou "11.7 - 14.9" ou "11.7–14.9"
  const rangeMatch = trimmed.match(
    /^([\d.,]+)\s*(?:a|até|-|–|—)\s*([\d.,]+)$/i
  );
  if (rangeMatch) {
    const min = normalizeBrazilianNumber(rangeMatch[1]);
    const max = normalizeBrazilianNumber(rangeMatch[2]);
    if (min !== null && max !== null) {
      return {
        original_text: trimmed,
        min,
        max,
        operator: null,
        ref_type: "range",
        is_qualitative: false,
      };
    }
  }

  // Tentar parsear como número simples (ex: referência de densidade "1.020")
  const single = normalizeBrazilianNumber(trimmed);
  if (single !== null) {
    return {
      original_text: trimmed,
      min: single,
      max: single,
      operator: "=",
      ref_type: "numeric",
      is_qualitative: false,
    };
  }

  // Texto não reconhecido
  return {
    original_text: trimmed,
    min: null,
    max: null,
    operator: null,
    ref_type: "text",
    is_qualitative: false,
  };
}

// ---------------------------------------------------------------------------
// Função principal de normalização
// ---------------------------------------------------------------------------

/**
 * Normaliza um resultado bruto da IA em uma estrutura tipada.
 * Não aplica nenhuma conversão de unidade.
 */
export function normalizeResult(raw: RawExamResult): NormalizedResult {
  const reference = normalizeReference(raw.lab_ref_text);

  // Normalizar text_value: tratar operadores textuais brasileiros
  let textNormalized = raw.text_value?.trim();
  let valueNormalized = raw.value;
  let operator: ComparisonOperator = null;

  if (textNormalized) {
    // Tentar extrair operador + valor do text_value
    const opResult = parseOperatorValue(textNormalized);
    if (opResult !== null) {
      operator = opResult.operator;
      // Se não há value numérico, usar o valor do operador
      if (valueNormalized === undefined || isNaN(valueNormalized)) {
        valueNormalized = opResult.value;
      }
    }
  }

  const resultType = classifyResultType(valueNormalized, textNormalized);

  return {
    marker_id: raw.marker_id,
    value_normalized: typeof valueNormalized === "number" && !isNaN(valueNormalized)
      ? valueNormalized
      : undefined,
    text_normalized: textNormalized,
    operator,
    result_type: resultType,
    reference,
    unit_raw: raw.unit_raw,
  };
}

/**
 * Normaliza um array de resultados brutos.
 * Filtra resultados sem marker_id válido.
 */
export function normalizeResults(rawResults: RawExamResult[]): NormalizedResult[] {
  return rawResults
    .filter((r) => r.marker_id && typeof r.marker_id === "string")
    .map(normalizeResult);
}
