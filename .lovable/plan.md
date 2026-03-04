

# Plano: Remover marcador `psa_relacao`

O marcador "PSA Livre/Total (%)" será completamente removido do sistema. A conversão ratio→% tem sido problemática e o marcador não agrega valor clínico suficiente quando PSA Total e PSA Livre já estão presentes.

## Alterações

### 1. `src/lib/markers.ts`
- Remover a entrada `{ id: "psa_relacao", ... }` do array de marcadores (linhas 662-663)

### 2. `supabase/functions/extract-lab-results/index.ts`
- Remover `psa_relacao` do `MARKER_LIST` (linha 218)
- Remover a menção a `psa_relacao` do prompt de extração (linha 540)
- Remover a entrada `psa_relacao` dos `SANITY_BOUNDS` (linha 808)
- Remover o regex `tryGeneric('psa_relacao', ...)` (linha 1994)

### 3. Testes
- Remover referências a `psa_relacao` em `src/test/postProcessResults.test.ts` (o bloco "PSA Livre/Total ratio→%")

