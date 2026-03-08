/**
 * traceability.ts
 *
 * Camada leve de rastreabilidade para artefatos clínicos.
 * Gera metadados de proveniência (quem, quando, o quê, de onde)
 * para exames, análises IA, revisões, prescrições e exportações.
 *
 * Não persiste dados — apenas gera e loga metadados.
 * A persistência fica com cada módulo consumidor.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArtifactOrigin =
  | "pdf_extraction"       // Extração de PDF via IA
  | "manual_entry"         // Digitação manual
  | "ai_analysis"          // Geração de análise IA
  | "ai_protocols"         // Geração de protocolos IA
  | "medical_review"       // Revisão médica
  | "derived_calculation"  // Cálculo derivado (HOMA-IR, etc.)
  | "inbody_import"        // Importação InBody
  | "manual_imaging"       // Laudo de imagem manual
  | "export_pdf"           // Exportação PDF
  | "export_excel"         // Exportação Excel
  | "export_csv";          // Exportação CSV

export type ArtifactStatus =
  | "original"    // Dado bruto, sem intervenção
  | "processed"   // Passou por pipeline (normalização, conversão)
  | "reviewed"    // Revisado pelo médico
  | "finalized"   // Finalizado/exportado
  | "archived";   // Arquivado

export interface ProvenanceMetadata {
  /** Identificador único do evento de rastreabilidade */
  trace_id: string;
  /** Tipo de artefato */
  artifact_type: string;
  /** Origem do dado */
  origin: ArtifactOrigin;
  /** Status atual */
  status: ArtifactStatus;
  /** ID do profissional */
  practitioner_id?: string;
  /** ID do paciente */
  patient_id?: string;
  /** Timestamp ISO */
  timestamp: string;
  /** Versão do sistema/pipeline */
  system_version: string;
  /** Hash do conteúdo (quando aplicável) */
  content_hash?: string;
  /** Referências a outros trace_ids */
  parent_traces?: string[];
  /** Dados extras */
  extra?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYSTEM_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Gera um trace_id curto e único */
function generateTraceId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `tr_${ts}_${rand}`;
}

/** Hash simples para conteúdo (não criptográfico, apenas fingerprint) */
export function quickHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Cria metadados de proveniência para um artefato clínico.
 */
export function createProvenance(
  artifactType: string,
  origin: ArtifactOrigin,
  status: ArtifactStatus,
  options?: {
    practitionerId?: string;
    patientId?: string;
    contentHash?: string;
    parentTraces?: string[];
    extra?: Record<string, unknown>;
  }
): ProvenanceMetadata {
  return {
    trace_id: generateTraceId(),
    artifact_type: artifactType,
    origin,
    status,
    practitioner_id: options?.practitionerId,
    patient_id: options?.patientId,
    timestamp: new Date().toISOString(),
    system_version: SYSTEM_VERSION,
    content_hash: options?.contentHash,
    parent_traces: options?.parentTraces,
    extra: options?.extra,
  };
}

/**
 * Loga um evento de rastreabilidade no console de forma estruturada.
 * Em produção, isso poderia ser enviado a um serviço de observabilidade.
 */
export function logTrace(
  action: string,
  provenance: ProvenanceMetadata,
  details?: Record<string, unknown>
): void {
  const logEntry = {
    action,
    ...provenance,
    ...(details ? { details } : {}),
  };

  console.log(
    `[TRACE:${provenance.origin}] ${action} | ${provenance.artifact_type} | status=${provenance.status} | trace=${provenance.trace_id}`,
    details ? details : ""
  );

  // Store in sessionStorage for debugging (last 50 traces)
  try {
    const stored = JSON.parse(sessionStorage.getItem("__clinical_traces") || "[]");
    stored.push(logEntry);
    if (stored.length > 50) stored.shift();
    sessionStorage.setItem("__clinical_traces", JSON.stringify(stored));
  } catch {
    // Non-critical — ignore storage errors
  }
}

/**
 * Recupera os traces recentes do sessionStorage para debugging.
 */
export function getRecentTraces(): ProvenanceMetadata[] {
  try {
    return JSON.parse(sessionStorage.getItem("__clinical_traces") || "[]");
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Convenience factories
// ---------------------------------------------------------------------------

export const Trace = {
  /** Rastreia extração de PDF */
  pdfExtraction(practitionerId: string, patientId: string, markerCount: number, qualityScore?: number) {
    const p = createProvenance("lab_session", "pdf_extraction", "processed", {
      practitionerId, patientId,
      extra: { marker_count: markerCount, quality_score: qualityScore },
    });
    logTrace("PDF_EXTRACTED", p, { marker_count: markerCount, quality_score: qualityScore });
    return p;
  },

  /** Rastreia salvamento de sessão de exames */
  sessionSave(practitionerId: string, patientId: string, sessionId: string, resultCount: number, isEdit: boolean) {
    const p = createProvenance("lab_session", isEdit ? "manual_entry" : "pdf_extraction", "original", {
      practitionerId, patientId,
      extra: { session_id: sessionId, result_count: resultCount, is_edit: isEdit },
    });
    logTrace("SESSION_SAVED", p, { session_id: sessionId, result_count: resultCount });
    return p;
  },

  /** Rastreia geração de análise IA */
  aiAnalysis(practitionerId: string, patientId: string, specialtyId: string, mode: string, model?: string) {
    const p = createProvenance("ai_analysis", "ai_analysis", "original", {
      practitionerId, patientId,
      extra: { specialty_id: specialtyId, mode, model },
    });
    logTrace("AI_ANALYSIS_GENERATED", p, { specialty_id: specialtyId, mode, model });
    return p;
  },

  /** Rastreia revisão médica */
  medicalReview(practitionerId: string, patientId: string, analysisId: string, stats: { accepted: number; edited: number; rejected: number }) {
    const p = createProvenance("medical_review", "medical_review", "reviewed", {
      practitionerId, patientId,
      extra: { analysis_id: analysisId, ...stats },
    });
    logTrace("REVIEW_SAVED", p, { analysis_id: analysisId, ...stats });
    return p;
  },

  /** Rastreia exportação de PDF/Excel */
  export(practitionerId: string, patientId: string, format: "pdf" | "excel" | "csv", reportType: string) {
    const p = createProvenance("export", format === "pdf" ? "export_pdf" : format === "excel" ? "export_excel" : "export_csv", "finalized", {
      practitionerId, patientId,
      extra: { report_type: reportType },
    });
    logTrace("EXPORTED", p, { format, report_type: reportType });
    return p;
  },

  /** Rastreia importação de composição corporal */
  bodyComposition(practitionerId: string, patientId: string, sourceType: string) {
    const p = createProvenance("body_composition", sourceType === "inbody" ? "inbody_import" : "manual_entry", "original", {
      practitionerId, patientId,
      extra: { source_type: sourceType },
    });
    logTrace("BODY_COMP_SAVED", p, { source_type: sourceType });
    return p;
  },

  /** Rastreia salvamento de laudo de imagem */
  imagingReport(practitionerId: string, patientId: string, examType: string) {
    const p = createProvenance("imaging_report", "manual_imaging", "original", {
      practitionerId, patientId,
      extra: { exam_type: examType },
    });
    logTrace("IMAGING_SAVED", p, { exam_type: examType });
    return p;
  },
};
