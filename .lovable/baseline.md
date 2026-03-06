# Baseline Técnica — Pipeline extract-lab-results

## Fluxo Atual (serve handler, L2248-2569)

```
AI Extract → normalizeOperatorText → deduplicateResults → validateAndFixValues
→ postProcessResults → regexFallback → validateAndFixValues(fallback) → postProcessResults(re-run)
→ parseLabRefRanges → DHEA-S age override → VLDL guard → convertLabRefUnits
→ crossCheckAllMarkers → REFERENCE_OVERRIDES → validateExtraction → date extraction
```

---

## 1. MARCADORES COM CONVERSÃO DE UNIDADE (sanityRanges.fix)

Estes fixes fazem **conversão de unidade disfarçada** — candidatos a migrar para `convert.ts`:

| Marcador | Fix | Tipo | Linhas |
|---|---|---|---|
| `t3_livre` | `v < 1.0 ? v * 10` | ng/dL → pg/mL | L518 |
| `estradiol` | `unit ng/dL ? v*10 : v<1 ? v*10` | ng/dL → pg/mL | L539-548 |
| `zinco` | `unit µg/mL ? v*100 : v<10 ? v*100` | µg/mL → µg/dL | L529-533 |
| `testosterona_livre` | `unit pmol ? v/34.7 : v>100 ? v/34.7` | pmol/L → ng/dL | L534-538 |
| `pcr` | `v < 0.5 && v > 0 ? v * 10` | mg/dL → mg/L | L570 |

### Bloco PCR separado (L660-686)
Conversão explícita PCR mg/dL→mg/L com detecção por `lab_ref_text` e valor. **Converte valor E referência juntos** (correto). Mas duplica a lógica do fix acima.

---

## 2. FIXES DE DECIMAL GENUÍNOS (manter em validate.ts)

Estes corrigem erros de parsing/OCR — **NÃO são conversões de unidade**:

| Marcador | Fix | Lógica |
|---|---|---|
| `leucocitos` | `v<30→v*1000, v<100→v*100, v<1000→v*10` | Escalonamento em camadas |
| `eritrocitos` | `v>1000→v/1e6, v>10→v/10` | Ponto decimal perdido |
| `plaquetas` | `v>1000→v/1000` | Milhar vs centena |
| `prolactina` | `v>200→v/100` | Decimal |
| `insulina_jejum` | `v>100→v/100` | Decimal |
| `tsh` | `v>200→v/100` | Decimal |
| `ferritina` | `v>2000→v/10` | Decimal |
| `acido_urico` | `v>15→v/10` | Decimal |
| `tgo_ast` | `v 1000-10000→v/10` | Decimal |
| `tgp_alt` | `v 1000-10000→v/10` | Decimal |
| `transferrina` | `v<100→v*10` | Separador perdido |
| `neutrofilos_abs` | `v<10→v*1000` | mil/mm³→/mm³ |
| `linfocitos_abs` | `v<10→v*1000` | mil/mm³→/mm³ |
| `monocitos_abs` | `v<1→v*1000` | mil/mm³→/mm³ |
| `eosinofilos_abs` | `v<1→v*1000` | mil/mm³→/mm³ |
| `basofilos_abs` | `v<1→v*1000` | mil/mm³→/mm³ |

---

## 3. INSTRUÇÕES DE CONVERSÃO NO PROMPT

O prompt (systemPrompt) AINDA pede conversões em alguns lugares:

| Marcador | Instrução no prompt | Linha aprox |
|---|---|---|
| `t3_livre` | "multiply value by 10 to convert to pg/mL" | L176 |
| `testosterona_livre` | "DIVIDE by 34.7 to convert to ng/dL" | L187 |
| `estradiol` | "MULTIPLY by 10 to convert to pg/mL" | L191 |
| `WBC absolutos` | "multiply by 1000 to convert to /mm³" | L52 |
| `IGFBP-3 regex` | `num > 100 ? num / 1000` (ng/mL → µg/mL) | L1717, L1846 |

