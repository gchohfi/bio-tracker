# Baseline de Referências Funcionais — v2.0

## Fonte de Verdade

| Campo | Valor |
|---|---|
| **Arquivo canônico** | `IFM_final.xlsx` |
| **Data da versão** | 14/03/2026 |
| **Congelado em** | 2026-03-14 |
| **Versão da baseline** | `FUNC_REF_V2_IFM_FINAL_2026_03_14` |
| **Arquivo de implementação** | `src/lib/functionalRanges.ts` |
| **Escopo** | Referências funcionais (medicina funcional/integrativa) para exportação Excel evolutivo |
| **Substitui** | `FUNC_REF_V1_2026_03_20` (VR_Barbara_Medicina_Funcional.revisado.20.03) |

## Regra de Precedência

1. **IFM_final.xlsx vence** qualquer planilha ou PDF anterior
2. Se o XLSX deixa um campo **em branco**, ele fica em branco no sistema
3. Se o XLSX separa M/F, usar a coluna correta do paciente
4. **Não inventar** referência funcional onde o XLSX não traz
5. Referências funcionais **nunca sobrescrevem** referências laboratoriais

## Alterações em relação à V1

| Marcador | V1 | V2 (IFM_final) | Tipo |
|---|---|---|---|
| RDW | 10–13 | 10–14 | Valor alterado |
| HbA1c | <5.4 | <5.5 | Valor alterado |
| Amilase | 30–110 | 28–110 | Valor alterado |
| Rel. ApoB/ApoA1 | F<0.6, M<0.7 | F<0.99, M<0.89 | Valor alterado |
| Homocisteína | <7 | <8 | Valor alterado |
| PCR-hs | <1.0 | <1.1 | Valor alterado |
| TGP (ALT) | M<31 | M<35, F<31 | Sexo-dependente agora |
| Vitamina D | 40–100 | 45–100 | Valor alterado |
| Testosterona Total M | 600–900 | 600–1000 | Valor alterado |
| SHBG F | 60–90 | 50–120 | Valor alterado |
| SHBG M | sentinel (sem ref) | 10–57 | Novo |
| CK | F<100, M<150 | F<150, M<200 | Valor alterado |
| DHT (dihidrotestosterona) | — | F<46, M 25–99 ng/dL | Novo |
| Anti-TPO | qualitativo "Negativo" | <35 IU/mL (numérico) | Tipo alterado |
| Anti-TG | qualitativo "Negativo" | <40 IU/mL (numérico) | Tipo alterado |
| TRAb | qualitativo "Negativo" | <1.75 IU/L (numérico) | Tipo alterado |
| Anti-Transglutaminase IgA | qualitativo | <7 U/mL (numérico) | Tipo alterado |
| Metais pesados | qualitativos | numéricos com cutoffs | Tipo alterado |
| Bilirrubina Direta | — | <0.3 mg/dL | Novo |
| Bilirrubina Indireta | — | 0.2–0.8 mg/dL | Novo |
| Bilirrubina Total | — | 0.2–1.1 mg/dL | Novo |
| Rel. T3L/T4L | — | >0.33 | Novo |
| Rel. TGO/TGP | — | 0.8–2.0 | Novo |

## Campos em Branco por Regra do XLSX

| Marcador | Motivo | Tratamento |
|---|---|---|
| **Estradiol (F)** | Sem fase do ciclo definida | Sentinel `[0, 9999]` → branco |
| **DHEA-S (F/M)** | IFM sem ref numérica | Sentinel `[0, 9999]` → branco |
| **FSH (F)** | Fase-dependente | Sentinel `[0, 9999]` → branco |
| **LH (F)** | Fase-dependente | Sentinel `[0, 9999]` → branco |
| **PSA (F)** | Inaplicável para sexo feminino | Sentinel `[0, 9999]` → branco |
| **Progesterona** | M="<33" sem unidade, F=vazio | Excluído totalmente |
| **IGF1** | Listado no IFM sem valores | Não implementado |

## Marcadores Não Implementados

| Marcador | Motivo |
|---|---|
| IAL (Índice Androgênio Livre) | M 30–150, precisa de marker_id mapeado |
| 1,25(OH)/25(OH) Vit D | Relação calculada "1–1.5x (25OH)" |
| LH/FSH ratio | Diagnóstico (SOP >2.0), não referência contínua |

## Erros Tipográficos Conhecidos no XLSX

| Marcador | XLSX diz | Valor correto | Justificativa |
|---|---|---|---|
| Zinco | mcg/L | µg/dL | Valores 90–120 só fazem sentido clínico em µg/dL |
| Cobre | mcg/L | µg/dL | Valores 90–130 só fazem sentido clínico em µg/dL |
| Vitamina A | mcg/L | mg/L | Valores 0.5–0.7 correspondem a retinol em mg/L |

## Como Verificar Integridade

1. A constante `FUNCTIONAL_RANGES_VERSION` em `functionalRanges.ts` deve ser `"FUNC_REF_V2_IFM_FINAL_2026_03_14"`
2. Qualquer alteração nos valores deve atualizar a versão e este documento
3. O changelog em `.lovable/CHANGELOG.md` deve registrar a mudança
4. Testes devem continuar verdes após qualquer modificação
