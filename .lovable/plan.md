

# Fix: Type Error in `crossCheckAllMarkers` Call

## Problem
`beforeFallbackIds` is inferred as `Set<unknown>` because `validResults.map((r: any) => r.marker_id)` returns `any[]`, and `new Set(any[])` becomes `Set<unknown>`. The function signature expects `Set<string>`.

## Fix
Line 2903 in `supabase/functions/extract-lab-results/index.ts`:
```typescript
// Change:
const beforeFallbackIds = new Set(validResults.map((r: any) => r.marker_id));
// To:
const beforeFallbackIds = new Set<string>(validResults.map((r: any) => r.marker_id));
```

Single line change, no other files affected.

