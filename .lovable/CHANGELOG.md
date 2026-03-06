# Changelog — Release Evolutivo v1.0

## Data: 2026-03-06

### Correções de Dados (Barbara Pozitel)

| Marcador | Antes | Depois | Motivo |
|---|---|---|---|
| Progesterona (10/11) | 19 ng/mL | 0.19 ng/mL | Laudo exige ÷100 (ng/dL → ng/mL) |
| Progesterona (07/02) | — | 1.01 ng/mL | Laudo exige ÷100 (101 ng/dL → ng/mL) |
| DHT (ambas datas) | pg/mL ref 16-79 | ng/dL ref 5-46 | Unidade fonte = ng/dL; ref feminina correta |
| PCR (07/02) | 7 mg/L | 0.7 mg/L | 0.07 mg/dL × 10 = 0.7, não 7 |

### Arquivos Principais Alterados

- `src/lib/markers.ts` — DHT: unidade → ng/dL, labRange F → [5, 46]
- `src/lib/generateReport.ts` — Resumo: fórmula `total = normal + alert + qualitative`
- `supabase/functions/extract-lab-results/unitInference.ts` — Regras de conversão (sem alteração funcional)

### Testes Adicionados

- `src/test/goldenCases.fixtures.ts` — Fixtures com 14 golden cases
- `src/test/goldenRegression.test.ts` — Testes de regressão E2E
- `src/test/generateReport.test.ts` — Testes de labRefStr existentes (mantidos)

### Documentação

- `.lovable/ARCHITECTURE.md` — Pipeline completo, fonte de verdade, como adicionar conversão
- `.lovable/CHANGELOG.md` — Este arquivo

### Riscos Residuais

1. **DHT conversion rule**: `unitInference.ts` ainda tem regra `dht → pg/mL (×10)` mas o marker_id no MARKERS é `dihidrotestosterona`. Se o pipeline extrair `dht` como marker_id, a conversão será aplicada indevidamente. Mitigação: o normalize.ts deve mapear `dht` → `dihidrotestosterona`.
2. **Progesterona heurística**: `value_heuristic: (v) => v > 50` pode não capturar valores entre 19-50 ng/dL se a unidade explícita não vier no resultado. Mitigação: o laudo sempre traz a nota de conversão.
3. **Limites de 1000 rows**: Queries ao banco não paginam além de 1000 registros por tabela. Para pacientes com muitas sessões, pode haver truncamento.

### Próximos Passos (Não Bloqueantes)

1. Adicionar alias `dht` → `dihidrotestosterona` no normalize.ts do pipeline
2. Implementar auditoria visual no PDF: mostrar valor bruto, fator e valor final por marcador
3. Adicionar paginação para queries com > 1000 resultados
4. Expandir golden cases conforme novos pacientes forem validados
