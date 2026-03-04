

## Bug: Regex Fallback Bypasses Anti-Hallucination Filter

### Root Cause

Line 2629 calls `validateAndFixValues(fallbackAdded, patientSex)` but stores the result in `fallbackValidated` — **which is never used**. The contaminated urina markers added by `regexFallback` remain in `validResults` unfiltered.

```text
Pipeline:
  1. AI extraction → validResults
  2. validateAndFixValues(validResults) → removes urina contamination ✓
  3. regexFallback(pdfText, validResults) → RE-ADDS urina_hemoglobina etc. with hemograma values
  4. validateAndFixValues(fallbackAdded) → result stored in `fallbackValidated` but NEVER MERGED BACK
  5. validResults still has contaminated markers → saved to DB ✗
```

### Fix

Replace lines 2624-2632 to properly filter fallback markers through validation and replace them in `validResults`:

```typescript
const fallbackAdded = validResults.filter((r: any) => !beforeFallbackIds.has(r.marker_id));
if (fallbackAdded.length > 0) {
  console.log(`Regex fallback added ${fallbackAdded.length} markers: ${fallbackAdded.map((r: any) => r.marker_id).join(', ')}`);
  // Validate fallback markers (anti-hallucination, sanity checks)
  const fallbackValidated = validateAndFixValues(fallbackAdded, patientSex);
  // Remove unvalidated fallback markers from validResults, add validated ones back
  const fallbackValidatedIds = new Set(fallbackValidated.map((r: any) => r.marker_id));
  validResults = validResults.filter((r: any) => beforeFallbackIds.has(r.marker_id) || fallbackValidatedIds.has(r.marker_id));
  // Replace fallback entries with validated versions
  validResults = validResults.map((r: any) => {
    if (!beforeFallbackIds.has(r.marker_id)) {
      return fallbackValidated.find((fv: any) => fv.marker_id === r.marker_id) || r;
    }
    return r;
  });
  // Re-run derived calculations with full set
  validResults = postProcessResults(validResults);
}
```

### Files to Change

| File | Change |
|------|--------|
| `supabase/functions/extract-lab-results/index.ts` | Fix fallback validation merge (lines 2624-2632) |

This is a one-file fix addressing the exact line where the validated fallback result is discarded.

