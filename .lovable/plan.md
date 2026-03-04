

# Plano: Limpar dados existentes de urina_hemoglobina/urina_hemacias

## Diagnóstico

Os registros problemáticos no banco são **dados antigos** importados antes da adição do código anti-alucinação:

| id | marker_id | text_value | Problema |
|---|---|---|---|
| `62969658...` | `urina_hemoglobina` | `16,3 g/dL 13,3 a 16,5` | Hemoglobina do sangue |
| `aa4b5c4c...` | `urina_hemacias` | `5,59 milhões/mm3 4,32 a 5,67` | Eritrócitos do sangue |

O código anti-alucinação atual na edge function **já trata esses casos para novas importações** (linha 1014 verifica `text_value` com g/dL, milhões, mm³). O problema é que esses registros foram criados antes dessa proteção existir.

## Correções

### 1. Deletar os 2 registros incorretos no banco

```sql
DELETE FROM lab_results 
WHERE id IN (
  '62969658-b0c6-4ab2-bee5-676f44d789ac',
  'aa4b5c4c-fb9a-4f9f-9d13-66498373437a'
);
```

### 2. Reforço: verificar `text_value` na seção anti-alucinação principal

Adicionar checagem de `text_value` (não só `r.value`) nas seções de `urina_hemoglobina` e `urina_hemacias` (linhas 916-998), como defesa em profundidade caso o Gemini mude o formato de saída.

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Deletar 2 registros incorretos |
| `supabase/functions/extract-lab-results/index.ts` | Adicionar checagem de `text_value` na anti-alucinação principal |

