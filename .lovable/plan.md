

# Plan: Fix 7 Data Issues for Patient Dener (Session 05/11/2025)

## Current DB State (verified)

Session ID: `2f143fb9-37ff-46bb-83ac-652ddda28703` (2025-11-05), patient `8ec05970`

| Issue | Current in DB | Target |
|-------|--------------|--------|
| Neutrófilos abs | **Missing** (no record) | INSERT 2690 |
| Linfócitos abs | **Missing** | INSERT 4020 |
| Monócitos abs | **Missing** | INSERT 600 |
| Eosinófilos abs | **Missing** | INSERT 150 |
| Basófilos abs | **Missing** | INSERT 20 |
| DHEA-S ref | `89 a 427`, min=89, max=427 | `160 a 492`, min=160, max=492 |
| Vitamina D ref | `> 20`, min=20, max=null | `20 a 100`, min=20, max=100 |
| Testosterona Livre | 13.7 | 13.8 |
| PSA Ratio | 27.5 | 28 (match PDF) |
| TFG | 77 (CKD-EPI 2009) | Needs discussion — CKD-EPI 2021 is a formula change, not a data fix |

## Actions

### 1. Insert 5 missing absolute WBC records
Insert new `lab_results` rows for session `2f143fb9` with the absolute differential values and appropriate references (matching the 02/24 session format).

### 2. Update 4 existing records
- DHEA-S (`bd9de102`): ref → `160 a 492`, min=160, max=492
- Vitamina D (`b1c5bdf3`): ref → `20 a 100`, min=20, max=100
- Testosterona Livre (`29f98bfa`): value → 13.8
- PSA Ratio (`d282f001`): value → 28

### 3. TFG — requires separate decision
CKD-EPI 2021 removes the race coefficient and gives slightly higher values. This would require either:
- A code change to recalculate TFG in post-processing using CKD-EPI 2021
- Or just a manual data fix for this one session

Recommend discussing this separately since it affects future extractions too.

## No code changes — all data fixes via the insert tool.

