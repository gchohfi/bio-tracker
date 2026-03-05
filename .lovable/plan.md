

## Bugs Identificados

### Bug 1: Leucócitos absolutos (abs) — valores em mil/mm³ não multiplicados por 1000

O laudo reporta em "mil/mm³" (ex: 0.27 mil/mm³ = 270 /mm³). O prompt já instrui a IA a extrair em /mm³ (ex: 3250), mas a IA está extraindo o valor bruto do laudo sem converter (ex: 0.27 em vez de 270).

**Causa raiz**: Não há sanity check para os marcadores `_abs`. O `leucocitos` tem fix (`v < 100 → v * 1000`), mas `neutrofilos_abs`, `linfocitos_abs`, `monocitos_abs`, `eosinofilos_abs`, `basofilos_abs` não têm nenhuma entrada no `sanityRanges`.

**Correção**: Adicionar sanity ranges para todos os 5 marcadores `_abs`:
```typescript
neutrofilos_abs: { min: 100, max: 15000, fix: (v) => v < 10 ? v * 1000 : v },
linfocitos_abs:  { min: 100, max: 10000, fix: (v) => v < 10 ? v * 1000 : v },
monocitos_abs:   { min: 10,  max: 3000,  fix: (v) => v < 1 ? v * 1000 : v },
eosinofilos_abs: { min: 10,  max: 3000,  fix: (v) => v < 1 ? v * 1000 : v },
basofilos_abs:   { min: 1,   max: 500,   fix: (v) => v < 1 ? v * 1000 : v },
```

Adicionalmente, reforçar a instrução no prompt para que a IA já multiplique por 1000 quando o laudo usar "mil/mm³".

### Bug 2: Transferrina 280 → 28

O valor 280 foi lido como 28. Isso é o bug clássico do separador de milhar brasileiro — o laudo provavelmente mostra "280" mas o ponto decimal no contexto do PDF pode ter causado perda do zero, ou a IA truncou.

**Causa raiz**: Transferrina não tem entrada no `sanityRanges`. O range normal é 200-360 mg/dL, então 28 deveria ter sido detectado como anômalo.

**Correção**: Adicionar sanity range para transferrina:
```typescript
transferrina: { min: 100, max: 500, fix: (v) => v < 100 ? v * 10 : v },
```
Isso corrige 28 → 280.

## Arquivo a alterar

| Arquivo | Alteração |
|---|---|
| `supabase/functions/extract-lab-results/index.ts` | Adicionar sanity ranges para 5 marcadores `_abs` + transferrina. Reforçar instrução de "mil/mm³" no prompt. |

## Resumo das mudanças

1. **6 novas entradas em `sanityRanges`**: neutrofilos_abs, linfocitos_abs, monocitos_abs, eosinofilos_abs, basofilos_abs, transferrina
2. **Reforço no prompt**: instruir explicitamente a multiplicar por 1000 quando a unidade for "mil/mm³" ou "x10³/mm³"
3. Os dados existentes no banco precisarão ser reimportados (não corrigíveis via migration pois dependem do laudo específico)

