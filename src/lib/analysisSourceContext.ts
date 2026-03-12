/**
 * analysisSourceContext.ts
 *
 * Builds a snapshot of which data sources were used when generating an AI analysis.
 * This enables staleness detection: if new data arrives after the analysis,
 * the system can flag it without auto-changing the existing analysis.
 */

export interface AnalysisSourceContext {
  /** IDs of lab sessions whose results were fed to the AI */
  lab_session_ids: string[];
  /** Most recent lab session date used */
  latest_lab_session_date: string | null;
  /** IDs of imaging reports available at generation time */
  imaging_report_ids: string[];
  /** IDs of body composition sessions available */
  body_composition_session_ids: string[];
  /** Anamnese snapshot: specialty_id + updated_at */
  anamnese_snapshot: { specialty_id: string; updated_at: string } | null;
  /** Clinical note snapshot: encounter_id + updated_at */
  clinical_note_snapshot: { encounter_id: string; updated_at: string } | null;
  /** Number of lab results fed to analysis */
  lab_result_count: number;
  /** Timestamp when the analysis was generated */
  generated_at: string;
}

/**
 * Builds source context from the data available at analysis generation time.
 */
export function buildSourceContext(params: {
  sessions: Array<{ id: string; session_date: string }>;
  labResultCount: number;
  imagingReportIds?: string[];
  bodyCompositionSessionIds?: string[];
  anamneseSnapshot?: { specialty_id: string; updated_at: string } | null;
  clinicalNoteSnapshot?: { encounter_id: string; updated_at: string } | null;
}): AnalysisSourceContext {
  const sortedSessions = [...params.sessions].sort(
    (a, b) => b.session_date.localeCompare(a.session_date)
  );

  return {
    lab_session_ids: sortedSessions.map((s) => s.id),
    latest_lab_session_date: sortedSessions[0]?.session_date ?? null,
    imaging_report_ids: params.imagingReportIds ?? [],
    body_composition_session_ids: params.bodyCompositionSessionIds ?? [],
    anamnese_snapshot: params.anamneseSnapshot ?? null,
    clinical_note_snapshot: params.clinicalNoteSnapshot ?? null,
    lab_result_count: params.labResultCount,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Checks if there is newer data than what was used in the analysis.
 * Returns a list of reasons why the analysis might be stale.
 */
export function detectStaleness(
  sourceContext: AnalysisSourceContext | null | undefined,
  currentData: {
    latestLabSessionDate?: string | null;
    labSessionIds?: string[];
    imagingReportIds?: string[];
    bodyCompositionSessionIds?: string[];
  }
): string[] {
  if (!sourceContext) return [];

  const reasons: string[] = [];

  // New lab sessions added after analysis
  if (currentData.labSessionIds?.length) {
    const newSessions = currentData.labSessionIds.filter(
      (id) => !sourceContext.lab_session_ids.includes(id)
    );
    if (newSessions.length > 0) {
      reasons.push(`${newSessions.length} nova(s) sessão(ões) de exames desde a última análise`);
    }
  }

  // New lab session date is more recent
  if (
    currentData.latestLabSessionDate &&
    sourceContext.latest_lab_session_date &&
    currentData.latestLabSessionDate > sourceContext.latest_lab_session_date
  ) {
    reasons.push("Exames mais recentes disponíveis");
  }

  // New imaging reports
  if (currentData.imagingReportIds?.length) {
    const newReports = currentData.imagingReportIds.filter(
      (id) => !sourceContext.imaging_report_ids.includes(id)
    );
    if (newReports.length > 0) {
      reasons.push(`${newReports.length} novo(s) laudo(s) de imagem`);
    }
  }

  // New body composition
  if (currentData.bodyCompositionSessionIds?.length) {
    const newBC = currentData.bodyCompositionSessionIds.filter(
      (id) => !sourceContext.body_composition_session_ids.includes(id)
    );
    if (newBC.length > 0) {
      reasons.push(`${newBC.length} nova(s) avaliação(ões) de composição corporal`);
    }
  }

  return reasons;
}