**REGRA #2 no prompt (L20-23)** diz "Do NOT convert units" — contradição com as instruções acima.

---

## 4. MARCADORES DERIVADOS (postProcessResults, L1278-1426)

| Derivado | Fórmula | Condição |
|---|---|---|
| `psa_ratio` | `(psa_livre / psa_total) * 100` | Sempre recalcula se ambos existem |
| `bilirrubina_indireta` | `total - direta` | Se ausente |
| `colesterol_nao_hdl` | `CT - HDL` | Se ausente |
| `relacao_ct_hdl` | `CT / HDL` | Se ausente |
| `relacao_tg_hdl` | `TG / HDL` | Se ausente |
| `relacao_apob_apoa1` | `ApoB / ApoA1` | Se ausente |
| `homa_ir` | `(glicose × insulina) / 405` | Se ausente |
| `neutrofilos` | `bastonetes + segmentados` | Se ausente |
| `fixacao_latente_ferro` | `TIBC - ferro_serico` | Se ausente |
| `urina_acr` | `albumina × 100 / creatinina` | Se ausente |
| `psa_ratio` | `(livre/total) × 100` | Se ausente (2ª verificação) |

---

## 5. ANTI-ALUCINAÇÃO (validateAndFixValues, L811-1023)

### urina_hemoglobina (L822-878)
- Valor numérico > 5 → remove (qualitativo)
- String com "g/dL", "milhões" → remove
- text_value com unidades de hemograma → remove  
- lab_ref com range 5-20 → remove
- Cross-check com hemoglobina sanguínea (diff < 1) → remove

### urina_hemacias (L881-932)
- Valor > 100 → remove
- String com "milhões", "mm³" → remove
- text_value com unidades hemograma → remove
- lab_ref range 1-10 (hemograma eritrócitos) → remove
- Cross-check com eritrócitos sanguíneos (diff < 0.5) → remove

### Cleanup urina qualitativo (L935-983)
- Detecta valor+referência concatenados no text_value
- Separa em resultado e lab_ref_text

### Dedup urina qualitativo→quantitativo (L985-1021)
- Se qualitativo tem valor > 50 ou unidade /mL, redireciona para `_quant`

---

## 6. VALIDAÇÃO DE REFERÊNCIA (convertLabRefUnits, L1031-1276)

Apesar do nome, esta função NÃO converte unidades. Faz **sanitização de referências**:

| Regra | Marcador | Lógica |
|---|---|---|
| Ref absoluta em % marker | neutrofilos, linfocitos, etc | ref > 100 → descartar |
| Leucograma abs→% | neutrofilos etc | valor > 100 → calc % via leucocitos total |
| Cálcio Total ref | calcio_total | ref_max > 15 → descartar (PTH adjacente) |
| AMH ref | amh | ref_max > 10 → descartar (faixa etária) |
| IGF-1 ref | igf1 | ref_max < 50 → descartar (faixa etária) |
| PTH ref | pth | ref_max < 50 && ref_min > 30 → descartar |
| Homocisteína ref | homocisteina | ref_min ≥ 10 && ref_max ≥ 40 → descartar |
| Testo Livre ref | testosterona_livre | valor > 5 mas ref_max ≤ 2 → descartar (sexo errado) |
| Leucócitos ref | leucocitos | ref_max < 100 → ×1000 (separador milhar) |
| HbA1c ref | hba1c | ref 5.0-7.0 → descartar (pré-diabetes) |
| Age headers | todos | "Maior ou igual a 20 anos" → descartar |
| Sanity genérico | 30+ markers | ratio > 20x vs esperado → descartar |

---

## 7. CROSS-CHECK (crossCheckAllMarkers, L2124-2165)

Duas camadas:
1. **Toxicologia** (mercurio, aluminio, cadmio, etc): nome do marcador deve existir no PDF texto
2. **Plausibilidade toxicologia**: valor max absoluto por marcador

---

