# Separação Conceitual: 3 Categorias de Transformação

## Definições

### 1. UNIT CONVERSION (Conversão de Unidade)
**O que é:** Transformar um valor de uma unidade de medida para outra, preservando o significado clínico.
**Exemplo:** 2.7 ng/dL → 27 pg/mL (estradiol), 477 pmol/L → 13.7 ng/dL (testosterona livre)
**Onde deve viver:** `convert.ts` — etapa única e explícita do pipeline
**Flag:** `_converted: true` (idempotência)
**Regra:** Valor E referência devem ser convertidos JUNTOS, no mesmo momento.

### 2. SCALE ADJUSTMENT (Ajuste de Escala / Correção de Parsing)
**O que é:** Corrigir erros de OCR, separadores decimais perdidos ou escalonamento incorreto da IA.
O valor já está na unidade correta — apenas a escala numérica está errada.
**Exemplo:** TSH 450 → 4.50 (ponto decimal perdido), Leucócitos 8.29 → 8290 (separador de milhar)
**Onde deve viver:** `validate.ts` — fase de validação/sanity check
**Regra:** Não deve criar dependência de unidade. Aplica heurística baseada em ranges fisiológicos.

### 3. DERIVED VALUE (Valor Derivado / Calculado)
**O que é:** Calcular um marcador que não existe no laudo a partir de outros marcadores extraídos.
**Exemplo:** HOMA-IR = (glicose × insulina) / 405, Bilirrubina Indireta = Total - Direta
**Onde deve viver:** `derive.ts` — etapa após validação, antes da persistência
**Regra:** Só calcula se o marcador NÃO foi extraído. Nunca sobrescreve valor existente (exceto PSA ratio).

---

## Classificação Completa — Estado Atual

### UNIT CONVERSIONS (→ convert.ts)

| Marcador | Transformação | Onde está hoje | Problema |
|---|---|---|---|
| `t3_livre` | ng/dL → pg/mL (×10) | sanityRanges.fix L518 + prompt L176 | **Dupla**: fix + prompt pedem a mesma conversão |
| `estradiol` | ng/dL → pg/mL (×10) | sanityRanges.fix L539-548 + prompt L191 | **Dupla**: fix + prompt |
| `zinco` | µg/mL → µg/dL (×100) | sanityRanges.fix L529-533 | Conversão disfarçada de fix |
| `testosterona_livre` | pmol/L → ng/dL (÷34.7) | sanityRanges.fix L534-538 + prompt L187 | **Dupla**: fix + prompt |
| `pcr` | mg/dL → mg/L (×10) | sanityRanges.fix L570 + bloco L660-686 | **Dupla**: fix + bloco separado |
| `IGFBP-3` | ng/mL → µg/mL (÷1000) | regexFallback L1717, L1846 | Hardcoded no regex |
| WBC absolutos ref | mil/mm³ → /mm³ (×1000) | L706-714 | Ref-only, mas é conversão |

### SCALE ADJUSTMENTS (→ validate.ts)

| Marcador | Heurística | Onde está hoje |
|---|---|---|
| `leucocitos` | v<30→×1000, v<100→×100, v<1000→×10 | sanityRanges.fix L494-503 |
| `eritrocitos` | v>1000→÷1e6, v>10→÷10 | sanityRanges.fix L504 |
| `plaquetas` | v>1000→÷1000 | sanityRanges.fix L505 |
| `prolactina` | v>200→÷100 | sanityRanges.fix L507 |
| `insulina_jejum` | v>100→÷100 | sanityRanges.fix L508 |
| `tsh` | v>200→÷100 | sanityRanges.fix L512-515 |
| `ferritina` | v>2000→÷10 | sanityRanges.fix L526 |
| `acido_urico` | v>15→÷10 | sanityRanges.fix L560 |
| `tgo_ast` | v 1000-10000→÷10 | sanityRanges.fix L628-631 |
| `tgp_alt` | v 1000-10000→÷10 | sanityRanges.fix L632-635 |
| `transferrina` | v<100→×10 | sanityRanges.fix L609 |
| `neutrofilos_abs` | v<10→×1000 | sanityRanges.fix L603 |
| `linfocitos_abs` | v<10→×1000 | sanityRanges.fix L604 |
| `monocitos_abs` | v<1→×1000 | sanityRanges.fix L605 |
| `eosinofilos_abs` | v<1→×1000 | sanityRanges.fix L606 |
| `basofilos_abs` | v<1→×1000 | sanityRanges.fix L607 |
| Leucograma abs→% | v>100 → calc % via leucocitos | convertLabRefUnits L1064-1083 |
| Leucócitos ref ×1000 | ref_max<100 → ×1000 | convertLabRefUnits L1160-1167 |

### DERIVED VALUES (→ derive.ts)

| Derivado | Fórmula | Condição | Onde está hoje |
|---|---|---|---|
| `psa_ratio` | (livre/total)×100 | **Sempre recalcula** | postProcessResults L1287-1303 |
| `bilirrubina_indireta` | total - direta | Se ausente | postProcessResults L1307-1317 |
| `colesterol_nao_hdl` | CT - HDL | Se ausente | postProcessResults L1320-1330 |
| `relacao_ct_hdl` | CT / HDL | Se ausente | postProcessResults L1332-1341 |
| `relacao_tg_hdl` | TG / HDL | Se ausente | postProcessResults L1344-1351 |
| `relacao_apob_apoa1` | ApoB / ApoA1 | Se ausente | postProcessResults L1355-1362 |
| `homa_ir` | (glic×ins)/405 | Se ausente | postProcessResults L1365-1374 |
| `neutrofilos` | bast + seg | Se ausente | postProcessResults L1377-1384 |
| `fixacao_latente_ferro` | TIBC - ferro | Se ausente | postProcessResults L1387-1397 |
| `urina_acr` | alb×100/crea | Se ausente | postProcessResults L1402-1410 |

