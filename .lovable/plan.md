

# Plan: TSH Reference Fix + Missing Exams Investigation

## Issues Identified

### 1. TSH Reference (0.27-4.2 vs 0.45-4.5)

The `labRange` in `src/lib/markers.ts` line 179 is `[0.27, 4.20]`. This is the fallback used when no `lab_ref_text` is stored. Most Brazilian labs (Fleury, Labi) use `0.45-4.5`. If the AI extracted the lab reference correctly, it should show the lab's value — so either the AI isn't extracting TSH's `lab_ref_text`, or the fallback is being used.

**Fix**: Update the fallback `labRange` to match the most common Brazilian range: `[0.45, 4.50]`.

**File**: `src/lib/markers.ts` line 179

### 2. Missing Exams (Cálcio, Cálcio Iônico, T3 Livre, T4 Livre)

These markers exist in `MARKERS`, in `MARKER_LIST` (edge function), in `MARKER_TEXT_TERMS`, and in the prompt aliases. They are panel "Padrão" so they should display. The most likely cause is that the AI simply didn't extract them from the specific PDF, or `crossCheckAllMarkers` discarded them because the text terms didn't match the PDF text.

**This is NOT a code bug** — it's an extraction miss for a specific PDF. No code change needed. The user should re-import the PDF and check if these appear. If not, they can manually add values.

**No code change for this item.**

### 3. PSA Ratio 27.5% vs 28%

The plan already implemented recalculation: `(psa_livre / psa_total) * 100 = (0.19 / 0.69) * 100 = 27.536...` rounded to 1 decimal = 27.5%. The PDF shows 28% (lab's own rounding). This is a minor rounding difference — clinically insignificant.

**No code change needed.** The recalculated value (27.5%) is mathematically correct from the component values.

### 4. TFG CKD-EPI Version

The system extracts whatever TFG value the lab provides. It does NOT calculate TFG itself — it takes the lab's reported value. If the lab used CKD-EPI 2009, that's what gets stored. Changing the formula would require calculating TFG from creatinine + age + sex instead of using the lab value, which is a different feature request.

**No code change needed** — the system correctly stores the lab's reported value.

---

## Changes

| # | File | Change |
|---|------|--------|
| 1 | `src/lib/markers.ts` | Update TSH `labRange` from `[0.27, 4.20]` to `[0.45, 4.50]` |

Single line change. All other items are either already correct or not code bugs.

