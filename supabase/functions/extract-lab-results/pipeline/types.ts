/**
 * pipeline/types.ts
 *
 * Tipos e interfaces base para o pipeline de importação de exames laboratoriais.
 * Pipeline: extract → normalize → infer_unit → convert → validate → persist
 */

// ---------------------------------------------------------------------------
// 1. Extração bruta (saída da IA — dados não processados)
// ---------------------------------------------------------------------------

/** Resultado bruto retornado pela IA antes de qualquer processamento. */
export interface RawExamResult {
  /** ID canônico do marcador (ex: "hemoglobina", "estradiol") */
  marker_id: string;
  /** Valor numérico extraído, se disponível */
  value?: number;
  /** Valor textual extraído (qualitativos, operadores, ex: "< 34", "Não reagente") */
  text_value?: string;
  /** Referência do laboratório como impressa no laudo (ex: "11,7 a 14,9", "Inferior a 34") */
  lab_ref_text?: string;
  /** Unidade extraída pela IA (pode estar em formato variado, ex: "pg/mL", "ng/dL") */
  unit_raw?: string;
}

// ---------------------------------------------------------------------------
// 2. Resultado normalizado (após normalização de formato)
// ---------------------------------------------------------------------------

/** Tipo do resultado após classificação */
export type ResultType =
  | "numeric"                // valor numérico puro (ex: 13.1)
  | "numeric_with_operator"  // valor com operador (ex: < 34, >= 5)
  | "qualitative"            // resultado qualitativo (ex: "Reagente", "Não reagente")
  | "text"                   // texto livre (ex: "Amarelo claro")
  | "range";                 // faixa (ex: "10 a 20") — raro no resultado, comum na referência

/** Operador de comparação extraído */
export type ComparisonOperator = "<" | "<=" | ">" | ">=" | "=" | null;

/** Resultado após normalização de formato */
export interface NormalizedResult {
  marker_id: string;
  /** Valor numérico normalizado (vírgula → ponto, separador de milhar removido) */
  value_normalized?: number;
  /** Texto normalizado (sem espaços extras, lowercase para qualitativos) */
  text_normalized?: string;
  /** Operador extraído do text_value (ex: "<" para "< 34") */
  operator?: ComparisonOperator;
  /** Tipo classificado do resultado */
  result_type: ResultType;
  /** Referência normalizada do laboratório */
  reference: NormalizedReference;
  /** Unidade bruta preservada para inferência posterior */
  unit_raw?: string;
}

/** Referência de laboratório normalizada */
export interface NormalizedReference {
  /** Texto original da referência do laudo */
  original_text: string;
  /** Mínimo numérico (null se não aplicável, ex: referência "< 5") */
  min?: number | null;
  /** Máximo numérico (null se não aplicável, ex: referência "> 20") */
  max?: number | null;
  /** Operador da referência (ex: "<" para "< 5") */
  operator?: ComparisonOperator;
  /** Tipo da referência */
  ref_type: ResultType;
  /** Referência é qualitativa (ex: "Negativo", "Não reagente") */
  is_qualitative: boolean;
}

// ---------------------------------------------------------------------------
// 3. Resultado de inferência de unidade
// ---------------------------------------------------------------------------

/** Nível de confiança da inferência de unidade */
export type UnitConfidence = "high" | "medium" | "low";

/** Resultado da inferência de unidade para um marcador */
export interface UnitInferenceResult {
  marker_id: string;
  /** Unidade inferida (unidade canônica do sistema, ex: "pg/mL", "ng/dL") */
  inferred_unit: string;
  /** Unidade alvo esperada pelo sistema para este marcador */
  target_unit: string;
  /** Nível de confiança da inferência */
  confidence: UnitConfidence;
  /** Razão da inferência (para auditoria e debug) */
  reason: string;
  /** Conversão necessária? */
  needs_conversion: boolean;
}

// ---------------------------------------------------------------------------
// 4. Metadados de conversão
// ---------------------------------------------------------------------------

/** Metadados registrados para cada conversão aplicada */
export interface ConversionMetadata {
  marker_id: string;
  /** Conversão foi aplicada? */
  conversion_applied: boolean;
  /** Razão da conversão (ou razão para não converter) */
  conversion_reason: string;
  /** Unidade inferida antes da conversão */
  source_unit_inferred: string;
  /** Unidade alvo após conversão */
  target_unit: string;
  /** Fator de conversão aplicado (null se não aplicável) */
  conversion_factor?: number | null;
  /** Valor original antes da conversão */
  original_value?: number;
  /** Referência mínima original antes da conversão */
  original_ref_min?: number | null;
  /** Referência máxima original antes da conversão */
  original_ref_max?: number | null;
}

// ---------------------------------------------------------------------------
// 5. Saída de validação
// ---------------------------------------------------------------------------

/** Severidade de um problema de validação */
export type ValidationSeverity = "error" | "warning" | "info";

/** Um único problema de validação */
export interface ValidationIssue {
  marker_id: string;
  severity: ValidationSeverity;
  /** Código do problema (para programmatic handling) */
  code: string;
  /** Mensagem legível */
  message: string;
}

/** Resultado da validação de um marcador */
export interface ValidationOutput {
  marker_id: string;
  /** Validação passou sem erros? */
  is_valid: boolean;
  /** Confiança geral no resultado (após conversão e validação) */
  confidence: UnitConfidence;
  /** Lista de problemas encontrados */
  issues: ValidationIssue[];
  /** Razão de erro fatal (se is_valid = false) */
  error_reason?: string;
}

// ---------------------------------------------------------------------------
// 6. Resultado final para persistência
// ---------------------------------------------------------------------------

/** Status do marcador em relação à referência */
export type MarkerStatus = "normal" | "low" | "high" | "qualitative_mismatch" | "unknown";

/** Resultado final pronto para persistência no banco de dados */
export interface PersistedExamResult {
  marker_id: string;
  /** Valor numérico final (após normalização e conversão) */
  value?: number;
  /** Valor textual final (para qualitativos) */
  text_value?: string;
  /** Unidade canônica final */
  unit: string;
  /** Referência mínima final (já na unidade canônica) */
  lab_ref_min?: number | null;
  /** Referência máxima final (já na unidade canônica) */
  lab_ref_max?: number | null;
  /** Texto da referência para exibição */
  lab_ref_text?: string;
  /** Status calculado em relação à referência */
  status: MarkerStatus;
  /** Metadados de conversão (para auditoria) */
  conversion?: ConversionMetadata;
  /** Resultado da validação (para auditoria) */
  validation?: ValidationOutput;
}

// ---------------------------------------------------------------------------
// 7. Contexto do pipeline (passado entre etapas)
// ---------------------------------------------------------------------------

/** Contexto compartilhado entre todas as etapas do pipeline */
export interface PipelineContext {
  /** Sexo do paciente (para referências dependentes de sexo) */
  patient_sex?: "M" | "F";
  /** Texto bruto do PDF (para fallback regex) */
  pdf_text?: string;
  /** Modo debug (log detalhado) */
  debug?: boolean;
}
