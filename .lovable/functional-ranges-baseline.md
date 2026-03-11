# Baseline de Referências Funcionais — v1.0

## Fonte de Verdade

| Campo | Valor |
|---|---|
| **Arquivo canônico** | `VR_Barbara_Medicina_Funcional.revisado.20.03 (1).xlsx` |
| **Data da versão** | 20/03/2026 |
| **Congelado em** | 2026-03-11 |
| **Versão da baseline** | `FUNC_REF_V1_2026_03_20` |
| **Arquivo de implementação** | `src/lib/functionalRanges.ts` |
| **Escopo** | Referências funcionais (medicina funcional/integrativa) para exportação Excel evolutivo |

## Regra de Precedência

1. **Este XLSX vence** qualquer PDF anterior (Barbara, Dener, ou outros)
2. Se o XLSX deixa um campo **em branco**, ele fica em branco no sistema
3. Se o XLSX separa M/F, usar a coluna correta do paciente
4. **Não inventar** referência funcional onde o XLSX não traz
5. Referências funcionais **nunca sobrescrevem** referências laboratoriais

## Blocos Cobertos

| Bloco | Marcadores | Status |
|---|---|---|
| Hemograma | hemoglobina, hematocrito, vcm, hcm, chcm, rdw, leucocitos, neutrofilos, linfocitos, monocitos, eosinofilos, basofilos, plaquetas | ✅ Congelado |
| Ferro/Metabolismo | ferritina, ferro_serico, sat_transferrina, tibc | ✅ Congelado |
| Glicemia | glicose_jejum, hba1c, insulina_jejum, homa_ir, homa_beta, peptideo_c | ✅ Congelado |
| Perfil Lipídico | colesterol_total, hdl, ldl, vldl, triglicerides, apo_a1, apo_b, lipoproteina_a, amilase, lipase, relacao_ct_hdl, relacao_tg_hdl, relacao_apob_apoa1 | ✅ Congelado |
| Inflamação/CV | homocisteina, pcr, fibrinogenio | ✅ Congelado |
| Tireoide | tsh, t4_livre, t3_livre, t3_reverso, relacao_t3t_t3r, tireoglobulina | ✅ Congelado |
| Hormônios | testosterona_total, testosterona_livre, shbg, dhea_s, estradiol, prolactina, fsh, lh, psa_total, psa_livre_total | ✅ Congelado |
| Vitaminas | vitamina_d, vitamina_b12, acido_folico, vitamina_a, vitamina_c | ✅ Congelado |
| Minerais | selenio, zinco, cobre, magnesio, calcio_total | ✅ Congelado |
| Hepático | tgo_ast, tgp_alt, ggt, fosfatase_alcalina, albumina, proteinas_totais | ✅ Congelado |
| Renal | creatinina, ureia, acido_urico, relacao_ureia_creatinina | ✅ Congelado |
| Eletrólitos | sodio, potassio, cloro, calcio_ionico, pth | ✅ Congelado |
| Adrenais | cortisol, aldosterona, acth, igfbp3 | ✅ Congelado |
| Outros | ck, ldh, copro_ph | ✅ Congelado |
| Qualitativos (urina) | urina_cor, urina_aspecto, urina_densidade, urina_ph, urina_proteinas, urina_glicose, urina_hemoglobina, urina_leucocitos_esterase, urina_cetonas, urina_nitrito, urina_bilirrubina, urina_urobilinogenio | ✅ Congelado |
| Qualitativos (sedimento) | urina_hemacias, urina_celulas_epiteliais, urina_muco, urina_cristais, urina_cilindros, urina_bacterias, urina_fungos | ✅ Congelado |
| Qualitativos (fezes) | copro_muco, copro_sangue, copro_leucocitos, copro_gordura_fecal, copro_fibras, copro_flora, copro_parasitas | ✅ Congelado |
| Qualitativos (autoimune) | anti_tpo, anti_tg, fan | ✅ Congelado |
| Qualitativos (metais pesados) | mercurio, aluminio, cadmio, chumbo, arsenio | ✅ Congelado |
| Qualitativos (intolerâncias) | igg_gluten, igg_caseina, igg_ovo | ✅ Congelado |

## Campos em Branco por Regra do XLSX

Estes marcadores existem no XLSX mas **não** têm faixa funcional definida (campo vazio, impreciso ou inaplicável):

| Marcador | Motivo | Tratamento |
|---|---|---|
| **Estradiol (F)** | XLSX diz "~1,0" — impreciso | Sentinel `[0, 9999]` → branco |
| **SHBG (M)** | XLSX sem ref masculina | Sentinel `[0, 9999]` → branco |
| **DHEA-S (M)** | XLSX sem ref masculina | Sentinel `[0, 9999]` → branco |
| **FSH (F)** | XLSX sem ref feminina (fase-dependente) | Sentinel `[0, 9999]` → branco |
| **LH (F)** | XLSX sem ref feminina (fase-dependente) | Sentinel `[0, 9999]` → branco |
| **PSA (F)** | Inaplicável para sexo feminino | Sentinel `[0, 9999]` → branco |
| **Progesterona** | XLSX M="<33" sem unidade, F=vazio | Excluído totalmente |
| **FAI** | XLSX define F<5, M 30-150 mas sem marker_id mapeado | Não implementado |
| **1,25(OH)/25(OH) Vit D** | XLSX diz "1–1,5x (25OH)" — é relação calculada | Não implementado |
| **LH/FSH ratio** | Diagnóstico (SOP), não referência contínua | Não implementado |

## Marcadores Removidos (não presentes no XLSX)

Estes **não** fazem parte da baseline e **não** devem ter referência funcional:

- `bilirrubina_total`
- `igf1`
- `amh`
- `colesterol_nao_hdl`
- `vhs`

## Erros Tipográficos Conhecidos no XLSX

| Marcador | XLSX diz | Valor correto | Justificativa |
|---|---|---|---|
| Zinco | mcg/L | µg/dL | Valores 90–120 só fazem sentido clínico em µg/dL |
| Cobre | mcg/L | µg/dL | Valores 90–130 só fazem sentido clínico em µg/dL |
| Vitamina A | mcg/L | mg/L | Valores 0.5–0.7 correspondem a retinol em mg/L |

## Como Verificar Integridade

1. A constante `FUNCTIONAL_RANGES_VERSION` em `functionalRanges.ts` deve ser `"FUNC_REF_V1_2026_03_20"`
2. Qualquer alteração nos valores deve atualizar a versão e este documento
3. O changelog em `.lovable/CHANGELOG.md` deve registrar a mudança
4. Testes devem continuar verdes após qualquer modificação

## Próximos Passos (fora desta baseline)

- Implementar FAI (Índice de Androgênio Livre) quando houver marker_id
- Implementar relação 1,25(OH)/25(OH) Vitamina D como calculada
- Expandir para novos marcadores apenas quando houver nova versão do XLSX
