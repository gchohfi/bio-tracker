
# Padronizar cor de alerta: valores fora da referencia sempre em VERMELHO

## Problema
Atualmente, valores **abaixo** da faixa de referencia ("low") aparecem em **azul** em varios locais, enquanto valores **acima** ("high") aparecem em **vermelho**. O usuario quer que ambos (baixo e alto) sejam exibidos em **vermelho**, pois ambos representam alerta.

A tabela de evolucao (`EvolutionTable.tsx`) ja esta correta -- ambos usam vermelho. Porem outros 2 arquivos usam azul para "low":

## Locais a corrigir

### 1. `src/pages/PatientDetail.tsx` (formulario de edicao de marcadores)
- **Linha 874**: `border-blue-400` -> `border-red-400` (borda do input quando baixo)
- **Linha 883**: `bg-blue-50` -> `bg-red-50` (fundo do card quando baixo)
- **Linha 912**: `border-blue-400 text-blue-700` -> `border-red-400 text-red-700` (badge "Baixo")

### 2. `src/lib/generateReport.ts` (relatorio PDF)
- **Linha 105**: Sparkline dots -- `BLUE` -> `RED` para status "low"
- **Linha 132**: Status dot -- `BLUE` -> `RED` para status "low"
- **Linhas 232-234**: Legenda -- trocar dot azul e texto "Abaixo da faixa" para usar `RED`
- **Linha 410**: Trend symbol -- `BLUE` -> `RED` para seta descendente

### 3. Atualizar texto da legenda no PDF
- Onde diz "Abaixo da faixa" com cor azul, mudar para cor vermelha (mantendo o texto)

## Resumo das mudancas
- 3 alteracoes em `PatientDetail.tsx` (blue -> red)
- 4 alteracoes em `generateReport.ts` (BLUE -> RED)
- Nenhum arquivo novo criado
- `EvolutionTable.tsx` ja esta correto, nenhuma alteracao necessaria
