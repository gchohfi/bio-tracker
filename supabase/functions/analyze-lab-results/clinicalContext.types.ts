/**
 * clinicalContext.types.ts
 *
 * Tipos canônicos para a camada de contexto clínico do sistema de análise IA.
 * Estes tipos servem como contrato entre:
 *   - Frontend (PatientDetail.tsx) → monta e envia
 *   - Edge Function (analyze-lab-results) → consome e injeta no prompt
 *
 * IMPORTANTE: Este arquivo define a ESTRUTURA ALVO. A migração é incremental:
 *   Fase 1 (done): tipos definidos
 *   Fase 2 (done): buildUserPrompt() consome ClinicalContext.labs
 *   Fase 3: frontend envia CanonicalLabResult[] no body
 */

// ══════════════════════════════════════════════════════════════════════════════
// CANONICAL LAB RESULT — resultado laboratorial normalizado
// ══════════════════════════════════════════════════════════════════════════════

export type LabStatus =
  | "normal"
  | "low"
  | "high"
  | "critical_low"
  | "critical_high"
  | "qualitative";

/** Razão pela qual um marcador normal é considerado clinicamente relevante */
export type RelevanceReason =
  | "near_lower_limit"   // valor a <15% do limite inferior
  | "near_upper_limit"   // valor a <15% do limite superior
  | "key_marker"         // marcador clinicamente importante independente do valor
  | "trend_change";      // tendência de piora entre sessões

/** Lista de marker_ids considerados clinicamente importantes mesmo quando normais */
export const KEY_MARKERS: readonly string[] = [
  "glicose_jejum",
  "insulina_jejum",
  "homa_ir",
  "hba1c",
  "tsh",
  "t4_livre",
  "t3_livre",
  "ferritina",
  "vitamina_d",
  "vitamina_b12",
  "homocisteina",
  "pcr",
  "cortisol",
  "testosterona_total",
  "hdl",
  "ldl",
  "triglicerides",
] as const;

export interface CanonicalLabResult {
  marker_id: string;
  marker_name: string;
  value: number | null;
  text_value?: string;
  unit: string;
  status: LabStatus;
  session_date: string;

  // Referências laboratoriais (do laudo)
  lab_ref_min?: number;
  lab_ref_max?: number;
  lab_ref_text?: string;

  // Referências funcionais (nutrologia)
  functional_min?: number;
  functional_max?: number;

  // Contexto de relevância (preenchido apenas para clinicallyRelevantNormals)
  relevance_reason?: RelevanceReason;

  // Metadados de origem
  is_derived?: boolean;         // HOMA-IR, relação T3/T4, etc.
  derived_from?: string[];      // marker_ids usados no cálculo
  source?: "current" | "historical";
}

// ══════════════════════════════════════════════════════════════════════════════
// LAB TREND — tendência entre sessões para um marcador
// ══════════════════════════════════════════════════════════════════════════════

export interface LabTrend {
  marker_id: string;
  marker_name: string;
  entries: Array<{ date: string; value: number }>;
  first_value: number;
  last_value: number;
  delta_percent: number;       // positivo = subiu, negativo = desceu
  direction: "up" | "down" | "stable";
  is_improving: boolean | null; // null = sem contexto para determinar
}

// ══════════════════════════════════════════════════════════════════════════════
// BODY COMPOSITION — dados de composição corporal (InBody, bioimpedância)
// ══════════════════════════════════════════════════════════════════════════════

export interface BodyCompositionSnapshot {
  session_date: string;
  weight_kg: number | null;
  bmi: number | null;
  skeletal_muscle_kg: number | null;
  body_fat_kg: number | null;
  body_fat_pct: number | null;
  visceral_fat_level: number | null;
  total_body_water_l: number | null;
  ecw_tbw_ratio: number | null;
  bmr_kcal: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  waist_hip_ratio: number | null;
}

