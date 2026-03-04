

## Diagnóstico: Classificação Errada de Cores na Tabela de Evolução

### Causa Raiz

Analisei os dados reais do banco e encontrei o problema principal: o `lab_ref_text` extraído dos PDFs do Fleury contém referências erradas que estão sendo aceitas pelo filtro de segurança (sanity bounds) porque o limite atual é muito frouxo (20x). Exemplos concretos do Dener:

| Marcador | lab_ref_text (errado) | Valor | labRange correto | Status atual | Status correto |
|---|---|---|---|---|---|
| Creatinina | `> 12` | 1.24 | 0.7–1.3 | **LOW** (vermelho) | NORMAL (verde) |
| Fósforo | `> 13` | 3.8 | 2.5–4.5 | **LOW** (vermelho) | NORMAL (verde) |
| Magnésio | `> 20` | 2.2 | 1.6–2.6 | **LOW** (vermelho) | NORMAL (verde) |
| T4 Livre | `> 20` | 1.4 | 0.7–1.8 | **LOW** (vermelho) | NORMAL (verde) |
| TSH | `20 a 59` (faixa etária!) | 4.0 | 0.27–4.20 | **LOW** (vermelho) | NORMAL (verde) |
| DHEA-S | `35 a 44` (faixa etária!) | 96 | 80–560 | **HIGH** (vermelho) | NORMAL (verde) |
| LDL | `>= 20` | 148 | 0–130 | **NORMAL** (verde) | HIGH (vermelho) |
| Col. Não-HDL | `>= 20` | 170 | 0–160 | **NORMAL** (verde) | HIGH (vermelho) |

O Fleury inclui textos como `>= 20` para HDL (que é correto para HDL) mas a extração por IA acaba aplicando esse mesmo texto para LDL e Colesterol, onde é completamente errado.

### Solução

Reescrever a validação de sanidade (sanity bounds) no `resolveReference` em `src/lib/markers.ts`, substituindo a comparação simples de midpoints por uma validação inteligente por tipo de operador:

**Para referências com operador (`>`, `>=`, `<`, `<=`):**
- Comparar o bound do operador contra o bound correspondente do labRange (min para `>`, max para `<`)
- Se o labRange correspondente é 0 ou sentinel (>= 9000), rejeitar a referência do laudo (impossível validar)
- Ratio máximo: 5x

**Para referências de range (`X a Y`):**
- Comparar midpoints como hoje, mas com ratio reduzido de 20x para 5x

**Validação adicional para operadores `>=`:**
- Se o labRange tem um max finito (< 9000) e a ref é `>= X`, a ref é suspeita porque ignora o limite superior. Rejeitar.

### Arquivos a Alterar
- `src/lib/markers.ts` — função `resolveReference` (linhas ~723-766): reescrever validação de sanity bounds

### Sobre Regressões

O motivo de "quando corrijo uma coisa, outra desconfigurar" é exatamente porque a validação de segurança estava frouxa (20x). Ao apertar para 5x com lógica específica por operador, o sistema passará a descartar referências absurdas da extração e usar o labRange correto como fallback, evitando classificações erradas.

