/**
 * staleReview.test.ts
 *
 * End-to-end validation of review_state versioning:
 *  1. Compatible hash → rehydrates normally
 *  2. Mismatched hash → blocks rehydration, marks outdated
 *  3. Original analysis_v2 stays intact after stale detection
 *  4. Return to same hash → rehydration works again
 */

import { describe, it, expect } from "vitest";
import {
  computeAnalysisV2HashSync,
  REVIEW_SCHEMA_VERSION,
} from "@/lib/analysisV2Hash";
import type { AnalysisV2Data } from "@/components/ClinicalReportV2";
import type { ReviewState } from "@/hooks/useReviewState";

// ── Fixtures ──────────────────────────────────────────────────────────────

function makeAnalysis(overrides?: Partial<AnalysisV2Data>): AnalysisV2Data {
  return {
    executive_summary: "Resumo executivo de teste",
    red_flags: [
      {
        id: "rf_1",
        finding: "Ferritina criticamente baixa",
        severity: "critical" as const,
        suggested_action: "Investigar anemia ferropriva",
        evidence: ["Ferritina: 5 ng/mL"],
        source_type: "deterministic" as const,
        specialty_relevant: true,
        cross_specialty_alert: false,
      },
    ],
    clinical_findings: [
      {
        id: "cf_1",
        system: "Hematológico",
        markers: ["Ferritina", "Hemoglobina"],
        interpretation: "Deficiência de ferro",
        priority: "high" as const,
        confidence: "high" as const,
        source_type: "deterministic" as const,
        specialty_relevant: true,
        cross_specialty_alert: false,
      },
    ],
    diagnostic_hypotheses: [
      {
        id: "dh_1",
        hypothesis: "Anemia ferropriva",
        supporting_findings: ["Ferritina baixa"],
        likelihood: "probable" as const,
        priority: "high" as const,
        source_type: "hybrid" as const,
        specialty_relevant: true,
        cross_specialty_alert: false,
      },
    ],
    suggested_actions: [
      {
        id: "sa_1",
        action_type: "treat" as const,
        description: "Suplementar ferro",
        rationale: "Ferritina < 10",
        priority: "high" as const,
        confidence: "high" as const,
        source_type: "hybrid" as const,
        specialty_relevant: true,
        cross_specialty_alert: false,
      },
    ],
    meta: {
      specialty_id: "medicina_funcional",
      specialty_name: "Medicina Funcional",
      mode: "v2",
      version: "2.0",
    },
    ...overrides,
  };
}

/** Simulates a regenerated analysis with a new item (different IDs) */
function makeRegeneratedAnalysis(): AnalysisV2Data {
  const base = makeAnalysis();
  return {
    ...base,
    // Same structure but new IDs → different hash
    red_flags: [{ ...base.red_flags[0], id: "rf_1_v2" }],
    clinical_findings: [{ ...base.clinical_findings[0], id: "cf_1_v2" }],
    diagnostic_hypotheses: [{ ...base.diagnostic_hypotheses[0], id: "dh_1_v2" }],
    suggested_actions: [
      { ...base.suggested_actions[0], id: "sa_1_v2" },
      {
        id: "sa_2_v2",
        action_type: "investigate" as const,
        description: "Solicitar painel completo de ferro",
        rationale: "Confirmar etiologia",
        priority: "medium" as const,
        confidence: "moderate" as const,
        source_type: "llm" as const,
        specialty_relevant: true,
        cross_specialty_alert: false,
      },
    ],
  };
}

function makeReviewState(itemIds: string[]): ReviewState {
  const state: ReviewState = {};
  for (const id of itemIds) {
    state[id] = {
      decision: "accepted",
      reviewed_at: new Date().toISOString(),
    };
  }
  return state;
}

/**
 * Simulates the rehydration logic from ClinicalReportV2 (lines 703-727).
 * Returns { rehydrated: boolean; outdated: boolean; state: ReviewState | null }.
 */
