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
│       │                         │
│       ├──▶ evolutionReportBuilder│
│       │   Série temporal +      │
│       │   buildFallbackRef()    │
│       │                         │
│       ├──▶ generateEvolutionPdf │
│       │   PDF evolutivo         │
│       │                         │
│       └──▶ EvolutionTimeline    │
│           Componente visual     │
└─────────────────────────────────┘
```

## Fonte de Verdade (v1.2)

| Conceito | Fonte | Arquivo |
|---|---|---|
| Unidade canônica | `MARKERS[].unit` | `src/lib/markers.ts` |
| Referência laboratorial | `MARKERS[].labRange` | `src/lib/markers.ts` |
| Regras de conversão | `CONVERSION_RULES` | `pipeline/conversionRules.ts` |
| Aliases de marcador | `MARKER_ALIASES` | `pipeline/markerAliases.ts` |
| Valores persistidos | `lab_results` + `lab_historical_results` | Banco de dados |
| Classificação de status | `resolveReference()` → `getMarkerStatusFromRef()` | `src/lib/markers.ts` |
| Fallback de referência | `buildFallbackRef()` | `src/lib/evolutionReportBuilder.ts` |

## Onde Adicionar uma Nova Regra de Conversão

1. **Abrir** `supabase/functions/extract-lab-results/pipeline/conversionRules.ts`
2. **Adicionar** entrada em `CONVERSION_RULES[marker_id]`
3. **Definir**: `from_unit_pattern`, `from_unit_label`, `to_unit`, `factor`, `description`
4. **Se necessário**, adicionar alias em `pipeline/markerAliases.ts`
5. **Verificar** que `MARKERS[marker_id].unit` em `src/lib/markers.ts` corresponde ao `to_unit`
6. **Adicionar** golden case em `src/test/goldenCases.fixtures.ts`
7. **Rodar** testes: `npm test`

## Sequência de Execução

```
NORMALIZE → INFER UNIT → CONVERT → SCALE → VALIDATE → DERIVE → FALLBACK → PERSIST
```

Cada etapa é **idempotente**.

## Diferenciação de Transformações

| Tipo | Exemplo | Responsável |
|---|---|---|
| Unit Conversion | pg/mL → ng/dL (×0.1) | `convert.ts` via `conversionRules.ts` |
| Scale Adjustment | leucócitos 4.5 → 4500 | `scale.ts` |
| Derived Value | HOMA-IR = glicose × insulina / 405 | `derive.ts` |

## Módulos Sensíveis (Rollback)

| Prioridade | Módulo | Risco |
|---|---|---|
| 🔴 Alta | `conversionRules.ts` | Conversão incorreta altera valores clínicos |
| 🔴 Alta | `unitInference.ts` / `infer_unit.ts` | Heurísticas podem disparar conversão indevida |
| 🟡 Média | `evolutionReportBuilder.ts` | Fallback de referência afeta PDF evolutivo |
| 🟢 Baixa | `prompt.ts` | Afeta apenas extração futura, não dados existentes |

## Resumo do PDF — Fórmula de Contagem

```
totalClassified = normalCount + alertCount + qualitativeCount
```

- **normalCount**: `getMarkerStatusFromRef() === "normal"`
- **alertCount**: `getMarkerStatusFromRef() !== "normal"`
- **qualitativeCount**: `marker.qualitative === true` com `text_value`
