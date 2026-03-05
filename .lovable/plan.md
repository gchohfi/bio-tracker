

## Correção de 2 Bugs: Amilase Status + Hemácias Urina Duplicadas

### Bug 1 — Amilase 102 com ref 28-100 mostrando Normal

**Investigação**: Tracei toda a cadeia de cálculo de status (`resolveReference` → `getMarkerStatusFromRef`) e a lógica parece correta: 102 > 100 deveria retornar 'high'. O `parseLabReference("28 a 100")` retorna corretamente `{min: 28, max: 100, operator: 'range'}` e o sanity check passa.

**Causa provável**: O problema pode estar na view que o usuário está vendo (há 3 caminhos distintos de cálculo de status: `EvolutionTable`, `PatientDetail`, `EditReportDialog` e `generateReport`). Cada um chama `getMarkerStatus` ou `getMarkerStatusFromRef` de forma ligeiramente diferente. Vou unificar e adicionar proteção.

**Correções**:
1. Em `EvolutionTable.tsx`: a função `getStatusWithOperator` (linha 123) recebe o valor do `resultMap` que usa `r.value ?? 0`. Se por algum motivo `r.value` é `null` e o valor real está em `text_value`, o status é calculado com 0 (que está dentro do range 28-100 → normal). Vou adicionar fallback para parsear `text_value` quando `val === 0` e text_value contém um número.
2. Garantir que `getMarkerStatusFromRef` para operator `'range'` usa comparação estrita: `value > max → high`, `value < min → low`. (Já está assim, mas vou adicionar testes específicos para amilase).
3. Adicionar teste unitário para amilase 102 vs ref 28-100.

### Bug 2 — Hemácias urina duplicadas

**Causa confirmada via banco**: Ambos `urina_hemacias` e `urina_hemacias_quant` estão sendo salvos. Dados no banco mostram:
- `urina_hemacias`: value=0, text_value="23.500 /mL", lab_ref_text="Até 23.000 /mL" 
- `urina_hemacias_quant`: value=23500, lab_ref_text="Até 23.000 /mL"

O `urina_hemacias` é qualitativo (deveria ter texto como "Raras"/"Ausentes"), mas recebeu valor quantitativo "23.500 /mL". O cross-dedup no edge function (linha 753-767) deveria remover o qualitativo quando ambos existem, mas aparentemente não está funcionando para todos os casos.

**Correções**:
1. Em `supabase/functions/extract-lab-results/index.ts`: fortalecer o `QUALITATIVE_TO_QUANT_MAP` redirect (linha 1098-1104) para garantir que quando `urina_hemacias` recebe um valor numérico (ex: "23.500 /mL"), ele é convertido para `urina_hemacias_quant` com o valor numérico parseado.
2. Melhorar o cross-dedup para também comparar quando o qualitativo tem `value=0` mas `text_value` contém número (indicando que foi mapeado incorretamente).
3. No frontend (`EvolutionTable.tsx`): adicionar dedup client-side como safety net — se ambos `urina_hemacias` e `urina_hemacias_quant` existem na mesma sessão, esconder o qualitativo.

### Arquivos a alterar

| Arquivo | Alteração |
|---|---|
| `supabase/functions/extract-lab-results/index.ts` | Fortalecer cross-dedup e QUALITATIVE_TO_QUANT_MAP para hemácias urina |
| `src/components/EvolutionTable.tsx` | Dedup client-side + fallback de valor para text_value quando value=0 |
| `src/test/markers.test.ts` | Adicionar teste para amilase 102 vs 28-100 |

### Sem migração necessária
Os dados existentes de hemácias duplicadas serão resolvidos na próxima importação. A dedup client-side garante que não apareçam duplicados imediatamente.

