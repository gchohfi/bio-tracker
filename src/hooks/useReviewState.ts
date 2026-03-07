import { useState, useCallback } from "react";

// ── Review State Types ──────────────────────────────────────────────────

export type ReviewDecision = "accepted" | "edited" | "rejected" | "pending";

export interface ItemReview {
  decision: ReviewDecision;
  edited_content?: string;
  physician_note?: string;
  reviewed_at?: string; // ISO timestamp
}

/**
 * ReviewState — camada separada do payload IA.
 * Cada chave é o `id` do item V2 (red_flag, finding, hypothesis, action).
 * O payload original da IA nunca é mutado.
 */
export type ReviewState = Record<string, ItemReview>;

export interface ReviewStats {
  total: number;
  accepted: number;
  edited: number;
  rejected: number;
  pending: number;
}

// ── Hook ────────────────────────────────────────────────────────────────

export function useReviewState(initialState?: ReviewState) {
  const [reviews, setReviews] = useState<ReviewState>(initialState ?? {});

  const setAll = useCallback((state: ReviewState) => {
    setReviews(state);
  }, []);

  const setDecision = useCallback(
    (itemId: string, decision: ReviewDecision, opts?: { edited_content?: string; physician_note?: string }) => {
      setReviews((prev) => ({
        ...prev,
        [itemId]: {
          decision,
          edited_content: opts?.edited_content,
          physician_note: opts?.physician_note,
          reviewed_at: new Date().toISOString(),
        },
      }));
    },
    []
  );

  const clearDecision = useCallback((itemId: string) => {
    setReviews((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }, []);

  const getReview = useCallback(
    (itemId: string): ItemReview | undefined => reviews[itemId],
    [reviews]
  );

  const getStats = useCallback(
    (itemIds: string[]): ReviewStats => {
      const stats: ReviewStats = { total: itemIds.length, accepted: 0, edited: 0, rejected: 0, pending: 0 };
      for (const id of itemIds) {
        const r = reviews[id];
        if (!r || r.decision === "pending") stats.pending++;
        else stats[r.decision]++;
      }
      return stats;
    },
    [reviews]
  );

  return { reviews, setDecision, clearDecision, getReview, getStats };
}
