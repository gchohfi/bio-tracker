

# Plano: Fix Testosterona Livre — conversão sex-aware

## Problema

A função `validateAndFixValues` no backend não recebe o sexo do paciente. O fix de `testosterona_livre` tem um buraco: valores entre 3.0 e 25.0 ng/dL não são convertidos porque podem ser válidos para homens. Mas para mulheres, valores como 5.73 e 15.3 são claramente pmol/L (15.3 pmol/L ÷ 34.7 = 0.441 ng/dL, 5.73 ÷ 34.7 = 0.165 ng/dL).

Dados desta paciente (F):
- 2025-11-10: 15.3 (deveria ser 0.441 ng/dL)
- 2026-02-07: 5.73 (deveria ser 0.165 ng/dL)
- 2026-02-07: 0.57 (correto)

## Correção

### 1. Passar sexo do paciente para a Edge Function

**Frontend** (`src/pages/PatientDetail.tsx`): Enviar o sexo do paciente no body da chamada:
```typescript
body: { pdfText: cleanedText + aliasHint, patientSex: patient.sex }
```

**Backend** (`supabase/functions/extract-lab-results/index.ts`): Extrair `patientSex` do request body.

### 2. Tornar `validateAndFixValues` sex-aware

Alterar a assinatura para receber o sexo: `validateAndFixValues(results, patientSex)`.

Atualizar o fix de `testosterona_livre` para usar lógica sex-aware:
- **Mulheres (F):** valores > 1.0 ng/dL são suspeitos (lab range max feminino é 1.07). Se > 1.0 e ≤ 700 → dividir por 34.7 (pmol/L → ng/dL). Se > 700 → dividir por 1000 (pg/mL → ng/dL).
- **Homens (M) ou desconhecido:** manter a lógica atual (só converter > 25).

### 3. Corrigir dados existentes

Executar um UPDATE no banco para corrigir os 2 valores errados desta paciente:
- 15.3 → 0.4410 (15.3 / 34.7)
- 5.73 → 0.1651 (5.73 / 34.7)

### 4. Deploy

Deploy da edge function `extract-lab-results` atualizada.

## Arquivos a editar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/PatientDetail.tsx` | Enviar `patientSex` no body |
| `supabase/functions/extract-lab-results/index.ts` | Receber `patientSex`, passar para `validateAndFixValues`, fix sex-aware |
| Migration SQL | Corrigir os 2 valores errados no banco |

