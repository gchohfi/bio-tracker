

# Diagnóstico Completo: Bugs no Relatório do Dener (novo laudo fev/2026)

## Bugs Identificados

### Bug 1 — Referências qualitativas de Urina ausentes (PDF + Dashboard)
Tanto no PDF (`generateReport.ts` linha 366) quanto no dashboard (`EvolutionTable.tsx` linha 386-387), marcadores qualitativos mostram `"—"` na coluna Ref. Lab. em vez de exibir a referência qualitativa do laudo (ex: "negativa", "límpido", "ausentes").

**Dados no banco**: `urina_nitritos` tem `lab_ref_text: "negativa"`, `urina_aspecto` tem `lab_ref_text: "límpido"`, `urina_cetona` tem `lab_ref_text: "< 5"`, etc. Esses valores existem mas são descartados na exibição.

**Fix**: Para marcadores qualitativos, exibir o `lab_ref_text` quando disponível em vez de `"—"`.

### Bug 2 — TSH sem referência extraída
O PDF do lab diz `"20 - 59 a: 0,45 a 4,5 mUI/L"`. A extração da IA retornou `lab_ref_text: ""` (vazio). O `parseLabRefRanges` no backend deveria ter tratado isso, mas a IA não passou o texto.

**Causa raiz**: A IA não extraiu o `lab_ref_text` do TSH. O texto do PDF contém a referência claramente. Isso é um problema na extração da IA, não no parser.

### Bug 3 — TGO sem referência extraída
O PDF diz `"maior que 2 anos: até 40 U/L"`. A IA retornou `lab_ref_text: ""`. Deveria ter extraído.

### Bug 4 — Plaquetas sem referência
O PDF diz `"151.000 a 304.000/mm3"`. A IA retornou `lab_ref_text: ""` e value=168 (correto). A referência deveria ter sido capturada.

### Bug 5 — CK (Creatinoquinase) não extraída
O PDF contém `CK: 190 U/L, ref: 38-174`. Não aparece nos resultados da extração. O marcador `ck` provavelmente não existe em markers.ts.

### Bug 6 — Linfócitos absolutos extraído mas com hallucination flag removido
`urina_hemoglobina` e `urina_hemacias` com `_remove: true` — estes estão sendo filtrados corretamente (cleanup funciona). Porém, os dados removidos (`text_value: "14,9 g/dL 13,3 a 16,5"` e `"5,09 milhões/mm3 4,32 a 5,67"`) **ainda estão sendo inseridos no banco** (veja o POST request — `_remove` não é filtrado antes do insert).

## Correções Propostas

### Fix 1 — Exibir referências qualitativas de urina
**Arquivos**: `src/lib/generateReport.ts`, `src/components/EvolutionTable.tsx`

- No PDF (linha 366): mudar de `isQualitative ? "—"` para verificar `labRef?.text` e exibir quando disponível
- No dashboard (linha 386-387): mesmo tratamento — exibir `labRefText` para qualitativos quando disponível

### Fix 2 — Filtrar resultados com `_remove: true` antes de inserir no banco
**Arquivo**: `src/pages/PatientDetail.tsx` ou onde o insert acontece (provavelmente `ImportVerification.tsx`)

- Antes do upsert no Supabase, filtrar `results.filter(r => !r._remove)`

### Fix 3 — Adicionar marcador CK (Creatinoquinase Total) a markers.ts
**Arquivo**: `src/lib/markers.ts`

- Adicionar `{ id: "ck", name: "CK Total", unit: "U/L", category: "Hepático", labRange: { M: [38, 174], F: [26, 140] } }`
- Atualizar extração para mapear "CREATINOQUINASE TOTAL" → `ck`

### Fix 4 — Melhorar prompt/fallback para TSH, TGO e Plaquetas com refs vazias
**Arquivo**: `supabase/functions/extract-lab-results/index.ts`

- Adicionar regex fallback para estes marcadores quando a IA retorna ref vazia
- Ou: no `parseLabRefRanges`, tratar "maior que X anos: até Y" quando a IA passa o texto completo

### Fix 5 — Testes unitários
- Teste para referências qualitativas na geração do PDF
- Teste para filtro de `_remove` antes do insert

## Prioridades
1. **Fix 1** (referências qualitativas urina) — impacto visual direto, relatório clínico
2. **Fix 2** (filtrar `_remove`) — integridade de dados
3. **Fix 3** (CK) — marcador clínico faltante
4. **Fix 4** (refs vazias TSH/TGO/Plaquetas) — requer ajuste na extração

## Resumo de Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/generateReport.ts` | Exibir lab_ref_text para qualitativos |
| `src/components/EvolutionTable.tsx` | Exibir lab_ref_text para qualitativos |
| `src/lib/markers.ts` | Adicionar marcador CK |
| `src/pages/PatientDetail.tsx` ou `ImportVerification.tsx` | Filtrar `_remove` antes do insert |
| `supabase/functions/extract-lab-results/index.ts` | Regex fallback para refs vazias |