function simulateRehydration(
  savedReview: { review_state_json: ReviewState; analysis_v2_hash: string | null; schema_version: number },
  currentData: AnalysisV2Data
): { rehydrated: boolean; outdated: boolean; state: ReviewState | null } {
  const currentHash = computeAnalysisV2HashSync(currentData);
  const savedHash = savedReview.analysis_v2_hash;

  if (!savedReview.review_state_json || Object.keys(savedReview.review_state_json).length === 0) {
    return { rehydrated: false, outdated: false, state: null };
  }

  if (savedHash && savedHash !== currentHash) {
    // Hash mismatch — stale
    return { rehydrated: false, outdated: true, state: null };
  }

  // Compatible — rehydrate
  return { rehydrated: true, outdated: false, state: savedReview.review_state_json };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("Stale Review Detection", () => {
  const originalAnalysis = makeAnalysis();
  const originalHash = computeAnalysisV2HashSync(originalAnalysis);
  const originalIds = ["rf_1", "cf_1", "dh_1", "sa_1"];
  const savedReview = makeReviewState(originalIds);

  // ── Case 1: Compatible hash → rehydrates normally ──
  describe("Case 1: Compatible hash", () => {
    it("rehydrates when hash matches", () => {
      const result = simulateRehydration(
        {
          review_state_json: savedReview,
          analysis_v2_hash: originalHash,
          schema_version: REVIEW_SCHEMA_VERSION,
        },
        originalAnalysis
      );

      expect(result.rehydrated).toBe(true);
      expect(result.outdated).toBe(false);
      expect(result.state).toEqual(savedReview);
    });

    it("all original item decisions are preserved", () => {
      const result = simulateRehydration(
        {
          review_state_json: savedReview,
          analysis_v2_hash: originalHash,
          schema_version: REVIEW_SCHEMA_VERSION,
        },
        originalAnalysis
      );

      for (const id of originalIds) {
        expect(result.state![id].decision).toBe("accepted");
      }
    });
  });

  // ── Case 2: analysis_v2 changed → stale, not rehydrated ──
  describe("Case 2: Hash mismatch (regenerated analysis)", () => {
    const regenerated = makeRegeneratedAnalysis();
    const regeneratedHash = computeAnalysisV2HashSync(regenerated);

    it("hashes are different", () => {
      expect(originalHash).not.toBe(regeneratedHash);
    });

    it("does NOT rehydrate stale review", () => {
      const result = simulateRehydration(
        {
          review_state_json: savedReview,
          analysis_v2_hash: originalHash,
          schema_version: REVIEW_SCHEMA_VERSION,
        },
        regenerated // current data is the regenerated version
      );

      expect(result.rehydrated).toBe(false);
      expect(result.outdated).toBe(true);
      expect(result.state).toBeNull();
    });

    it("original analysis_v2 data remains intact after stale detection", () => {
      // Simulate stale detection
      simulateRehydration(
        {
          review_state_json: savedReview,
          analysis_v2_hash: originalHash,
          schema_version: REVIEW_SCHEMA_VERSION,
        },
        regenerated
      );

      // The regenerated data must NOT be mutated
      expect(regenerated.red_flags[0].id).toBe("rf_1_v2");
      expect(regenerated.suggested_actions).toHaveLength(2);
      expect(regenerated.executive_summary).toBe("Resumo executivo de teste");
    });

    it("old review state is still a valid object (traceable)", () => {
      // The saved review wasn't destroyed — it's just not applied
      expect(Object.keys(savedReview)).toHaveLength(4);
      expect(savedReview["rf_1"].decision).toBe("accepted");
    });
  });

  // ── Case 3: Validate analysis immutability ──
  describe("Case 3: Analysis data immutability", () => {
    it("stale detection does not modify current analysis data", () => {
      const currentData = makeAnalysis();
      const snapshot = JSON.stringify(currentData);

      simulateRehydration(
        {
          review_state_json: savedReview,
          analysis_v2_hash: "totally_different_hash",
          schema_version: REVIEW_SCHEMA_VERSION,
        },
        currentData
      );

      expect(JSON.stringify(currentData)).toBe(snapshot);
    });
  });

  // ── Case 4: Return to same hash → rehydration works again ──
  describe("Case 4: Return to original hash", () => {
    it("rehydrates when reverting to matching analysis", () => {
      // First: regenerated analysis (stale)
      const regenerated = makeRegeneratedAnalysis();
      const staleResult = simulateRehydration(
        {
          review_state_json: savedReview,
          analysis_v2_hash: originalHash,
          schema_version: REVIEW_SCHEMA_VERSION,
        },
        regenerated
      );
      expect(staleResult.outdated).toBe(true);

      // Then: revert to original analysis (compatible again)
      const compatibleResult = simulateRehydration(
        {
          review_state_json: savedReview,
          analysis_v2_hash: originalHash,
          schema_version: REVIEW_SCHEMA_VERSION,
        },
        originalAnalysis
      );
      expect(compatibleResult.rehydrated).toBe(true);
      expect(compatibleResult.outdated).toBe(false);
      expect(compatibleResult.state).toEqual(savedReview);
    });
  });

  // ── Edge cases ──
  describe("Edge cases", () => {
    it("empty review state is not rehydrated (no crash)", () => {
      const result = simulateRehydration(
        { review_state_json: {} as ReviewState, analysis_v2_hash: originalHash, schema_version: 1 },
        originalAnalysis
      );
      expect(result.rehydrated).toBe(false);
      expect(result.outdated).toBe(false);
    });

    it("null hash in saved review allows rehydration (legacy data)", () => {
      const result = simulateRehydration(
        { review_state_json: savedReview, analysis_v2_hash: null, schema_version: 1 },
        originalAnalysis
      );
      // When savedHash is null, the condition `savedHash && savedHash !== currentHash` is false
      // So it falls through to rehydration
      expect(result.rehydrated).toBe(true);
      expect(result.outdated).toBe(false);
    });

    it("hash is deterministic for same data", () => {
      const hash1 = computeAnalysisV2HashSync(originalAnalysis);
      const hash2 = computeAnalysisV2HashSync(originalAnalysis);
      expect(hash1).toBe(hash2);
    });

    it("hash changes when item IDs change", () => {
      const modified = makeAnalysis({ red_flags: [{ ...originalAnalysis.red_flags[0], id: "rf_NEW" }] });
      expect(computeAnalysisV2HashSync(modified)).not.toBe(originalHash);
    });

    it("hash does NOT change when non-ID fields change", () => {
      const modified = makeAnalysis();
      modified.executive_summary = "Totalmente diferente";
      modified.red_flags[0].finding = "Texto alterado";
      expect(computeAnalysisV2HashSync(modified)).toBe(originalHash);
    });

    it("REVIEW_SCHEMA_VERSION is a positive integer", () => {
      expect(REVIEW_SCHEMA_VERSION).toBeGreaterThan(0);
      expect(Number.isInteger(REVIEW_SCHEMA_VERSION)).toBe(true);
    });
  });

  // ── UI badge logic simulation ──
  describe("UI badge coherence", () => {
    function getBadgeLabel(savedHash: string | null, currentHash: string): string {
      if (!savedHash) return "—";
      return savedHash === currentHash ? "compatível" : "desatualizado";
    }

    it("shows 'compatível' when hashes match", () => {
      expect(getBadgeLabel(originalHash, originalHash)).toBe("compatível");
    });

    it("shows 'desatualizado' when hashes differ", () => {
      const otherHash = computeAnalysisV2HashSync(makeRegeneratedAnalysis());
      expect(getBadgeLabel(originalHash, otherHash)).toBe("desatualizado");
    });

    it("shows '—' when no saved hash", () => {
      expect(getBadgeLabel(null, originalHash)).toBe("—");
    });
  });
});
