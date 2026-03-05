

## Bug Found: `formatRefDisplay` threshold 900 breaks real markers

The change from `99999` to `900` (applied in CORREÇÃO 5) introduced a regression. Many markers have legitimate max values >= 900 that would now incorrectly display as `> min`:

| Marker | labRange max | Would display | Should display |
|--------|-------------|---------------|----------------|
| Leucócitos | 11000 | "> 3600" ❌ | "3600–11000" |
| Neutrófilos | 4770 | "> 1590" ❌ | "1590–4770" |
| Linfócitos | 2950 | "> 1120" ❌ | "1120–2950" |
| Hemácias urina quant | 23000 | "> 0" ❌ | "< 23000" |

**Placeholder values to catch**: `999`, `9999`, `999999` — all are repeating-9 patterns.

### Fix: Replace threshold with explicit sentinel detection

Instead of a numeric threshold, check if the value matches a "repeating 9s" pattern:

**File**: `src/lib/markers.ts`, lines 898-899

**From**:
```typescript
if ((mn === 0 || mn == null) && mx != null && mx < 900) return `< ${mx}`;
if (mx == null || mx >= 900) return `> ${mn}`;
```

**To**:
```typescript
const isSentinel = (v: number) => /^9+$/.test(String(v));
if ((mn === 0 || mn == null) && mx != null && !isSentinel(mx)) return `< ${mx}`;
if (mx == null || isSentinel(mx)) return `> ${mn}`;
```

This correctly identifies `999`, `9999`, `999999` as placeholders while leaving real values like `11000`, `4770`, `2950` untouched.

**Verification**: Ácido Fólico (9999) → "> 3.9" ✅ | G6PD (999) → "> 6.7" ✅ | Leucócitos (11000) → "3600–11000" ✅ | HDL (999) → "> 40" ✅