### NÃO SE ENCAIXA NAS 3 CATEGORIAS (→ permanece em validate.ts como sanitização)

| Operação | Tipo real | Onde está hoje |
|---|---|---|
| Remover urina_densidade 0 ou >2 | **Validação/rejeição** | validateAndFixValues L737-752 |
| Remover urina_ph 0 ou >14 | **Validação/rejeição** | validateAndFixValues L745-751 |
| Anti-alucinação urina_hemoglobina | **Validação/rejeição** | validateAndFixValues L811-878 |
| Anti-alucinação urina_hemacias | **Validação/rejeição** | validateAndFixValues L881-932 |
| Cleanup urina text_value | **Normalização** | validateAndFixValues L935-983 |
| Dedup urina qual→quant | **Normalização** | validateAndFixValues L985-1021 |
| Strip text_value numérico | **Normalização** | validateAndFixValues L754-763 |
| Validação ref por sexo | **Normalização de ref** | validateAndFixValues L764-810 |
| Ref marcadores % | **Sanitização de ref** | convertLabRefUnits L1037-1057 |
| Ref cálcio/AMH/IGF1/PTH/HbA1c | **Sanitização de ref** | convertLabRefUnits L1087-1181 |
| Ref sanity genérico 20x | **Sanitização de ref** | convertLabRefUnits L1207-1272 |
| Age header filter | **Sanitização de ref** | convertLabRefUnits L1183-1205 |
| Testo livre ref sexo | **Sanitização de ref** | convertLabRefUnits L1147-1156 |

---

## Arquitetura Alvo — Onde Cada Coisa Vive

```
index.ts (orquestrador)
  │
  ├─ extract.ts        → systemPrompt + chamada Gemini + regexFallback
  │
  ├─ normalize.ts      → normalizeOperatorText, deduplicateResults, parseLabRefRanges
  │                      + cleanup urina text_value, dedup qual→quant
  │                      + validação ref por sexo, strip text_value numérico
  │
  ├─ convert.ts        → SOMENTE conversões de unidade (t3_livre, estradiol, zinco,
  │   (NOVO)             testosterona_livre, pcr, igfbp3, wbc abs ref)
  │                      Flag _converted para idempotência
  │                      Converte valor E referência JUNTOS
  │
  ├─ derive.ts         → SOMENTE valores calculados (homa_ir, bilirrubina_indireta,
  │   (NOVO)             ratios lipídicos, neutrofilos, fixacao_latente_ferro, urina_acr, psa_ratio)
  │
  ├─ validate.ts       → SOMENTE validação e ajustes de escala
  │   (NOVO)             Scale adjustments (leucocitos, eritrocitos, plaquetas, tsh, etc.)
  │                      Anti-alucinação (urina, toxicologia)
  │                      Sanitização de referência (cálcio, AMH, IGF1, PTH, HbA1c, sanity 20x)
  │                      Validação final (marker_id, NaN, negativos, duplicatas)
  │                      crossCheckAllMarkers
  │
  ├─ constants.ts      → MARKER_LIST, QUALITATIVE_IDS, REFERENCE_OVERRIDES, etc.
  │   (existente)
  │
  └─ utils.ts          → toFloat, parseBrNum, OPERATOR_PATTERNS
      (existente)
```

---

## O Que NÃO DEVE Mais Acontecer em Sanity Checks

1. ❌ `sanityRanges.fix` NÃO deve converter unidades (t3_livre, estradiol, zinco, testo_livre, pcr)
2. ❌ `sanityRanges` NÃO deve ter campos `fix` que fazem conversão — apenas `min/max` para bounds
3. ❌ `regexFallback` NÃO deve converter IGFBP-3 ng/mL→µg/mL inline
4. ❌ `convertLabRefUnits` NÃO deve existir com este nome — é sanitização de ref, não conversão
5. ❌ O prompt NÃO deve pedir conversões que o pipeline vai fazer depois

## O Que DEVE Acontecer em Cada Etapa

### convert.ts
- ✅ Detectar unidade via `unit_raw` ou heurística de valor
- ✅ Aplicar fator de conversão ao valor
- ✅ Aplicar MESMO fator à referência (lab_ref_min, lab_ref_max)
- ✅ Marcar `_converted: true` (idempotência)
- ✅ Logar: `"[CONVERT] marker: value from→to, unit from→to"`

### validate.ts (scale adjustments)
- ✅ Verificar se valor está dentro de bounds fisiológicos
- ✅ Aplicar heurísticas de escala (÷10, ×1000) baseadas em magnitude
- ✅ Logar: `"[SCALE-FIX] marker: value from→to (reason)"`
- ✅ Se valor permanece fora de bounds após fix, reverter

### derive.ts
- ✅ Calcular derivados SOMENTE se ausentes (exceto PSA ratio)
- ✅ Logar: `"[DERIVED] marker: formula = result"`
- ✅ Nunca sobrescrever valor extraído da IA ou do regex
