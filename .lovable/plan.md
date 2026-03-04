

# Fix: Phantom Value Hallucination — Cross-validation Against PDF Text

## Problem

The AI (Gemini) fabricates values for markers not present in the PDF. The prompt says "Target: 95+ markers. Be EXHAUSTIVE" which pressures the model to fill gaps by grabbing unrelated numbers from the PDF text. This is clinically dangerous.

Currently, only toxicology markers (7 markers) have a cross-check against the PDF text. The other ~160 markers are accepted blindly.

## Solution: 3-Layer Fix

### 1. Add Global Cross-Validation (`crossCheckAllMarkers`)

After `validateAndFixValues` and before `validateExtraction`, add a new function that checks whether each AI-extracted marker's name actually appears in the PDF text.

- Build a `MARKER_TEXT_TERMS` map with search terms for every marker, derived from the existing alias lists in the prompt (e.g., `ck → ["ck ", "ck total", "creatinoquinase", "cpk"]`, `ureia → ["ureia", "uréia", "bun"]`, `sodio → ["sódio", "sodio", "na+"]`)
- For each AI result, check if at least one term for that `marker_id` exists in `pdfTextLower`
- If not found → discard with log: `CROSS-CHECK: discarding {marker_id} — not found in PDF text`
- **Exempt** from cross-check:
  - Calculated markers (bilirrubina_indireta, colesterol_nao_hdl, relacao_ct_hdl, relacao_tg_hdl, relacao_apob_apoa1, homa_ir, neutrofilos, fixacao_latente_ferro, urina_acr, glicemia_media_estimada)
  - Markers added by `regexFallback` (they already matched text patterns)
  - Toxicology markers (already have their own cross-check)

The function receives `pdfText` and runs after the AI results are filtered but before structural validation.

### 2. Reduce Prompt Hallucination Pressure

In the user message (line 2514):
- **Remove**: `"Target: 95+ markers. Be EXHAUSTIVE — do not skip ANY marker."`
- **Replace with**: `"Extract ONLY markers that are EXPLICITLY PRESENT in this document with a clear result value. Do NOT guess or infer values for markers not shown."`

In the "COMMONLY MISSED" section (lines 2530-2550):
- **Remove**: The entire "COMMONLY MISSED — search EXPLICITLY for each of these" block. This list pressures the AI to find markers that may not exist.
- **Replace with**: A shorter note: `"Check all sections of the document including panels (Hemograma, Lipídios, etc.) and standalone exams. Only extract markers you can actually see."`

### 3. Strengthen Anti-Hallucination Rule in System Prompt

Add to the system prompt (after line 229):
```
CRITICAL: It is MUCH BETTER to miss a real result than to fabricate a phantom value.
If a test was NOT ordered or NOT performed, it will NOT appear in the PDF — do NOT extract it.
Do NOT extract a marker just because it is in the known list — only extract if you see the actual test name AND its result value printed in the document.
```

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/extract-lab-results/index.ts` | Add `MARKER_TEXT_TERMS` map (~170 entries), add `crossCheckAllMarkers()` function, update prompt text, strengthen anti-hallucination rule |

## Integration Point

In the main `serve()` handler, insert the cross-check call at line ~2677 (after `convertLabRefUnits`, before `validateExtraction`):

```
validResults = crossCheckAllMarkers(validResults, pdfText, beforeFallbackIds);
```

The `beforeFallbackIds` set is passed so regex-fallback markers are exempt.

## Risk Mitigation

- Comprehensive alias list minimizes false negatives (legitimate markers being discarded)
- Calculated markers are exempt since they don't appear as test names in PDFs
- Regex fallback markers are exempt since they already matched text patterns
- Logs every discard for debugging

