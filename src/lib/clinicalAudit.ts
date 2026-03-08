/**
 * clinicalAudit.ts
 *
 * Camada de auditoria automática de consistência clínica.
 * Detecta incoerências entre valor, unidade, referência e status
 * ANTES que virem problema em telas, PDFs ou análises da IA.
 *
 * Severidades:
 *   - info:    observação registrada, sem impacto
 *   - warning: inconsistência detectada, não bloqueia
 *   - error:   problema que pode distorcer resultados clínicos
 *   - block:   dados corrompidos, deve impedir persistência
 */

import { MARKERS, type MarkerDef, resolveReference, getMarkerStatusFromRef } from "@/lib/markers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditSeverity = "info" | "warning" | "error" | "block";

export interface AuditIssue {
  severity: AuditSeverity;
  code: string;
  marker_id: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface AuditReport {
  timestamp: string;
  context: string;              // e.g. "save_session", "report_build"
  patient_id?: string;
  session_id?: string;
  total_results: number;
  issues: AuditIssue[];
  has_blocks: boolean;
  has_errors: boolean;
  summary: string;
}

export interface AuditableResult {
  marker_id: string;
  value?: number | null;
  text_value?: string | null;
  lab_ref_min?: number | null;
  lab_ref_max?: number | null;
  lab_ref_text?: string | null;
}

// ---------------------------------------------------------------------------
// Audit checks
// ---------------------------------------------------------------------------

/** Check 1: Referência invertida (min > max) */
function checkRefInverted(r: AuditableResult): AuditIssue | null {
  if (
    r.lab_ref_min != null && r.lab_ref_max != null &&
    r.lab_ref_min > r.lab_ref_max
  ) {
    return {
      severity: "error",
      code: "REF_INVERTED",
      marker_id: r.marker_id,
      message: `Referência invertida: min=${r.lab_ref_min} > max=${r.lab_ref_max}`,
      details: { lab_ref_min: r.lab_ref_min, lab_ref_max: r.lab_ref_max },
    };
  }
  return null;
}

/** Check 2: Valor numérico ausente em marcador quantitativo */
function checkMissingValue(r: AuditableResult, marker?: MarkerDef): AuditIssue | null {
  if (marker?.qualitative) return null;
  if ((r.value === null || r.value === undefined || isNaN(r.value as number)) && !r.text_value) {
    return {
      severity: "error",
      code: "MISSING_VALUE",
      marker_id: r.marker_id,
      message: "Marcador quantitativo sem valor numérico ou textual",
    };
  }
  return null;
}

/** Check 3: Valor negativo (biologicamente impossível para a maioria dos marcadores) */
function checkNegativeValue(r: AuditableResult): AuditIssue | null {
  if (typeof r.value === "number" && r.value < 0) {
    return {
      severity: "error",
      code: "NEGATIVE_VALUE",
      marker_id: r.marker_id,
      message: `Valor negativo: ${r.value}`,
    };
  }
  return null;
}

/** Check 4: Ordem de grandeza incompatível entre valor e referência */
function checkMagnitudeMismatch(r: AuditableResult): AuditIssue | null {
  if (typeof r.value !== "number" || r.value === 0) return null;

  const refMid = (r.lab_ref_min != null && r.lab_ref_max != null)
    ? (r.lab_ref_min + r.lab_ref_max) / 2
    : r.lab_ref_max ?? r.lab_ref_min ?? null;

  if (refMid === null || refMid === 0) return null;

  const ratio = Math.max(r.value / refMid, refMid / r.value);
  if (ratio > 100) {
    return {
      severity: "error",
      code: "MAGNITUDE_MISMATCH",
      marker_id: r.marker_id,
      message: `Valor (${r.value}) difere >100x da referência (mid≈${refMid.toFixed(2)}) — possível unidade errada`,
      details: { value: r.value, ref_mid: refMid, ratio },
    };
  }
  if (ratio > 10) {
    return {
      severity: "warning",
      code: "MAGNITUDE_WARNING",
      marker_id: r.marker_id,
      message: `Valor (${r.value}) difere >10x da referência (mid≈${refMid.toFixed(2)}) — verificar unidade`,
      details: { value: r.value, ref_mid: refMid, ratio },
    };
  }
  return null;
}

/** Check 5: Status visual incoerente com valor e referência */
function checkStatusConsistency(
  r: AuditableResult,
  patientSex: "M" | "F"
): AuditIssue | null {
  if (typeof r.value !== "number" || isNaN(r.value)) return null;

  const marker = MARKERS.find(m => m.id === r.marker_id);
  if (!marker) return null;

  const ref = resolveReference(marker, patientSex, r.lab_ref_text ?? undefined);
  const expectedStatus = getMarkerStatusFromRef(r.value, ref);

  // Compare against what the lab ref alone would say
  if (r.lab_ref_min != null || r.lab_ref_max != null) {
    let labStatus: "normal" | "low" | "high" = "normal";
    if (r.lab_ref_min != null && r.value < r.lab_ref_min) labStatus = "low";
    else if (r.lab_ref_max != null && r.value > r.lab_ref_max) labStatus = "high";

    if (labStatus !== expectedStatus) {
      return {
        severity: "warning",
        code: "STATUS_MISMATCH",
        marker_id: r.marker_id,
        message: `Status calculado pelo labRef (${labStatus}) diverge do resolveReference (${expectedStatus})`,
        details: {
          value: r.value,
          lab_ref_min: r.lab_ref_min,
          lab_ref_max: r.lab_ref_max,
          expected: expectedStatus,
          from_lab: labStatus,
        },
      };
    }
  }

  return null;
}

/** Check 6: Referência ausente */
function checkMissingReference(r: AuditableResult, marker?: MarkerDef): AuditIssue | null {
  if (marker?.qualitative) return null;
  if (
    !r.lab_ref_text &&
    r.lab_ref_min == null &&
    r.lab_ref_max == null
  ) {
    return {
      severity: "info",
      code: "NO_LAB_REF",
      marker_id: r.marker_id,
      message: "Sem referência laboratorial — usando range padrão do sistema",
    };
  }
  return null;
}

/** Check 7: Marcador desconhecido (não está em MARKERS) */
function checkUnknownMarker(r: AuditableResult): AuditIssue | null {
  const marker = MARKERS.find(m => m.id === r.marker_id);
  if (!marker) {
    return {
      severity: "warning",
      code: "UNKNOWN_MARKER",
      marker_id: r.marker_id,
      message: `Marcador "${r.marker_id}" não existe no catálogo MARKERS`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main audit function
// ---------------------------------------------------------------------------

/**
 * Executa auditoria de consistência em um conjunto de resultados.
 * Não bloqueia nem modifica dados — apenas detecta e sinaliza.
 */
export function auditResults(
  results: AuditableResult[],
  options: {
    context: string;
    patientSex?: "M" | "F";
    patientId?: string;
    sessionId?: string;
  }
): AuditReport {
  const issues: AuditIssue[] = [];
  const sex = options.patientSex ?? "M";

  for (const r of results) {
    const marker = MARKERS.find(m => m.id === r.marker_id);

    // Run all checks, collect non-null issues
    const checks = [
      checkRefInverted(r),
      checkMissingValue(r, marker),
      checkNegativeValue(r),
      checkMagnitudeMismatch(r),
      checkStatusConsistency(r, sex),
      checkMissingReference(r, marker),
      checkUnknownMarker(r),
    ];

    for (const issue of checks) {
      if (issue) issues.push(issue);
    }
  }

  const has_blocks = issues.some(i => i.severity === "block");
  const has_errors = issues.some(i => i.severity === "error");
  const warnings = issues.filter(i => i.severity === "warning").length;
  const errors = issues.filter(i => i.severity === "error").length;
  const blocks = issues.filter(i => i.severity === "block").length;

  let summary: string;
  if (issues.length === 0) {
    summary = `✅ ${results.length} resultados sem inconsistências`;
  } else {
    const parts: string[] = [];
    if (blocks > 0) parts.push(`${blocks} bloqueios`);
    if (errors > 0) parts.push(`${errors} erros`);
    if (warnings > 0) parts.push(`${warnings} avisos`);
    summary = `⚠️ ${results.length} resultados: ${parts.join(", ")}`;
  }

  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    context: options.context,
    patient_id: options.patientId,
    session_id: options.sessionId,
    total_results: results.length,
    issues,
    has_blocks,
    has_errors,
    summary,
  };

  // Log to console for debugging
  if (issues.length > 0) {
    console.warn(`[AUDIT:${options.context}] ${summary}`);
    for (const i of issues.filter(x => x.severity !== "info")) {
      console.warn(`  [${i.severity.toUpperCase()}] ${i.marker_id}: ${i.message}`);
    }
  } else {
    console.log(`[AUDIT:${options.context}] ${summary}`);
  }

  return report;
}
