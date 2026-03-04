

# Plano: Correção dos 5 Bugs do LabTrack (Apresentação Dener)

## Bugs Identificados

| # | Severidade | Descrição |
|---|-----------|-----------|
| 1 | Crítico | Hemoglobina/Hemácias do hemograma sendo associadas ao grupo Urina |
| 2 | Médio | Referências incorretas/ausentes nos marcadores de urina |
| 3 | Médio | Ícones na coluna de referência do relatório PDF |
| 4 | Médio | Sessão de exames duplicada (mesmo paciente, mesma data) |
| 5 | Baixo | Leucócitos (urina) exibidos como numérico sem referência correta |

---

## Correções

### Bug 1 — Hemograma mapeado para Urina

O código em `extract-lab-results/index.ts` (linhas 893-947) já tem anti-alucinação para `urina_hemoglobina` e `urina_hemacias`, mas ela falha quando o Gemini retorna valores do hemograma com unidades corretas de urina (ex: valor=16.3 mas sem "g/dL" no text_value).

**Correção:** Reforçar a anti-alucinação para verificar também `lab_ref_text` e `lab_ref_min/max`:
- `urina_hemoglobina`: se `lab_ref_min/max` formam um range numérico típico de hemograma (ex: 11.7-16.5), remover
- `urina_hemacias`: se `lab_ref_max > 10` (típico hemograma, ref milhões/µL), e valor > 1 milhão-like, remover
- Adicionar validação cruzada: se `hemoglobina` (sangue) já foi extraída com valor similar a `urina_hemoglobina`, remover a urinária

**Arquivo:** `supabase/functions/extract-lab-results/index.ts`

### Bug 2 — Referências de urina ausentes

Os marcadores de urina no `markers.ts` têm `labRange: { M: [0, 0], F: [0, 0] }` para qualitativos, o que resulta em "0–0" ou "—" como referência.

**Correção:** Atualizar `labRange` em `src/lib/markers.ts` com os valores corretos do laudo Fleury:
- `urina_ph`: `[5.0, 8.0]`
- `urina_densidade`: `[1.010, 1.030]`
- `urina_proteinas`: text_ref "< 0,10 g/L" (qualitativo, manter labRange [0,0] mas garantir text)
- `urina_glicose`: text_ref "< 0,3 g/L"
- etc.

Para qualitativos, o `labRange [0,0]` é esperado — o problema é que `lab_ref_text` não está sendo extraído/persistido pelo Gemini. Reforçar o prompt para capturar referências de urina.

**Arquivos:** `src/lib/markers.ts`, `supabase/functions/extract-lab-results/index.ts` (prompt)

### Bug 3 — Ícones na coluna de referência do relatório PDF

No relatório PDF (`generateReport.ts`), a coluna "Ref. Lab." mostra o texto da referência. Se o `labRefStr` contém caracteres especiais ou unicode (como ≤, ≥), o jsPDF pode renderizá-los como ícones/caixas.

**Correção:** Sanitizar o `labRefStr` no `generateReport.ts` (linha ~366-378) para substituir caracteres unicode por equivalentes ASCII:
- `≤` → `<=`
- `≥` → `>=`
- `–` (en-dash) → `-`
- Remover qualquer caractere non-latin1 que jsPDF não suporte

**Arquivo:** `src/lib/generateReport.ts`

### Bug 4 — Sessão duplicada

O fluxo de importação (`PatientDetail.tsx` linhas 383-404) sempre cria uma nova sessão via `insert` quando `editingSessionId` é null. Se o usuário importa dois PDFs na mesma data, duas sessões são criadas.

**Correção:** Antes de criar uma nova sessão, verificar se já existe uma sessão para o mesmo `patient_id` + `session_date`. Se existir, reutilizar (merge dos resultados) em vez de criar duplicata.

**Arquivo:** `src/pages/PatientDetail.tsx`

### Bug 5 — Leucócitos (urina) sem referência

O marcador `urina_leucocitos` está marcado como `qualitative: true` com `labRange: [0, 5]`. O Gemini pode extrair o valor quantitativo (/mL do sedimento) e mapear para o qualitativo, perdendo a referência.

**Correção:** 
- Garantir que `urina_leucocitos_quant` (numérico, /mL) tenha `labRange: [0, 10000]` (já está correto)
- No prompt, reforçar que leucócitos em /mL vão para `urina_leucocitos_quant`, e "Leucócito Esterase" qualitativo vai para `urina_leucocitos`
- Verificar que a referência "< 25.000 /mL" do Fleury é capturada no `lab_ref_text`

**Arquivos:** `supabase/functions/extract-lab-results/index.ts`, `src/lib/markers.ts`

---

## Resumo de Arquivos

| Arquivo | Bugs |
|---------|------|
| `supabase/functions/extract-lab-results/index.ts` | 1, 2, 5 |
| `src/lib/markers.ts` | 2, 5 |
| `src/lib/generateReport.ts` | 3 |
| `src/pages/PatientDetail.tsx` | 4 |

