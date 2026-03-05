

## Plano: Fix referências do leucograma absoluto em mil/mm³

### Alteração única

**Arquivo**: `supabase/functions/extract-lab-results/index.ts`

Após a linha 894 (fim do loop de sanity fix), inserir bloco que multiplica `lab_ref_min` e `lab_ref_max` por 1000 quando parecem estar em mil/mm³ (detectado por `lab_ref_max < 20`):

```typescript
// Fix lab references for absolute WBC markers that came in mil/mm³
const absWbcMarkers = new Set(['neutrofilos_abs', 'linfocitos_abs', 'monocitos_abs', 'eosinofilos_abs', 'basofilos_abs']);
for (const r of results) {
  if (!absWbcMarkers.has(r.marker_id)) continue;
  if (typeof r.lab_ref_max === 'number' && r.lab_ref_max < 20) {
    console.log(`[wbc-ref-fix] Multiplying lab_ref for ${r.marker_id}: ${r.lab_ref_min}-${r.lab_ref_max} → ${(r.lab_ref_min || 0) * 1000}-${r.lab_ref_max * 1000}`);
    if (typeof r.lab_ref_min === 'number') r.lab_ref_min = r.lab_ref_min * 1000;
    r.lab_ref_max = r.lab_ref_max * 1000;
  }
}
```

Inserção entre linhas 894 e 896 (antes do comentário `// UNIT_CONVERSIONS removed`). Nenhuma outra alteração.

### Sobre a Transferrina

O fix existente na linha 876 (`v < 100 ? v * 10 : v`) já deveria corrigir 28 → 280. Será necessário reimportar o PDF para verificar se dispara. Se não disparar, o valor 28 pode estar sendo mapeado para `saturacao_transferrina` (28%) em vez de `transferrina` — nesse caso, investigar o mapeamento de aliases.

### Deploy

Após a edição, deploy da edge function `extract-lab-results`.

