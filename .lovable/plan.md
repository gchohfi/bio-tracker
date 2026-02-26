

# Correcao do Build Error e Remocao dos Alertas

## Problema 1: Erro de Build (TS2345)
Na linha 415 de `PatientDetail.tsx`, `getMarkerStatus` ainda recebe `r.marker_id` (string) em vez do objeto `marker` (MarkerDef). Essa correcao ja foi feita na outra chamada (linha ~285), mas esta segunda chamada (usada na funcao de analise com IA) nao foi atualizada.

### Correcao
Trocar `r.marker_id` por `marker` na linha 415:
```typescript
const status = marker ? getMarkerStatus(r.value ?? 0, marker, sex, r.text_value ?? undefined) : "normal";
```

## Problema 2: Remover secao de Alertas do relatorio PDF
O usuario pediu para remover os avisos de alerta. Isso envolve:

### Arquivo: `supabase/functions/analyze-lab-results/index.ts`
- Remover `alerts` da interface `AnalysisResponse`
- Remover a referencia a `alerts` no `SYSTEM_PROMPT` (JSON de saida)
- No fallback de parse, remover `alerts: []`

### Arquivo: `src/lib/generateReport.ts`
- Remover o bloco que renderiza a secao "Alertas" no PDF (linhas ~564-580)

### Resultado
- Corrige o erro de build TS2345
- Remove a secao de alertas vermelhos do relatorio, mantendo o tom equilibrado e analitico

