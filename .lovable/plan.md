

## Fix: Clean Contaminated Urine Markers from Database

### Problem

The database contains 4 contaminated records across 2 sessions for this patient (and potentially others). The `urina_hemoglobina` and `urina_hemacias` markers have hemograma values stored in `text_value`:

| Session | Marker | text_value (contaminated) | Should be |
|---------|--------|--------------------------|-----------|
| 2025-11-05 | urina_hemoglobina | `16,3 g/dL 13,3 a 16,5` | deleted |
| 2025-11-05 | urina_hemacias | `5,59 milhões/mm3 4,32 a 5,67` | deleted |
| 2026-02-24 | urina_hemoglobina | `14,9 g/dL 13,3 a 16,5` | deleted |
| 2026-02-24 | urina_hemacias | `5,09 milhões/mm3 4,32 a 5,67` | deleted |

These are legacy records from before the anti-hallucination fix was applied to the edge function. The fix we deployed (fallback validation merge) will prevent new contamination, but existing bad data must be cleaned.

### Plan

1. **SQL migration** to delete all contaminated urine marker records across ALL patients (not just this one), matching the pattern:
   - `urina_hemoglobina` where `text_value` contains `g/dL` or `milhões`
   - `urina_hemacias` where `text_value` contains `milhões` or `mm³` or `g/dL`

```sql
DELETE FROM lab_results
WHERE (
  (marker_id = 'urina_hemoglobina' AND text_value ~ '(g/[dD]?[lL]|milh[õo]es|mm[³3]|µL)')
  OR
  (marker_id = 'urina_hemacias' AND text_value ~ '(milh[õo]es|mm[³3]|µL|g/[dD]?[lL])')
);
```

No code changes needed — the edge function already has the anti-hallucination filters (lines 906-1046) that will catch these patterns on future extractions.

### Files to Change

| Target | Change |
|--------|--------|
| SQL Migration | Delete contaminated urine records |

