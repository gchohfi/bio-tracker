
# Corrigir erro de build: categoria "Sorologia" faltando em generateReport.ts

## Problema
A categoria `Sorologia` existe em `CATEGORIES` (markers.ts, linha 29) mas nao foi adicionada ao mapa `getCategoryRGB` em `generateReport.ts`. O TypeScript exige que todas as categorias estejam presentes no `Record<Category, ...>`.

## Correcao
Adicionar uma unica linha no mapa de cores RGB em `generateReport.ts`, entre `Imunologia` e `Proteinas` (apos linha 57):

```
Sorologia: { r: 130, g: 90, b: 180 },
```

Cor escolhida: roxo medio, consistente com a paleta existente e distinto das outras categorias.

## Arquivos alterados
- `src/lib/generateReport.ts`: adicionar entrada `Sorologia` no mapa `getCategoryRGB` (1 linha)
