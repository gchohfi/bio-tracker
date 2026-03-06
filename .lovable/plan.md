
# Plano de Refatoração: Pipeline de Extração de Exames

## Estado Atual

`index.ts` = 3334 linhas monolíticas. Diretório `pipeline/` existe com módulos (types, normalize, infer_unit, convert, validate) usados **apenas pelos testes** — não integrados ao fluxo real.

## Inventário de Funções no index.ts

| Linhas | Função | Módulo Alvo |
|--------|--------|-------------|
| 10-228 | `MARKER_LIST` | `constants.ts` |
| 230 | `QUALITATIVE_IDS` | `constants.ts` |
| 232-702 | `systemPrompt` | `extract.ts` |
| 706-773 | `normalizeOperatorText()` + `deduplicateResults()` | `normalize.ts` |
| 776-1311 | `validateAndFixValues()` | Dividir: conversões→`convert.ts`, anti-alucinação→`normalize.ts`, sanity→`validate.ts` |
| 1319-1563 | `convertLabRefUnits()` | Dividir: ref fixes→`normalize.ts`, sanity→`validate.ts` |
| 1566-1713 | `postProcessResults()` | `derive.ts` |
| 1722-1912 | `toFloat()` + `parseLabRefRanges()` | `utils.ts` + `normalize.ts` |
| 1920-2666 | `regexFallback()` | `extract.ts` |
| 2668-2908 | `crossCheckAllMarkers()` | `validate.ts` |
| 2910-2989 | `validateExtraction()` | `validate.ts` |
| 2992-3334 | `serve()` handler | `index.ts` (orquestrador) |

## Fontes de Dupla Conversão (A ELIMINAR)

### 1. Prompt pede conversão + sanityRanges.fix() faz a mesma
Prompt pede: T3L ×10, estradiol ×10, zinco ×100, PCR ×10, testosterona_livre ÷34.7.
Depois `fix()` aplica de novo.

### 2. Fixes que são conversões disfarçadas
- `t3_livre.fix`: `v < 1.0 ? v * 10` — conversão ng/dL→pg/mL
- `estradiol.fix`: conversão ng/dL→pg/mL
- `zinco.fix`: conversão µg/mL→µg/dL
- `testosterona_livre.fix`: conversão pmol/L→ng/dL
- `pcr.fix`: conversão mg/dL→mg/L

### 3. Bloco PCR (linhas 948-974)
Conversão explícita duplicada.

## Sequência de Implementação

### Fase 1: Extrair constantes e utils (baixo risco)
1. `constants.ts` ← MARKER_LIST, QUALITATIVE_IDS, MARKER_TEXT_TERMS, CALCULATED_MARKERS
2. `utils.ts` ← toFloat, OPERATOR_PATTERNS, parseBrNum
3. Atualizar imports no index.ts

### Fase 2: Extrair módulos de processamento (risco médio)
4. Expandir `normalize.ts` ← normalizeOperatorText, deduplicateResults, anti-alucinação, parseLabRefRanges, fixes de referência
5. `derive.ts` ← postProcessResults, DHEA-S, reference overrides
6. Expandir `validate.ts` ← crossCheckAllMarkers, validateExtraction, sanityRanges (sem fixes de conversão)
7. `extract.ts` ← systemPrompt, regexFallback, chamada Gemini

### Fase 3: Eliminar dupla conversão (risco alto)
8. Remover instruções de conversão do prompt
9. Remover fixes de conversão do sanityRanges
10. Remover bloco PCR separado
11. Integrar inferUnits() + convertResults() do pipeline

### Fase 4: Simplificar orquestrador
12. Reescrever serve() handler

## Trechos a REMOVER (dupla conversão)

### No prompt:
- L396: T3L "multiply by 10"
- L407: Testosterona Livre "DIVIDE by 34.7"
- L411: Estradiol "MULTIPLY by 10"
- L456: Zinco "MULTIPLY by 100"
- L531: PCR "multiply by 10"
- L671: bloco T3L conversão

### Nos sanityRanges:
- `t3_livre.fix`, `estradiol.fix`, `zinco.fix`, `testosterona_livre.fix`, `pcr.fix`

### Bloco PCR (L948-974)

## Trechos a MANTER (fixes de decimal genuínos)

- `leucocitos.fix`: escalonamento de milhar
- `eritrocitos.fix`, `plaquetas.fix`: decimal/milhar
- `prolactina.fix`, `insulina_jejum.fix`, `tsh.fix`: decimal
- `tgo_ast.fix`, `tgp_alt.fix`, `acido_urico.fix`, `ferritina.fix`, `transferrina.fix`: decimal
- WBC absolutos: escalonamento mil/mm³→/mm³
