

# Plan: Fix Reference Operator Display, Remove Unit Conversions, Reinforce Date Extraction

## 3 Changes

### 1. Reference Operator Display (EvolutionTable + PDF)

**Root cause**: When `resolveReference` returns `operator: 'range'` with `min=0, max=190`, the display shows "0–190" instead of "< 190". Even when operator is `<`, if the sanity check rejects it and falls back to `labRange`, the operator is lost.

**Fix**: Add smart one-sided range detection in both display locations. Create a shared helper:

```typescript
// src/lib/markers.ts — new export
export function formatRefDisplay(
  ref: { min: number | null; max: number | null; operator: string },
  fallbackMin: number,
  fallbackMax: number,
): string {
  const { operator, min: rMin, max: rMax } = ref;
  // Explicit operators
  if ((operator === '<' || operator === '<=') && rMax != null) return `${operator} ${rMax}`;
  if ((operator === '>' || operator === '>=') && rMin != null) return `${operator} ${rMin}`;
  // Detect one-sided ranges even when operator is 'range'
  const mn = rMin ?? fallbackMin;
  const mx = rMax ?? fallbackMax;
  if ((mn === 0 || mn === null) && mx != null && mx < 999) return `< ${mx}`;
  if (mx >= 999) return `> ${mn}`;
  return `${mn}–${mx}`;
}
```

**Files**:
- `src/lib/markers.ts`: Add `formatRefDisplay` export
- `src/components/EvolutionTable.tsx` (lines 392-403): Replace IIFE with `formatRefDisplay(resolvedRef, min, max)`
- `src/lib/generateReport.ts` (lines 371-383): Replace IIFE with `sanitizeForPdf(formatRefDisplay(displayRef, min, max))`

### 2. Remove Unit Conversions

Remove ALL conversion logic so values are stored exactly as the lab reports them.

**Edge function** (`supabase/functions/extract-lab-results/index.ts`):
- **Remove** the `UNIT_CONVERSIONS` block (lines 868-893) — deterministic conversion of estradiol, progesterona, DHT
- **Remove** conversion instructions from the AI prompt (lines 386-417) — e.g., "If ng/dL multiply by 10 to get pg/mL", "If pmol/L divide by 34.7"
- **Remove** sanity fix entries that perform unit conversion (lines 749-770): progesterona `v/100`, estradiol `v*10`, DHT `v*10`, estrona `v*10`, testosterona_livre pmol conversion, t3_livre `v/10`, igfbp3 `v/1000`
- **Remove** `convertLabRefUnits` function (lines 1132-1200+) and its call
- **Keep** sanity fixes that fix decimal errors (e.g., acido_urico decimal fix, leucocitos x1000) — these are NOT unit conversions
- **Update** prompt to say: "Return the value EXACTLY as printed in the lab report. Do NOT convert units. Use the original unit from the report."

**Frontend** (`src/lib/markers.ts`):
- Update `labRange` and `unit` for affected markers to match common Brazilian lab units (the ones the user's labs actually report). Since we're no longer converting, the labRange must match the source unit.

### 3. Date Extraction Reinforcement

The prompt was already updated but the AI still extracts wrong dates.

**Edge function**: Add an even stronger instruction at the TOP of the systemPrompt (not buried in the middle):
```
CRITICAL RULE #1 — DATE:
The exam_date MUST be the COLLECTION DATE ("Data de Coleta" / "Data da Coleta" / "Coletado em").
NEVER use "Data de Emissão", "Emitido em", "Data de Liberação", "Liberado em", or "Data de Impressão".
Brazilian format: DD/MM/YYYY. Day is FIRST, month is SECOND.
Example: "23/11/2025" → return "2025-11-23" (November 23). NEVER "2025-04-23".
```

Also make the regex fallback override the AI result when it finds a "Data de Coleta" match, even if the AI already returned a date.

---

### Files changed

| # | File | Change |
|---|------|--------|
| 1 | `src/lib/markers.ts` | Add `formatRefDisplay` helper; update labRange/unit for converted markers |
| 2 | `src/components/EvolutionTable.tsx` | Use `formatRefDisplay` for ref column |
| 3 | `src/lib/generateReport.ts` | Use `formatRefDisplay` for PDF ref column |
| 4 | `supabase/functions/extract-lab-results/index.ts` | Remove UNIT_CONVERSIONS, remove conversion sanity fixes, remove convertLabRefUnits, update prompt to preserve original units, reinforce date extraction |

