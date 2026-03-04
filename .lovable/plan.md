

## Diagnóstico

Consultei os dados do paciente e encontrei o problema raiz:

| Marcador | text_value armazenado | Origem real |
|---|---|---|
| `urina_hemoglobina` | `14,9 g/dL 13,3 a 16,5` | Hemoglobina do SANGUE |
| `urina_hemacias` | `5,09 milhões/mm3 4,32 a 5,67` | Hemácias do SANGUE |

A IA de extração mapeou valores do hemograma para marcadores de urina. O `text_value` contém o resultado + referência concatenados ("14,9 g/dL **13,3 a 16,5**"), e como `labRange` é `[0,0]`, qualquer valor numérico aparece como fora da faixa (vermelho).

## Correções

### 1. Limpar dados incorretos no banco
Deletar os registros de `urina_hemoglobina` e `urina_hemacias` deste paciente que contêm valores de sangue.

### 2. Reforçar anti-alucinação na extração
No `extract-lab-results/index.ts`, adicionar detecção de unidades de sangue no `text_value` dos marcadores de urina:
- Se `urina_hemoglobina` contém "g/dL" ou "g/L" → descartar (é hemoglobina do sangue)
- Se `urina_hemacias` contém "milhões" ou "/mm3" com valor > 1 → descartar (são hemácias do sangue)

### 3. Separar resultado de referência no text_value
Adicionar lógica no pós-processamento para detectar quando o `text_value` contém o resultado concatenado com a referência (padrão: "VALOR UNIDADE MIN a MAX"), e:
- Extrair apenas o valor como `text_value`
- Mover "MIN a MAX" para `lab_ref_text`

## Arquivos

| Arquivo | Alteração |
|---|---|
| Migration SQL | Deletar registros incorretos |
| `supabase/functions/extract-lab-results/index.ts` | Anti-alucinação por unidade + split resultado/referência |

