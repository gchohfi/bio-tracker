# Changelog

## v1.2 — 2026-03-07 — Unificação DHT + Consistência PDF Evolutivo

### Correções Críticas

| Fix | Descrição |
|---|---|
| **DHT unidade canônica** | Unificado como **ng/dL** em todo o sistema (markers.ts, constants.ts, conversionRules.ts, prompt.ts) |
| **DHT conversão** | Regra invertida: `pg/mL → ng/dL (×0.1)` — heurística `v > 50` detecta pg/mL |
| **Derivados sem eco** | VLDL, Glicemia Média Estimada: coluna Ref usa fallback em vez de ecoar o valor |
| **Unidades duplicadas** | Neutrófilos (%), Linfócitos (%), Gordura Fecal (%): sem duplicação no nome |
| **Fallback de referência** | TSH, Testosterona Total/Livre, Estradiol: preenchidos via `MARKERS.labRange` |
| **Julia DHT no banco** | lab_ref_min=5, lab_ref_max=46, lab_ref_text='5 - 46 ng/dL' |

### Arquivos Alterados

| Módulo | Alteração |
|---|---|
| `conversionRules.ts` | DHT: `pg/mL → ng/dL (×0.1)` |
| `pipeline/infer_unit.ts` | Heurística DHT `v > 50` → pg/mL |
| `constants.ts` | DHT unit → ng/dL |
| `unitInference.ts` | DHT regra alinhada |
| `prompt.ts` | DHT range 5-100 ng/dL |
| `evolutionReportBuilder.ts` | Derivados usam `buildFallbackRef()` |
| `markerAliases.ts` | `dht → dihidrotestosterona` (sem mudança) |

### Testes

- **543/543 verdes**
- Golden cases: Julia, Barbara, Dener, Gustavo, Marcela
- Fixtures: `src/test/goldenCases.fixtures.ts`
- Regressão: `src/test/goldenRegression.test.ts`
- Conversão: `src/test/convert.test.ts`, `src/test/unitInferenceRegression.test.ts`
- Pipeline: `src/test/pipeline.test.ts`

### Validação Visual

- PDF evolutivo Julia: DHT 15.8 ng/dL, ref 5-46 ng/dL ✅
- PDF evolutivo Barbara: DHT ng/dL, ref 5-46 ng/dL ✅
- Sem unidades duplicadas ✅
- Derivados sem eco de valor ✅

---

## v1.0 — 2026-03-06 — Release Evolutivo Inicial

### Correções de Dados (Barbara Pozitel)

| Marcador | Antes | Depois | Motivo |
|---|---|---|---|
| Progesterona (10/11) | 19 ng/mL | 0.19 ng/mL | ÷100 (ng/dL → ng/mL) |
| Progesterona (07/02) | — | 1.01 ng/mL | ÷100 (101 ng/dL → ng/mL) |
| DHT (ambas datas) | pg/mL ref 16-79 | ng/dL ref 5-46 | Unidade corrigida |
| PCR (07/02) | 7 mg/L | 0.7 mg/L | 0.07 mg/dL × 10 = 0.7 |

### Documentação

- `.lovable/ARCHITECTURE.md` — Pipeline + fonte de verdade
- `.lovable/CHANGELOG.md` — Este arquivo