export interface BodyCompositionContext {
  /** Most recent session */
  current: BodyCompositionSnapshot | null;
  /** Previous session (for trend comparison) */
  previous: BodyCompositionSnapshot | null;
  /** Number of total sessions available */
  totalSessions: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// IMAGING REPORTS — laudos textuais de exames de imagem
// ══════════════════════════════════════════════════════════════════════════════

export interface ImagingReportSnapshot {
  id: string;
  report_date: string;
  exam_type: string;
  exam_region: string | null;
  findings: string | null;
  conclusion: string | null;
  recommendations: string | null;
  incidental_findings: string | null;
  classifications: string | null;
  source_lab: string | null;
  source_type: string;
  specialty_id: string | null;
}

export interface ImagingReportsContext {
  /** Most recent report */
  current: ImagingReportSnapshot | null;
  /** Previous reports (ordered by date desc), max 5 */
  history: ImagingReportSnapshot[];
  /** Total number of imaging reports for this patient */
  totalReports: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// STRUCTURED ANAMNESE — campos estruturados da anamnese híbrida
// ══════════════════════════════════════════════════════════════════════════════

export interface StructuredAnamnese {
  queixa_principal?: string;
  objetivos?: string[];
  sintomas?: string[];
  // Hábitos
  sono_horas?: number | null;
  qualidade_sono?: "boa" | "regular" | "ruim" | "";
  nivel_estresse?: "baixo" | "moderado" | "alto" | "";
  atividade_fisica?: string;
  tabagismo?: boolean;
  etilismo?: string;
  dieta_resumo?: string;
  // Antecedentes
  comorbidades?: string[];
  cirurgias?: string[];
  historico_familiar?: string;
  // Medicações
  medicacoes?: string[];
  suplementos?: string[];
  // Restrições
  alergias?: string[];
  restricoes_alimentares?: string;
  // Livre
  observacoes?: string;
}

/** Indica a fonte dos dados de anamnese usados no prompt */
export type AnamneseSource = "structured" | "legacy_text" | "none";

// ══════════════════════════════════════════════════════════════════════════════
// CLINICAL CONTEXT — estrutura completa para o prompt de análise
// ══════════════════════════════════════════════════════════════════════════════

export interface PatientProfile {
  objectives?: string[];
  activity_level?: string | null;
  sport_modality?: string | null;
  main_complaints?: string | null;
  restrictions?: string | null;
}

export interface ClinicalContext {
  patientProfile?: PatientProfile | null;
  /** Texto legado da anamnese (fallback) */
  anamnese?: string | null;
  /** Dados estruturados da anamnese (prioritário quando disponível) */
  structuredAnamnese?: StructuredAnamnese | null;
  /** Fonte dos dados de anamnese usados */
  anamneseSource?: AnamneseSource;
  doctorNotes?: string | null;
  labs: ClinicalContextLabs;
  bodyComposition?: BodyCompositionContext | null;
  imagingReports?: ImagingReportsContext | null;
  clinicalHistory?: ClinicalHistoryContext | null;
}

/** Flags retornados no response para indicar o que foi carregado */
export interface ContextLoaded {
  anamnesis: boolean;
  doctorNotes: boolean;
  patientProfile: boolean;
  bodyComposition: boolean;
  imagingReports: boolean;
  clinicalHistory: boolean;
  labs: {
    total: number;
    outOfRange: number;
    clinicallyRelevantNormals: number;
    derivedMarkers: number;
    trendsCount: number;
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPER: threshold para "próximo do limite"
// ══════════════════════════════════════════════════════════════════════════════

/** Percentual do range para considerar "perto do limite" */
export const NEAR_LIMIT_THRESHOLD = 0.15; // 15%

/**
 * Determina se um valor normal está clinicamente próximo do limite.
 * Retorna a razão de relevância ou null se não for relevante.
 */
export function checkNearLimit(
  value: number,
  refMin: number | undefined,
  refMax: number | undefined,
): RelevanceReason | null {
  if (refMin === undefined || refMax === undefined) return null;
  if (refMin >= refMax) return null;

  const range = refMax - refMin;
  const lowerThreshold = refMin + range * NEAR_LIMIT_THRESHOLD;
  const upperThreshold = refMax - range * NEAR_LIMIT_THRESHOLD;

  if (value <= lowerThreshold) return "near_lower_limit";
  if (value >= upperThreshold) return "near_upper_limit";
  return null;
}

/**
 * Determina se um marcador é clinicamente importante independente do valor.
 */
export function isKeyMarker(markerId: string): boolean {
  return (KEY_MARKERS as readonly string[]).includes(markerId);
}
