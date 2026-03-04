

# Plano: Dupla Checagem de Extração de Laudos PDF

## Diagnóstico: O que já está implementado vs. o que falta

Após auditoria completa do código, muitos dos bugs listados no documento **já foram corrigidos** em iterações anteriores. Segue o status real:

### Já corrigidos (não precisam de ação)

| Bug | Status | Onde |
|-----|--------|------|
| CK ausente | CK já existe no MARKER_LIST (id: `ck`, linha 113) e no MARKERS frontend (linha ~460 do prompt) | Prompt + aliases |
| PCR mg/dL→mg/L | Sanity fix já converte `v < 2.0 → v * 10` (linha 805) | validateAndFixValues |
| Zinco µg/mL→µg/dL | Sanity fix `v < 5 → v * 100` (linha 780) | validateAndFixValues |
| IGFBP-3 ng/mL→µg/mL | Sanity fix `v > 100 → v / 1000` (linha 746) | validateAndFixValues |
| Progesterona ng/dL→ng/mL | Sanity fix + deterministic conv (linhas 739, 861) | validateAndFixValues |
| Estradiol ng/dL→pg/mL | Sanity fix + deterministic conv (linhas 740, 860) | validateAndFixValues |
| DHT ng/dL→pg/mL | Sanity fix + deterministic conv (linhas 749, 862) | validateAndFixValues |
| Testosterona Livre pmol/L→ng/dL | Sex-aware fix (linhas 729-731) | validateAndFixValues |
| Cobalto, Arsênico, Níquel | Já existem no MARKER_LIST (linhas 138-140) | Edge function |
| Anti-Endomísio, Anti-Transglutaminase | Já existem (linhas 143-144) | Edge function |
| Testosterona Biodisponível | Já existe (linha 68) | Edge function |
| Cross-check anti-alucinação | Já implementado (crossCheckAllMarkers, linhas 2607-2636) | Edge function |
| Vitamina B12 falso positivo (B-12 vs B12) | Identificado, precisa correção | crossCheckAllMarkers |

### Bugs reais que ainda precisam de correção

| # | Bug | Causa raiz | Prioridade |
|---|-----|-----------|------------|
| 1 | **Vitamina B12 descartada pelo cross-check** | "B-12" no PDF não casa com "b12" nos termos de busca | P1 |
| 2 | **TSH lab_ref captura faixa etária** | "20 a 59 a: 0,45 a 4,5" → AI captura "20 a 59" como referência | P2 (parcialmente mitigado pelo sanity check que descarta refs incompatíveis) |
| 3 | **Lipídios: AI seleciona faixa "Ótimo" ao invés de "Desejável"** | Laudos Fleury listam múltiplas faixas categorizadas (Ótimo, Desejável, Limítrofe, Alto). AI escolhe a mais restritiva | P2 |
| 4 | **VLDL referência invertida** | AI extrai ">= 20" (faixa etária) ao invés de "< 30" | P2 (mitigado pelo sanity bounds do resolveReference) |
| 5 | **Bug de data: DD/MM/YYYY → MM/DD/YYYY** | AI pode inverter dia/mês; regex fallback já existente mas pode falhar | P2 |
| 6 | **HbA1c valor incorreto (5.1 vs 4.8)** | Possível confusão entre resultado e referência no PDF; não há fix determinístico possível sem reprovar com PDF | P1 (investigar) |
| 7 | **Vitamina B12: 1028 ng/L reportado como 561 pg/mL** | AI pode confundir valor de B12 com outro marcador; ng/L = pg/mL (conversão 1:1), 561 ≠ 1028 → dado errado da AI | P1 (investigar) |
| 8 | **Ácido Úrico 7.0 lido como 77** | Ponto decimal perdido; sanity range `acido_urico: min 0.5, max 15` mas não tem fix function | P1 |

## Correções propostas

### Arquivo: `supabase/functions/extract-lab-results/index.ts`

#### 1. Corrigir falso positivo de Vitamina B12 no cross-check
Normalizar hífens entre letras e números no `pdfLower` dentro de `crossCheckAllMarkers`:
```
pdfLower = pdfLower.replace(/([a-z])-(\d)/gi, '$1$2')
```
Isso resolve "B-12"→"B12", "IGF-1"→"IGF1", "CA-125"→"CA125" etc.

#### 2. Adicionar fix para Ácido Úrico no sanity ranges
Adicionar fix function para `acido_urico` que detecta ponto decimal perdido:
```
acido_urico: { min: 0.5, max: 15, fix: (v) => v > 15 ? v / 10 : v }
```
77 → 7.7 (dentro do range).

#### 3. Instrução no prompt para lipídios estratificados
Adicionar regra no prompt para que a AI selecione a faixa "Desejável" (padrão geral) ao invés de "Ótimo" para lipídios com categorias:
```
LIPÍDIOS COM CATEGORIAS (Colesterol Total, LDL, Não-HDL, Triglicerídeos):
When a lab report shows multiple risk categories (Ótimo, Desejável, Limítrofe, Alto),
ALWAYS use the "Desejável" threshold as the reference range.
Example: LDL categories "Ótimo < 100, Desejável 100-129, Alto >= 160"
→ use lab_ref_text = "< 130" (upper bound of Desejável)
```

#### 4. Reforçar instrução de parsing de data no prompt
Adicionar regra explícita:
```
DATE FORMAT: Brazilian dates are ALWAYS DD/MM/YYYY (day first, month second).
"05/11/2025" = November 5, 2025 (NOT May 11, 2025).
```

#### 5. Adicionar sanity check para VLDL referência
Na função `parseLabRefRanges` ou como pós-processamento, se o `lab_ref_text` do VLDL contiver ">=" ou ">" com valor < 30, descartar (é faixa etária):
```
if (r.marker_id === 'vldl' && refText && /^[>≥]/i.test(refText.trim())) {
  // VLDL is "lower is better" — ">=" operator is nonsensical → discard
  delete r.lab_ref_text; delete r.lab_ref_min; delete r.lab_ref_max;
}
```

### Arquivo: `src/lib/markers.ts`

Nenhuma alteração necessária — as definições de marcadores e labRanges já estão corretas. Os labRanges são faixas genéricas de referência (fallback) e não devem ser alterados para refletir um laboratório específico (Fleury). O sistema já prioriza o `lab_ref_text` extraído do PDF quando disponível.

### Sobre a proposta de "4 prompts em cadeia" do documento

A estratégia de 4 prompts sequenciais (extração → cruzamento → correções → código TypeScript) **não é recomendada** para implementação porque:
1. Multiplicaria o custo por 4x (4 chamadas à AI por extração)
2. Aumentaria a latência de ~15s para ~60s
3. O cross-check determinístico já implementado (`crossCheckAllMarkers` + `validateAndFixValues`) resolve o mesmo problema de forma mais rápida e confiável
4. O Prompt 4 (geração de código) é estático e já está implementado como funções TypeScript

A abordagem atual (1 prompt + pós-processamento determinístico multicamada) é superior para o caso de uso.

## Resumo de alterações

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `extract-lab-results/index.ts` | Normalizar hífens no cross-check |
| 2 | `extract-lab-results/index.ts` | Adicionar fix para ácido_urico no sanity |
| 3 | `extract-lab-results/index.ts` | Instrução no prompt para lipídios "Desejável" |
| 4 | `extract-lab-results/index.ts` | Instrução explícita DD/MM/YYYY no prompt |
| 5 | `extract-lab-results/index.ts` | Sanity check para VLDL referência invertida |

