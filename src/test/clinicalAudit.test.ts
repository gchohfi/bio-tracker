import { describe, it, expect } from "vitest";
import { auditResults, type AuditableResult } from "@/lib/clinicalAudit";

describe("clinicalAudit", () => {
  const baseOpts = { context: "test", patientSex: "M" as const };

  it("returns clean report for valid results", () => {
    const results: AuditableResult[] = [
      { marker_id: "hemoglobina", value: 15, lab_ref_min: 13.5, lab_ref_max: 17.5 },
      { marker_id: "glicose_jejum", value: 90, lab_ref_min: 70, lab_ref_max: 99 },
    ];
    const report = auditResults(results, baseOpts);
    expect(report.issues).toHaveLength(0);
    expect(report.has_errors).toBe(false);
    expect(report.has_blocks).toBe(false);
  });

  it("detects inverted reference", () => {
    const results: AuditableResult[] = [
      { marker_id: "hemoglobina", value: 15, lab_ref_min: 17.5, lab_ref_max: 13.5 },
    ];
    const report = auditResults(results, baseOpts);
    expect(report.issues.some(i => i.code === "REF_INVERTED")).toBe(true);
  });

  it("detects negative value", () => {
    const results: AuditableResult[] = [
      { marker_id: "glicose_jejum", value: -5 },
    ];
    const report = auditResults(results, baseOpts);
    expect(report.issues.some(i => i.code === "NEGATIVE_VALUE")).toBe(true);
  });

  it("detects magnitude mismatch (possible unit error)", () => {
    // Hemoglobin value in mg/dL scale instead of g/dL
    const results: AuditableResult[] = [
      { marker_id: "hemoglobina", value: 15000, lab_ref_min: 13.5, lab_ref_max: 17.5 },
    ];
    const report = auditResults(results, baseOpts);
    expect(report.issues.some(i => i.code === "MAGNITUDE_MISMATCH")).toBe(true);
  });

  it("detects unknown marker", () => {
    const results: AuditableResult[] = [
      { marker_id: "fake_marker_xyz", value: 10 },
    ];
    const report = auditResults(results, baseOpts);
    expect(report.issues.some(i => i.code === "UNKNOWN_MARKER")).toBe(true);
  });

  it("flags missing value for quantitative marker", () => {
    const results: AuditableResult[] = [
      { marker_id: "hemoglobina", value: null },
    ];
    const report = auditResults(results, baseOpts);
    expect(report.issues.some(i => i.code === "MISSING_VALUE")).toBe(true);
  });

  it("does not flag missing value for qualitative marker", () => {
    const results: AuditableResult[] = [
      { marker_id: "fan", value: null, text_value: "Não reagente" },
    ];
    const report = auditResults(results, baseOpts);
    expect(report.issues.every(i => i.code !== "MISSING_VALUE")).toBe(true);
  });

  it("flags missing lab reference as info", () => {
    const results: AuditableResult[] = [
      { marker_id: "hemoglobina", value: 14 },
    ];
    const report = auditResults(results, baseOpts);
    const noRef = report.issues.find(i => i.code === "NO_LAB_REF");
    expect(noRef).toBeDefined();
    expect(noRef?.severity).toBe("info");
  });
});
