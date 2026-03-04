

# Plano: Validator Estrutural na Edge Function de Extração

## Resumo

Adicionar uma etapa de validação pós-extração que verifica integridade dos resultados, remove duplicatas, calcula um `quality_score` e retorna `issues[]`. Persistir essas métricas na tabela `lab_sessions`.

## Alterações

### 1. Migration: adicionar colunas em `lab_sessions`

```sql
ALTER TABLE public.lab_sessions 
  ADD COLUMN quality_score numeric DEFAULT NULL,
  ADD COLUMN extraction_issues jsonb DEFAULT '[]'::jsonb;
```

### 2. Edge Function: função `validateExtraction()`

Inserir após `convertLabRefUnits` e antes do return final (~linha 2525):

```typescript
function validateExtraction(results: any[], specialtyId?: string): { 
  results: any[], quality_score: number, issues: { level: string, marker_id?: string, message: string }[] 
}
```

Lógica:
- **marker_id vazio** → error, remove item
- **value e text_value ambos nulos** → error, remove item
- **NaN / Infinity** → error, remove item
- **Negativos** em marcadores que não permitem (todos exceto temperaturas/deltas) → warning, zera valor
- **Duplicatas** do mesmo marker_id → mantém o que tem `lab_ref_text` preenchido ou o primeiro; warning
- **quality_score**: `(validCount / totalExpected) * 0.7 + (withRefCount / validCount) * 0.3`
  - `totalExpected`: número de marcadores no `MARKER_LIST` que são relevantes (usa total extraído como proxy se specialty não disponível)

### 3. Edge Function: alterar resposta

Antes (linha 2553):
```typescript
return new Response(JSON.stringify({ results: validResults, exam_date: examDate }), ...);
```

Depois:
```typescript
const validation = validateExtraction(validResults);
return new Response(JSON.stringify({ 
  results: validation.results, 
  exam_date: examDate,
  quality_score: validation.quality_score,
  issues: validation.issues 
}), ...);
```

### 4. Frontend: persistir quality_score e issues

Em `PatientDetail.tsx`, após criar/reutilizar sessão, salvar as novas colunas:

```typescript
const qualityScore = data?.quality_score ?? null;
const issues = data?.issues ?? [];

// Ao criar/atualizar sessão:
await supabase.from('lab_sessions').update({ 
  quality_score: qualityScore, 
  extraction_issues: issues 
}).eq('id', sessionId);
```

## Arquivos

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Adicionar `quality_score` e `extraction_issues` em `lab_sessions` |
| `supabase/functions/extract-lab-results/index.ts` | Função `validateExtraction` + alterar resposta |
| `src/pages/PatientDetail.tsx` | Persistir quality_score e issues na sessão |

