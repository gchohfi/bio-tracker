

# Fix: DHEA-S Wrong Age-Specific Reference Range

## Root Cause

The AI extracted `lab_ref_text = "89 a 427"` for DHEA-S, which is the **35-44 years** range. Patient Dener is 31 years old, so the correct range is **160-492** (20-34 years). The patient age IS being sent to the AI (line 2715), and the prompt already instructs age selection (line 635), but the AI picked the wrong bracket.

This is an AI extraction error — not a code bug. The stored value "89 a 427" doesn't contain "anos", so `resolveReference` accepts it as valid.

## Fix (2 parts)

### 1. Strengthen the prompt with an explicit DHEA-S example (line 635)

Add a DHEA-S-specific example to the age-specific instruction since it's the most common marker with age-based ranges in Brazilian labs:

```
⚠️ AGE-SPECIFIC REFERENCE RANGES: ... NEVER return the age range numbers as the reference — return only the value interval.
Example: DHEA-S for a 31-year-old patient with ranges "20 a 34 anos: 160 a 492 / 35 a 44 anos: 89 a 427" → lab_ref_text = "160 a 492" (NOT "89 a 427").
```

**File:** `supabase/functions/extract-lab-results/index.ts`, line 635

### 2. Fix the stored data for this patient

Update the existing DHEA-S record to use the correct reference range for the patient's age.

| # | What | Where |
|---|------|-------|
| 1 | Add DHEA-S age example to prompt | `supabase/functions/extract-lab-results/index.ts` line 635 |
| 2 | Fix stored lab_ref_text/min/max | Database update via insert tool |

