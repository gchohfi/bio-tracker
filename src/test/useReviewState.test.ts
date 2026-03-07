import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReviewState } from "@/hooks/useReviewState";

describe("useReviewState", () => {
  it("starts empty by default", () => {
    const { result } = renderHook(() => useReviewState());
    expect(result.current.reviews).toEqual({});
  });

  it("accepts initial state", () => {
    const initial = { item1: { decision: "accepted" as const, reviewed_at: "2026-01-01" } };
    const { result } = renderHook(() => useReviewState(initial));
    expect(result.current.getReview("item1")?.decision).toBe("accepted");
  });

  it("setDecision creates a review entry", () => {
    const { result } = renderHook(() => useReviewState());
    act(() => result.current.setDecision("rf_1", "accepted"));
    expect(result.current.getReview("rf_1")?.decision).toBe("accepted");
    expect(result.current.getReview("rf_1")?.reviewed_at).toBeTruthy();
  });

  it("setDecision with edited_content stores it", () => {
    const { result } = renderHook(() => useReviewState());
    act(() => result.current.setDecision("h_1", "edited", { edited_content: "Nova hipótese", physician_note: "Confirmei no exame" }));
    const review = result.current.getReview("h_1");
    expect(review?.decision).toBe("edited");
    expect(review?.edited_content).toBe("Nova hipótese");
    expect(review?.physician_note).toBe("Confirmei no exame");
  });

  it("clearDecision removes the entry", () => {
    const { result } = renderHook(() => useReviewState());
    act(() => result.current.setDecision("a_1", "rejected"));
    expect(result.current.getReview("a_1")?.decision).toBe("rejected");
    act(() => result.current.clearDecision("a_1"));
    expect(result.current.getReview("a_1")).toBeUndefined();
  });

  it("getStats computes correctly", () => {
    const { result } = renderHook(() => useReviewState());
    const ids = ["id1", "id2", "id3", "id4", "id5"];
    act(() => {
      result.current.setDecision("id1", "accepted");
      result.current.setDecision("id2", "edited", { edited_content: "x" });
      result.current.setDecision("id3", "rejected");
      // id4 and id5 left pending
    });
    const stats = result.current.getStats(ids);
    expect(stats.total).toBe(5);
    expect(stats.accepted).toBe(1);
    expect(stats.edited).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.pending).toBe(2);
  });

  it("overwriting a decision replaces the previous one", () => {
    const { result } = renderHook(() => useReviewState());
    act(() => result.current.setDecision("id1", "accepted"));
    expect(result.current.getReview("id1")?.decision).toBe("accepted");
    act(() => result.current.setDecision("id1", "rejected", { physician_note: "Mudei de ideia" }));
    expect(result.current.getReview("id1")?.decision).toBe("rejected");
    expect(result.current.getReview("id1")?.physician_note).toBe("Mudei de ideia");
  });
});
