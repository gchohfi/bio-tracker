

# Plan: Date Extraction Fix, Sanity Fixes for Zinc/Free Testosterone, Hematology References

## 3 Surgical Changes

### 1. Date Extraction — Force high-confidence regex to ALWAYS override AI date

**File:** `supabase/functions/extract-lab-results/index.ts` (lines 2894-2914)

**Problem:** The current logic only overrides when `highConfidence && examDate !== candidate`. But the `break` on line 2911 exits the loop after the FIRST pattern match — even if it's a low-confidence one. If pattern 3 or 4 matches first (unlikely but possible), or if the AI date is simply wrong and the high-confidence regex finds the same wrong date, no override happens.

**Real root cause:** The regex loop works correctly in theory. The actual problem is likely that the AI extracts `2025-04-23` (swapping month/day from `23/11/2025`), and the high-confidence regex DOES match `23/11/2025` and produces `2025-11-23`, but the `break` after a non-high-confidence match prevents reaching it.

**Fix:** Restructure the loop to process HIGH-CONFIDENCE patterns FIRST, separately. If any high-confidence pattern matches, use it unconditionally (ignoring AI date entirely). Only fall back to AI date + lower-priority patterns if no high-confidence match exists.

```typescript
// Step 1: Try high-confidence "Data de Coleta" patterns FIRST
const highConfPatterns = [
  /(?:Data\s+d[aeo]\s+[Cc]olet[ao]|Colet(?:a|ado)\s*(?:em)?)[:\s]*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i,
];
for (const pat of highConfPatterns) {
  const m = pdfText.match(pat);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    const monthNum = parseInt(mm, 10);
    const dayNum = parseInt(dd, 10);
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      const candidate = `${year}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
      console.log(`[DATE] High-confidence "Data de Coleta": ${candidate} (overrides AI: ${examDate})`);
      examDate = candidate;
      break; // Found collection date, done
    }
    // If month > 12, try swapping day/month
    if (dayNum >= 1 && dayNum <= 12 && monthNum >= 1 && monthNum <= 31) {
      const candidate = `${year}-${dd.padStart(2,"0")}-${mm.padStart(2,"0")}`;
      console.log(`[DATE] High-confidence SWAPPED d/m: ${candidate}`);
      examDate = candidate;
      break;
    }
  }
}
// Step 2: Only if no high-confidence match, fall back to AI date + lower patterns
if (!examDate) { /* existing lower-priority patterns */ }
```

### 2. Sanity Fixes — Add zinc and testosterona_livre

**File:** `supabase/functions/extract-lab-results/index.ts` (lines 773-774 for zinc, add new entry for testosterona_livre)

**Zinc** (line 774): Change from no fix to:
```typescript
zinco: { min: 30, max: 200, fix: (v) => v < 10 ? v * 100 : v, label: "zinco decimal fix" },
```
- 0.9 → `0.9 < 10` → `× 100` = 90 ✓

**Testosterona Livre**: Add new entry after existing hormones:
```typescript
testosterona_livre: { min: 0.5, max: 100, fix: (v) => v > 1000 ? v / 100 : v > 100 ? v / 10 : v, label: "testosterona_livre decimal fix" },
```
- 477 → `477 > 100` → `/ 10` = 47.7. If still > 100, `/10` again. The fix function runs once, so use cascading: `v > 1000 ? v/100 : v > 100 ? v/10 : v`

### 3. Hematology Reference Display — Fix formatRefDisplay threshold

**File:** `src/lib/markers.ts` (line 881)

**Problem:** `mx >= 999` triggers `> {mn}` for ANY marker with max ≥ 999. Leucocitos has labRange `[4000, 11000]`, so it shows `> 4000` instead of `4000–11000`. Same for neutrofilos `[1590, 4770]` — actually 4770 > 999 so shows `> 1590`. Linfocitos `[1120, 2950]` → shows `> 1120`.

**Fix:** Raise the threshold to detect truly "unbounded" maxes. Use a sentinel-like check: only treat as `> min` when max is a round sentinel (9999, 99999) or when max is null. Real ranges like 11000, 4770, 2950 should display as ranges.

```typescript
// Replace line 881:
if (mx != null && mx >= 999) return `> ${mn}`;
// With:
if (mx != null && (mx === 9999 || mx === 99999 || mx >= 100000)) return `> ${mn}`;
if (mx == null) return `> ${mn}`;
```

This way:
- `[4000, 11000]` → `4000–11000` ✓ (11000 is not a sentinel)
- `[40, 9999]` HDL sentinel → `> 40` ✓
- `[300, 9999]` B12 sentinel → `> 300` ✓
- `[0, 190]` → `< 190` ✓ (caught by the `mn === 0` check on line 880)

**But wait** — checking markers.ts: HDL has `labRange: [40, 150]`, not `[40, 9999]`. The REFERENCE_OVERRIDES set `max: null` for HDL. So `resolveReference` would return `max: null` with operator `>`. The explicit operator check on line 876 handles that. The sentinel check is only needed as a safety net.

Better approach: just raise threshold to 99999 or use null check only:
```typescript
if (mx == null || mx >= 99999) return `> ${mn}`;
```

---

### Files changed

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/extract-lab-results/index.ts` | Restructure date regex to prioritize high-confidence patterns unconditionally |
| 2 | `supabase/functions/extract-lab-results/index.ts` | Add sanity fix for `zinco` (×100 if <10) and `testosterona_livre` (/10 if >100) |
| 3 | `src/lib/markers.ts` | Fix `formatRefDisplay` threshold: `mx >= 999` → `mx >= 99999` to not break hematology ranges |

