/**
 * buildReviewedReport.ts
 *
 * Merge de analysis_v2 (imutável) + review_state → payload final revisado.
 *
 * Regras:
 *   - accepted  → entra como está
 *   - edited    → entra com edited_content sobrescrevendo o campo textual principal
 *   - rejected  → excluído do relatório final
 *   - pending   → entra como está (não revisado = aceito por omissão)
 *
 * O analysis_v2 original NUNCA é mutado.
 */

import type { AnalysisV2Data } from "@/components/ClinicalReportV2";
import type { ReviewState } from "@/hooks/useReviewState";

export interface ReviewedReportData {
  executive_summary: string;
  red_flags: ReviewedItem[];
  clinical_findings: ReviewedItem[];
  diagnostic_hypotheses: ReviewedItem[];
  suggested_actions: ReviewedItem[];
  follow_up?: {
    suggested_exams: string[];
    suggested_return_days?: number;
    notes?: string;
  };
  meta: AnalysisV2Data["meta"];
  review_summary: {
    total: number;
    accepted: number;
    edited: number;
    rejected: number;
    pending: number;
  };
}

export interface ReviewedItem {
  id: string;
  decision: "accepted" | "edited" | "pending";
  original_text: string;
  final_text: string;
  physician_note?: string;
  // Carry-through fields for PDF rendering
  extra: Record<string, unknown>;
}

// ── Helpers ──

function getMainText(item: Record<string, unknown>): string {
  // Try known text fields in priority order
  for (const key of ["finding", "interpretation", "hypothesis", "description"]) {
    if (typeof item[key] === "string") return item[key] as string;
  }
  return JSON.stringify(item);
}

function applyEdit(item: Record<string, unknown>, editedContent: string): Record<string, unknown> {
  const clone = { ...item };
  for (const key of ["finding", "interpretation", "hypothesis", "description"]) {
    if (typeof clone[key] === "string") {
      clone[key] = editedContent;
      return clone;
    }
  }
  return clone;
}

function buildReviewedItems(
  items: Array<Record<string, unknown> & { id: string }>,
  reviews: ReviewState
): ReviewedItem[] {
  const result: ReviewedItem[] = [];
  for (const item of items) {
    const review = reviews[item.id];
    if (review?.decision === "rejected") continue;

    const originalText = getMainText(item);
    let finalText = originalText;
    let decision: ReviewedItem["decision"] = "pending";

    if (review?.decision === "accepted") {
      decision = "accepted";
    } else if (review?.decision === "edited" && review.edited_content) {
      decision = "edited";
      finalText = review.edited_content;
    }

    // Extra fields for PDF context
    const { id, ...extra } = item;
    result.push({
      id: item.id,
      decision,
      original_text: originalText,
      final_text: finalText,
      physician_note: review?.physician_note,
      extra,
    });
  }
  return result;
}

// ── Main builder ──

export function buildReviewedReport(
  data: AnalysisV2Data,
  reviews: ReviewState
): ReviewedReportData {
  const redFlags = buildReviewedItems(data.red_flags as any, reviews);
  const findings = buildReviewedItems(data.clinical_findings as any, reviews);
  const hypotheses = buildReviewedItems(data.diagnostic_hypotheses as any, reviews);
  const actions = buildReviewedItems(data.suggested_actions as any, reviews);

  const allIds = [
    ...data.red_flags.map((f) => f.id),
    ...data.clinical_findings.map((f) => f.id),
    ...data.diagnostic_hypotheses.map((h) => h.id),
    ...data.suggested_actions.map((a) => a.id),
  ];

  const summary = { total: allIds.length, accepted: 0, edited: 0, rejected: 0, pending: 0 };
  for (const id of allIds) {
    const r = reviews[id];
    if (!r || r.decision === "pending") summary.pending++;
    else summary[r.decision]++;
  }

  return {
    executive_summary: data.executive_summary,
    red_flags: redFlags,
    clinical_findings: findings,
    diagnostic_hypotheses: hypotheses,
    suggested_actions: actions,
    follow_up: data.follow_up,
    meta: data.meta,
    review_summary: summary,
  };
}
