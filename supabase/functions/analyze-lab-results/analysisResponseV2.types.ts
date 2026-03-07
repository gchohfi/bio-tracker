/**
 * analysisResponseV2.types.ts
 *
 * Contrato canônico para o relatório clínico IA v2.
 *
 * Princípios:
 *   1. Payload da IA = dados puros. Estado de revisão vive no frontend.
 *   2. Cada item tem proveniência (deterministic | llm | hybrid).
 *   3. Cross-specialty alerts sinalizam achados relevantes fora da especialidade ativa.
 *   4. Prescrição/protocolos = fase posterior (compat layer).
 */

// ══════════════════════════════════════════════════════════════════════════════
// ENUMS & PRIMITIVOS
// ══════════════════════════════════════════════════════════════════════════════

export type ClinicalPriority = "critical" | "high" | "medium" | "low";
export type ConfidenceLevel = "high" | "moderate" | "low";
export type SuggestedActionType = "investigate" | "treat" | "monitor" | "refer";
export type SourceType = "deterministic" | "llm" | "hybrid";
export type RedFlagSeverity = "critical" | "high" | "moderate";

// ══════════════════════════════════════════════════════════════════════════════
// ITEM BASE
// ══════════════════════════════════════════════════════════════════════════════

export interface ClinicalItemBase {
  id: string;
  source_type: SourceType;
  specialty_relevant: boolean;
  cross_specialty_alert: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCO 1 — RED FLAGS
// ══════════════════════════════════════════════════════════════════════════════

export interface RedFlagItem extends ClinicalItemBase {
  finding: string;
  severity: RedFlagSeverity;
  suggested_action: string;
  evidence: string[];
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCO 2 — ACHADOS CLÍNICOS
// ══════════════════════════════════════════════════════════════════════════════

export interface ClinicalFindingItem extends ClinicalItemBase {
  system: string;
  markers: string[];
  interpretation: string;
  priority: ClinicalPriority;
  confidence: ConfidenceLevel;
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCO 3 — HIPÓTESES DIAGNÓSTICAS
// ══════════════════════════════════════════════════════════════════════════════

export interface DiagnosticHypothesisItem extends ClinicalItemBase {
  hypothesis: string;
  supporting_findings: string[];
  contradicting_findings?: string[];
  confirmatory_exams?: string[];
  likelihood: "probable" | "possible" | "unlikely";
  priority: ClinicalPriority;
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCO 4 — AÇÕES SUGERIDAS
// ══════════════════════════════════════════════════════════════════════════════

export interface SuggestedActionItem extends ClinicalItemBase {
  action_type: SuggestedActionType;
  description: string;
  rationale: string;
  priority: ClinicalPriority;
  confidence: ConfidenceLevel;
  therapeutic_category?: "supplementation" | "medication" | "lifestyle" | "diet" | "referral";
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCO 5 — FOLLOW-UP
// ══════════════════════════════════════════════════════════════════════════════

export interface FollowUp {
  suggested_exams: string[];
  suggested_return_days?: number;
  notes?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// RESPONSE V2
// ══════════════════════════════════════════════════════════════════════════════

export interface AnalysisResponseV2 {
  executive_summary: string;
  red_flags: RedFlagItem[];
  clinical_findings: ClinicalFindingItem[];
  diagnostic_hypotheses: DiagnosticHypothesisItem[];
  suggested_actions: SuggestedActionItem[];
  follow_up?: FollowUp;
  meta: AnalysisV2Meta;
}

export interface AnalysisV2Meta {
  specialty_id: string;
  specialty_name: string;
  mode: "full" | "analysis_only" | "protocols_only";
  version: "v2";
  model_used?: string;
}
