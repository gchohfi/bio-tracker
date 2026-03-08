import { describe, it, expect } from "vitest";
import { buildReviewedReport } from "@/lib/buildReviewedReport";
import type { AnalysisV2Data } from "@/components/ClinicalReportV2";
import type { ReviewState } from "@/hooks/useReviewState";

function makeData(): AnalysisV2Data {
  return {
    executive_summary: "Resumo",
    red_flags: [
      { id: "rf1", finding: "Flag A", severity: "critical" as const, suggested_action: "Ação", evidence: ["ev1"], source_type: "deterministic" as const, specialty_relevant: true, cross_specialty_alert: false },
    ],
    clinical_findings: [
      { id: "cf1", system: "Hema", markers: ["Hb"], interpretation: "Baixa", priority: "high" as const, confidence: "high" as const, source_type: "deterministic" as const, specialty_relevant: true, cross_specialty_alert: false },
    ],
    diagnostic_hypotheses: [
      { id: "dh1", hypothesis: "Anemia", supporting_findings: ["Hb baixa"], likelihood: "probable" as const, priority: "high" as const, source_type: "hybrid" as const, specialty_relevant: true, cross_specialty_alert: false },
    ],
    suggested_actions: [
      { id: "sa1", action_type: "treat" as const, description: "Ferro", rationale: "Deficiência", priority: "high" as const, confidence: "high" as const, source_type: "hybrid" as const, specialty_relevant: true, cross_specialty_alert: false },
    ],
    meta: { specialty_id: "mf", specialty_name: "MF", mode: "v2", version: "2.0" },
  };
}

describe("buildReviewedReport", () => {
  it("accepted items enter with original text", () => {
    const reviews: ReviewState = { rf1: { decision: "accepted", reviewed_at: "t" } };
    const report = buildReviewedReport(makeData(), reviews);
    expect(report.red_flags).toHaveLength(1);
    expect(report.red_flags[0].decision).toBe("accepted");
    expect(report.red_flags[0].final_text).toContain("Flag A");
  });

  it("edited items enter with edited text", () => {
    const reviews: ReviewState = { cf1: { decision: "edited", edited_content: "Texto médico", reviewed_at: "t" } };
    const report = buildReviewedReport(makeData(), reviews);
    expect(report.clinical_findings[0].decision).toBe("edited");
    expect(report.clinical_findings[0].final_text).toBe("Texto médico");
    expect(report.clinical_findings[0].original_text).toBe("Baixa");
  });

  it("rejected items are excluded", () => {
    const reviews: ReviewState = { dh1: { decision: "rejected", reviewed_at: "t" } };
    const report = buildReviewedReport(makeData(), reviews);
    expect(report.diagnostic_hypotheses).toHaveLength(0);
  });

  it("pending items enter as-is", () => {
    const report = buildReviewedReport(makeData(), {});
    expect(report.suggested_actions).toHaveLength(1);
    expect(report.suggested_actions[0].decision).toBe("pending");
  });

  it("review_summary counts correctly", () => {
    const reviews: ReviewState = {
      rf1: { decision: "accepted", reviewed_at: "t" },
      cf1: { decision: "edited", edited_content: "x", reviewed_at: "t" },
      dh1: { decision: "rejected", reviewed_at: "t" },
      // sa1 is pending
    };
    const report = buildReviewedReport(makeData(), reviews);
    expect(report.review_summary.accepted).toBe(1);
    expect(report.review_summary.edited).toBe(1);
    expect(report.review_summary.rejected).toBe(1);
    expect(report.review_summary.pending).toBe(1);
    expect(report.review_summary.total).toBe(4);
  });

  it("physician_note is carried through", () => {
    const reviews: ReviewState = { rf1: { decision: "accepted", physician_note: "Nota teste", reviewed_at: "t" } };
    const report = buildReviewedReport(makeData(), reviews);
    expect(report.red_flags[0].physician_note).toBe("Nota teste");
  });

  it("original analysis data is never mutated", () => {
    const data = makeData();
    const snapshot = JSON.stringify(data);
    buildReviewedReport(data, { rf1: { decision: "edited", edited_content: "CHANGED", reviewed_at: "t" } });
    expect(JSON.stringify(data)).toBe(snapshot);
  });
});
