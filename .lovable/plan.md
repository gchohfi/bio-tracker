

# Plan: 4 Bug Fixes + Date/Sanity/Reference Corrections

## Summary of Changes

7 surgical edits across 2 files. No changes to `crossCheckAllMarkers`.

---

## 1. PSA Ratio — Fix fractional extraction (BUG 1)

**File:** `supabase/functions/extract-lab-results/index.ts` (lines 1427-1437)

**Problem:** When the AI extracts `psa_ratio` directly as 0.28 (fraction instead of %), `postProcessResults` skips calculation because `resultMap.has("psa_ratio")` is true. The value stays as 0.28.

**Fix:** After building `resultMap`, add a check: if `psa_ratio` exists AND its value is < 1.0, it was extracted as a fraction — RECALCULATE from `psa_livre / psa_total * 100`. If those aren't available, multiply by 100.

```typescript
// Fix psa_ratio extracted as fraction (e.g. 0.28 instead of 27.5%)
if (resultMap.has("psa_ratio")) {
  const existing = resultMap.get("psa_ratio");
  if (typeof existing.value === "number" && existing.value < 1.0 && existing.value > 0) {
    if (resultMap.has("psa_livre") && resultMap.has("psa_total")) {
      const psaL = resultMap.get("psa_livre").value;
      const psaT = resultMap.get("psa_total").value;
      if (typeof psaL === "number" && typeof psaT === "number" && psaT > 0) {
        existing.value = Math.round((psaL / psaT) * 100 * 10) / 10;
        console.log(`[PSA] Recalculated psa_ratio from fraction: ${existing.value}%`);
      }
    } else {
      existing.value = Math.round(existing.value * 100 * 10) / 10;
      console.log(`[PSA] Converted psa_ratio from fraction: ${existing.value}%`);
    }
  }
}
```

Insert this block right after `resultMap` is built (before the existing `if (!resultMap.has("psa_ratio"))` block).

---

## 2. Testosterona Livre — pmol/L conversion (BUG 2)

**File:** `supabase/functions/extract-lab-results/index.ts`

**a) Prompt change** (line 399): Replace "do NOT convert" with conversion instruction:
```
→ testosterona_livre (unit: ng/dL). CRITICAL: If the lab value is in pmol/L, DIVIDE by 34.7 to convert to ng/dL. Example: 477 pmol/L ÷ 34.7 = 13.7 ng/dL. Do NOT store pmol/L values.
```

**b) Sanity fix** (line 774): Update the existing entry to handle pmol/L:
```typescript
testosterona_livre: { min: 0.5, max: 50, fix: (v: number, unit?: string) => {
  if (unit && /pmol/i.test(unit)) return Math.round((v / 34.7) * 100) / 100;
  if (v > 100) return Math.round((v / 34.7) * 100) / 100; // likely pmol/L
  return v;
}, label: "testosterona_livre pmol→ng/dL" },
```

Need to check if `validateAndFixValues` passes unit to fix functions. Let me check the call signature.

**c) Update `validateAndFixValues`** to pass `unit` from the result to the fix function. Currently the fix function signature is `(v: number) => number`. Need to extend to support `(v: number, unit?: string) => number` and pass `r.unit` when calling fix.

---

## 3. Estradiol — ng/dL → pg/mL conversion (BUG 3)

**File:** `supabase/functions/extract-lab-results/index.ts`

**a) Prompt change** (line 403): Replace "do NOT convert" with:
```
→ estradiol (unit: pg/mL). CRITICAL: If the lab value is in ng/dL, MULTIPLY by 10 to convert to pg/mL. Example: 2.7 ng/dL × 10 = 27 pg/mL. Do NOT store ng/dL values.
```

**b) Add sanity fix** for estradiol:
```typescript
estradiol: { min: 5, max: 500, fix: (v: number, unit?: string) => {
  if (unit && /ng\/d/i.test(unit)) return Math.round(v * 10 * 100) / 100;
  if (v < 5) return Math.round(v * 10 * 100) / 100; // likely ng/dL for male
  return v;
}, label: "estradiol ng/dL→pg/mL" },
```

---

## 4. Zinco — µg/mL → µg/dL conversion (BUG 4)

**File:** `supabase/functions/extract-lab-results/index.ts`

**a) Prompt change** (line 96 area or in the MARKER_LIST prompt section): Add conversion instruction to zinco. In the prompt section for Zinco (currently just has the marker listed), add:
```
→ zinco (unit: µg/dL). CRITICAL: If the lab value is in µg/mL, MULTIPLY by 100 to convert to µg/dL. Example: 0.9 µg/mL × 100 = 90 µg/dL.
```

**b) Sanity fix** already exists at line 773 (`v < 10 ? v * 100 : v`). Enhance to also check unit:
```typescript
zinco: { min: 30, max: 200, fix: (v: number, unit?: string) => {
  if (unit && /ug\/m[lL]|µg\/m[lL]/i.test(unit)) return Math.round(v * 100 * 100) / 100;
  if (v < 10) return v * 100;
  return v;
}, label: "zinco µg/mL→µg/dL" },
```

---

## 5. validateAndFixValues — Pass unit to fix functions

**File:** `supabase/functions/extract-lab-results/index.ts` (inside `validateAndFixValues`)

Currently the fix function is called as `fix(v)`. Need to also pass `r.unit` (the unit extracted by the AI):

Find the line where `fix` is called and change to `fix(v, r.unit)`.

Update the type signature:
```typescript
const sanityRanges: Record<string, { min: number; max: number; fix?: (v: number, unit?: string) => number; label?: string }> = {
```

---

## 6. Date extraction — already implemented

The high-confidence regex is already in place (lines 2882-2911). No additional changes needed for date.

---

## 7. Hematology references — already fixed

`formatRefDisplay` threshold already raised to 99999 (line 881). No changes needed.

---

### Files changed

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/extract-lab-results/index.ts` | Fix PSA ratio fraction in postProcessResults |
| 2 | `supabase/functions/extract-lab-results/index.ts` | Add conversion instructions to prompt for testosterona_livre, estradiol, zinco |
| 3 | `supabase/functions/extract-lab-results/index.ts` | Update sanity fixes with unit-aware conversions |
| 4 | `supabase/functions/extract-lab-results/index.ts` | Pass unit to fix() in validateAndFixValues |