## 8. OVERRIDES (L2473-2489)

`REFERENCE_OVERRIDES` (em constants.ts) — aplica ref padrão SOMENTE se o lab não forneceu referência:

| Marcador | Override |
|---|---|
| `colesterol_total` | < 190 |
| `ldl` | < 130 |
| `hdl` | M: > 40, F: > 50 |
| `triglicerides` | < 150 |
| `vitamina_b12` | 197-771 |
| `hba1c` | 4.0-5.7 |

---

## 9. VALIDAÇÃO FINAL (validateExtraction, L2170-2246)

- marker_id obrigatório
- value OU text_value obrigatório
- Rejeita NaN/Infinity
- Rejeita negativos (exceto ALLOW_NEGATIVE)
- Dedup final (prefere o com lab_ref_text)
- Calcula quality_score

---

## 10. REGEX FALLBACK (regexFallback, L1436-2166)

~700 linhas de regex para marcadores que a IA perde. Dois padrões:
- `tryFleury`: examName → "VALORES DE REFERÊNCIA\n\n" → valor
- `tryGeneric`: padrões simples nome:valor

### Conversões dentro do fallback (RISCO):
- **IGFBP-3** (L1717, L1846): `num > 100 ? num / 1000` (ng/mL → µg/mL)

---

## 11. PONTOS DE RISCO DE REGRESSÃO

### Críticos (podem quebrar dados de pacientes):
1. **PCR dupla conversão**: fix (L570) + bloco explícito (L660-686). Se ambos rodarem, valor fica ×100.
2. **Estradiol false positive**: converter valores 1-5 pg/mL (pós-menopausa legítimo) quebraria resultado.
3. **T3 Livre threshold**: fix usa `v < 1.0` como trigger — mas T3L normal pode ser 0.8-1.0 pg/mL em hipotireoidismo.
4. **Testosterona Livre**: fix usa `v > 100` como trigger pmol→ng/dL, mas valores femininos são 0.1-0.5.
5. **WBC absolutos**: fix + prompt ambos pedem ×1000 — dupla conversão possível.

### Médios:
6. **IGFBP-3 regex**: conversão ng/mL→µg/mL hardcoded no fallback.
7. **Leucograma abs→%**: depende de leucocitos total existir; se absent, remove marcador.
8. **DHEA-S age override**: substitui ref do lab pela tabela interna — pode divergir de labs específicos.
9. **PSA ratio recalculado incondicionalmente**: se AI extrair corretamente, recalcular pode perder precisão.

### Baixos:
10. **Urina densidade**: parseBrNum interpreta "1.020" como 1020 (milhar) — fix remove e força regex.
11. **VLDL guard**: ref com ">" descartada — correto mas silencioso.

---

## 12. MAPA DE COMPATIBILIDADE OBRIGATÓRIA

Estes comportamentos DEVEM ser preservados nas próximas fases:

1. `normalizeOperatorText` roda ANTES de `validateAndFixValues`
2. `deduplicateResults` roda ANTES de `validateAndFixValues`
3. `postProcessResults` roda DEPOIS de `validateAndFixValues` (precisa de valores corrigidos)
4. `regexFallback` roda DEPOIS de `postProcessResults` (para não duplicar derivados)
5. Marcadores do fallback passam por `validateAndFixValues` separadamente
6. `postProcessResults` roda NOVAMENTE após fallback (para calcular derivados com novos marcadores)
7. `parseLabRefRanges` roda DEPOIS de tudo (precisa de todos os marcadores presentes)
8. `convertLabRefUnits` (sanitização de refs) roda DEPOIS de `parseLabRefRanges`
9. `crossCheckAllMarkers` roda DEPOIS de tudo (validação final anti-alucinação)
10. `REFERENCE_OVERRIDES` roda DEPOIS de `crossCheckAllMarkers` (não deve ser descartado)
11. `validateExtraction` é o último passo (quality score final)
12. Date extraction é independente do pipeline de marcadores
