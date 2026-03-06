# Arquitetura do Pipeline de Importação e Relatórios

## Visão Geral

```
PDF do Laudo
     │
     ▼
┌─────────────────────────────────┐
│  Edge Function: extract-lab-results  │
│                                 │
│  prompt.ts → IA extrai texto    │
│       │                         │
│       ▼                         │
│  normalize.ts                   │
│  Normaliza texto, deduplica     │
│       │                         │
│       ▼                         │
│  unitInference.ts               │
│  Detecta unidade fonte,         │
│  marca _sourceUnit/_targetUnit  │
│       │                         │
│       ▼                         │
│  convert.ts                     │
│  Aplica fator de conversão      │
│  (valor + referência juntos)    │
│       │                         │
│       ▼                         │
│  scale.ts                       │
│  Ajustes de escala (OCR fixes)  │
│       │                         │
│       ▼                         │
│  validate.ts                    │
│  Sanity bounds, quality score   │
│       │                         │
│       ▼                         │
│  derive.ts                      │
│  Marcadores derivados           │
│  (HOMA-IR, PSA ratio, VLDL)    │
│       │                         │
│       ▼                         │
│  regexFallback.ts               │
│  Fallback determinístico        │
│       │                         │
│       ▼                         │
│  Persistência (lab_results +    │
│  lab_historical_results)        │
└─────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────┐
│  Frontend: Renderização         │
│                                 │
│  markers.ts                     │
│  Fonte de verdade: unidade      │
│  canônica, labRange, categoria  │
│       │                         │
│       ├──▶ generateReport.ts    │
│       │   PDF do relatório      │
│       │   (resolveReference,    │
│       │    formatRefDisplay,    │
│       │    getMarkerStatusFromRef)
│       │                         │
│       ├──▶ evolutionReportBuilder│
│       │   Série temporal        │
│       │   (lab_results +        │
│       │    lab_historical)      │
│       │                         │
│       ├──▶ generateEvolutionPdf │
│       │   PDF evolutivo         │
│       │                         │
│       └──▶ EvolutionTimeline    │
│           Componente visual     │
└─────────────────────────────────┘
```

## Fonte de Verdade

| Conceito | Fonte | Arquivo |
|---|---|---|
| Unidade canônica de cada marcador | `MARKERS[].unit` | `src/lib/markers.ts` |
| Referência laboratorial convencional | `MARKERS[].labRange` | `src/lib/markers.ts` |
| Regras de conversão de unidade | `UNIT_CONVERSIONS` | `supabase/functions/extract-lab-results/unitInference.ts` |
| Valores persistidos | `lab_results` + `lab_historical_results` | Banco de dados |
| Classificação de status | `resolveReference()` → `getMarkerStatusFromRef()` | `src/lib/markers.ts` |
| Exibição de referência no PDF | `formatRefDisplay()` | `src/lib/markers.ts` |

## Onde Adicionar uma Nova Regra de Conversão

1. **Abrir** `supabase/functions/extract-lab-results/unitInference.ts`
2. **Adicionar** entrada em `UNIT_CONVERSIONS[marker_id]`
3. **Definir**: `from_unit_pattern`, `from_unit_label`, `to_unit`, `factor`, `value_heuristic` (opcional)
4. **Verificar** que `MARKERS[marker_id].unit` em `src/lib/markers.ts` corresponde ao `to_unit`
5. **Adicionar** golden case em `src/test/goldenCases.fixtures.ts`
6. **Rodar** testes: `npm test`

## Resumo do PDF — Fórmula de Contagem

```
totalClassified = normalCount + alertCount + qualitativeCount
```

- **normalCount**: marcadores numéricos com `getMarkerStatusFromRef() === "normal"`
- **alertCount**: marcadores numéricos com `getMarkerStatusFromRef() !== "normal"`
- **qualitativeCount**: marcadores com `marker.qualitative === true` que possuem `text_value`
- Marcadores multi-fase (ciclo menstrual) são contados como `normalCount`

## Sequência de Execução

```
NORMALIZE → INFER UNIT → CONVERT → SCALE → VALIDATE → DERIVE → FALLBACK → PERSIST
```

Cada etapa é **idempotente**: re-executar produz o mesmo resultado.

## Diferenciação de Transformações

| Tipo | Exemplo | Responsável |
|---|---|---|
| Unit Conversion | mg/dL → mg/L (×10) | `convert.ts` via `unitInference.ts` |
| Scale Adjustment | leucócitos 4.5 → 4500 | `scale.ts` |
| Derived Value | HOMA-IR = glicose × insulina / 405 | `derive.ts` |
