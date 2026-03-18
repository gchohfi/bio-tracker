/**
 * types.ts
 *
 * Request/Response types for the analyze-lab-results edge function.
 * Pure type definitions — no runtime code.
 */

export interface MarkerResult {
  marker_id: string;
  marker_name: string;
  value: number | null;
  text_value?: string;
  unit: string;
  functional_min?: number;
  functional_max?: number;
  status: "normal" | "low" | "high" | "critical_low" | "critical_high" | "qualitative";
  session_date: string;
}

export interface PatientProfile {
  objectives?: string[];
  activity_level?: string | null;
  sport_modality?: string | null;
  main_complaints?: string | null;
  restrictions?: string | null;
}

/** SOAP notes from the current encounter */
export interface EncounterSOAP {
  chief_complaint?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  exams_requested?: string | null;
  medications?: string | null;
  free_notes?: string | null;
}

/** Context explicitly linked to the current encounter */
export interface EncounterContext {
  encounter_id: string;
  encounter_date: string;
  soap?: EncounterSOAP | null;
  linked_lab_session_ids?: string[];
  linked_body_composition_ids?: string[];
  linked_imaging_report_ids?: string[];
}

export interface AnalysisRequest {
  patient_name: string;
  patient_id?: string;
  sex: "M" | "F";
  birth_date?: string;
  sessions: Array<{ id: string; session_date: string }>;
  results: MarkerResult[];
  mode?: "full" | "analysis_only" | "protocols_only";
  patient_profile?: PatientProfile | null;
  specialty_id?: string;
  encounter_context?: EncounterContext | null;
}

export interface ProtocolRecommendation {
  protocol_id: string;
  protocol_name: string;
  category: string;
  via: string;
  composition: string;
  justification: string;
  priority: "alta" | "media" | "baixa";
  key_actives: string[];
}

export interface PrescriptionRow {
  substancia: string;
  dose: string;
  via: string;
  frequencia: string;
  duracao: string;
  condicoes_ci: string;
  monitorizacao: string;
}

export interface AnalysisResponse {
  summary: string;
  patterns: string[];
  trends: string[];
  suggestions: string[];
  full_text: string;
  technical_analysis?: string;
  patient_plan?: string;
  prescription_table?: PrescriptionRow[];
  protocol_recommendations?: ProtocolRecommendation[];
  diagnostic_hypotheses?: Array<{
    hypothesis?: string;
    supporting_findings?: string[];
    contradicting_findings?: string[];
    confirmatory_exams?: string[];
    likelihood?: "probable" | "possible" | "unlikely";
    priority?: string;
  }>;
  follow_up?: {
    suggested_exams?: string[];
    suggested_return_days?: number;
    notes?: string;
  };
}
