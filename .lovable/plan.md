

# Plan: Fix Missing Marker Extraction (Cálcio, T3/T4 Livre)

## Root Cause

All 4 markers exist in MARKER_LIST, the prompt, and the frontend. The problem is in **MARKER_TEXT_TERMS aliases** — the crossCheck validation discards them because the PDF text doesn't match any listed alias.

### Specific bugs found:

1. **`calcio_ionico`** (line 2475): Has `'cálcio iónizado'` — typo with accent `ó`. Should be `'cálcio ionizado'`. Also missing unaccented `'calcio ionizado'`.

2. **`calcio_total`** (line 2474): Only has `'cálcio total'`, `'calcio total'`, `'cálcio sérico'`, `'calcio serico'`, `'ca total'`. Fleury often labels it just `"CÁLCIO"` or `"CÁLCIO, SORO"` — none of these match just `"cálcio"` as a substring. Missing standalone `'cálcio'` and `'calcio'`.

3. **`t4_livre`** (line 2411): Has `'t4 livre'`, `'tiroxina livre'`, `'t4l'`, `'ft4'`. Fleury uses `"TIROXINA (T4) LIVRE"` — lowercased: `"tiroxina (t4) livre"`. The substring `"t4 livre"` does NOT appear in `"tiroxina (t4) livre"` (there's `") "` between t4 and livre). And `"tiroxina livre"` doesn't match either (there's `"(t4) "` in between). So crossCheck discards it.

4. **`t3_livre`** (line 2413): Same pattern — Fleury uses `"TRIIODOTIRONINA (T3) LIVRE"`. The substring `"t3 livre"` doesn't appear in `"triiodotironina (t3) livre"`.

## Fix

Single file change: add missing aliases to MARKER_TEXT_TERMS.

**File:** `supabase/functions/extract-lab-results/index.ts`

| Marker | Line | Aliases to add |
|--------|------|----------------|
| `t4_livre` | 2411 | `'tiroxina (t4) livre'`, `'tiroxina(t4) livre'` |
| `t3_livre` | 2413 | `'triiodotironina (t3) livre'`, `'triiodotironina(t3) livre'` |
| `calcio_total` | 2474 | `'cálcio'`, `'calcio'` |
| `calcio_ionico` | 2475 | Fix `'cálcio iónizado'` → `'cálcio ionizado'`, add `'calcio ionizado'` |

No other changes. No crossCheckAllMarkers logic changes.

