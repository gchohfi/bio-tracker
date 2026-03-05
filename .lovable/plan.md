

# Plano: Overrides de Referência para Lipídios/B12/HbA1c + Correção de Data de Coleta

## Alteração 1 — Overrides fixos de referência (edge function)

**Arquivo:** `supabase/functions/extract-lab-results/index.ts`

Adicionar um map `REFERENCE_OVERRIDES` aplicado após `validateAndFixValues`, que sobrescreve `lab_ref_text`, `lab_ref_min`, `lab_ref_max` para marcadores com referências problemáticas:

```typescript
const REFERENCE_OVERRIDES: Record<string, { min: number | null; max: number | null; text: string }> = {
  colesterol_total:   { min: null, max: 190,  text: '< 190 mg/dL' },
  hdl:                { min: 40,   max: null, text: '> 40 mg/dL' },
  ldl:                { min: 100,  max: 129,  text: '100 a 129 mg/dL' },
  colesterol_nao_hdl: { min: null, max: 130,  text: '< 130 mg/dL' },
  triglicerides:      { min: null, max: 150,  text: '< 150 mg/dL' },
  vldl:               { min: null, max: 30,   text: '< 30 mg/dL' },
  vitamina_b12:       { min: 300,  max: null, text: '> 300 pg/mL' },
  hba1c:              { min: null, max: 5.7,  text: '< 5,7%' },
};
```

Loop após validação: para cada resultado, se `marker_id` está no map, sobrescrever os 3 campos.

## Alteração 2 — Corrigir labRange fallback (frontend)

**Arquivo:** `src/lib/markers.ts`

Atualizar `labRange` de 4 marcadores lipídicos para consistência com os overrides:

| Marker | Antes | Depois |
|--------|-------|--------|
| colesterol_total | `[0, 200]` | `[0, 190]` |
| ldl | `[0, 130]` | `[100, 129]` |
| colesterol_nao_hdl | `[0, 160]` | `[0, 130]` |
| vldl | `[5, 40]` | `[0, 30]` |

## Alteração 3 — Correção de extração de data de coleta

**Arquivo:** `supabase/functions/extract-lab-results/index.ts`

### 3a. Reforçar prompt da IA (campo `exam_date` description)

Atualizar a description do campo `exam_date` no schema JSON:
```
"Date the exams were COLLECTED (Data de Coleta / Data da Coleta). 
This is NOT the emission date (Data de Emissão) nor the print date.
Look for labels: 'Data de Coleta', 'Data da Coleta', 'Coletado em', 'Data do Exame'.
ONLY use 'Data de Emissão' or 'Emitido em' as LAST RESORT if no collection date exists.
Format: YYYY-MM-DD. Brazilian dates are DD/MM/YYYY — the FIRST number is the DAY, SECOND is MONTH.
Example: '23/11/2025' in the PDF → return '2025-11-23' (November 23), NEVER '2025-04-23'."
```

### 3b. Reforçar instrução no systemPrompt

Adicionar regra junto à existente sobre DATE FORMAT:
```
DATE EXTRACTION PRIORITY:
1. "Data de Coleta" / "Data da Coleta" / "Coletado em" — USE THIS
2. "Data do Exame" / "Realizado em" — secondary
3. "Data de Emissão" / "Emitido em" — LAST RESORT only
NEVER use "Data de Impressão" or footer dates.
The collection date is typically the EARLIEST date in the report.
```

### 3c. Melhorar regex fallback

No regex fallback (linhas 2948-2963), reordenar os padrões para priorizar "Data de Coleta" e adicionar validação de que mês <= 12:
```typescript
const candidate = `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
const monthNum = parseInt(mm, 10);
const dayNum = parseInt(dd, 10);
if (/^\d{4}-\d{2}-\d{2}$/.test(candidate) && monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
  examDate = candidate;
  break;
}
```

## Resumo

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `extract-lab-results/index.ts` | `REFERENCE_OVERRIDES` map + loop de aplicação |
| 2 | `src/lib/markers.ts` | Corrigir labRange de 4 marcadores lipídicos |
| 3a | `extract-lab-results/index.ts` | Reforçar description do campo `exam_date` |
| 3b | `extract-lab-results/index.ts` | Instrução de prioridade de data no systemPrompt |
| 3c | `extract-lab-results/index.ts` | Validação mês/dia no regex fallback |

Sem alterações em `crossCheckAllMarkers`, sanity fixes ou assinaturas de funções existentes.

