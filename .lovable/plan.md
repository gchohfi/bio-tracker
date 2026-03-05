

## Plano: Adicionar instrução de disambiguação Transferrina vs Saturação no prompt

### Alteração única

**Arquivo**: `supabase/functions/extract-lab-results/index.ts`

Após a linha 515 (mapeamento de `sat_transferrina`), inserir a seguinte instrução:

```
   ⚠️ ATENÇÃO para Transferrina vs Saturação de Transferrina: Transferrina é medida em mg/dL (valores normais 200-360). Saturação de Transferrina é medida em % (valores normais 15-50%). Se o valor extraído para 'transferrina' for menor que 50, provavelmente é a Saturação de Transferrina e deve ir no campo 'sat_transferrina' em vez de 'transferrina'.
```

Isso complementa o sanity fix existente na linha 876 (`transferrina: { min: 100, fix: v < 100 ? v * 10 : v }`) com uma instrução direta no prompt para que a IA já classifique corretamente na extração, evitando que o fix precise disparar.

Nenhuma outra alteração no arquivo. Deploy da edge function após a edição.

