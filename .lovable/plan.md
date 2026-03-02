

# Melhorias no Pipeline de IA -- Implementacao Iterativa

## Status Atual (ja implementado)
- `max_tokens: 16384` na edge function
- `response_format: { type: "json_object" }` para forcar JSON
- Verificacao de `finish_reason` com log de warning
- `tryFixTruncatedJson` + `extractPartialAnalysis` como fallback
- Validacao de `enrichedResults.length === 0` antes de chamar a IA
- Tratamento de erros 429 e 402 na edge function

## O que falta implementar (4 iteracoes)

### Iteracao 1: Separar max_tokens por modo
**Arquivo:** `supabase/functions/analyze-lab-results/index.ts`

- `analysis_only` -> `max_tokens: 6000` (resposta menor, mais rapida e barata)
- `protocols_only` -> `max_tokens: 8000`
- `full` -> `max_tokens: 16384` (manter atual)
- Calcular dinamicamente antes da chamada a IA

### Iteracao 2: Retornar erro estruturado ao frontend quando truncado
**Arquivo:** `supabase/functions/analyze-lab-results/index.ts`

Atualmente o `finish_reason === 'length'` apenas gera um `console.warn` e tenta extrair parcialmente. Melhorar para:
- Incluir campo `_truncated: true` no response quando `finish_reason === 'length'`
- Manter o fallback parcial (nao quebrar), mas sinalizar ao frontend

### Iteracao 3: Mapear erros no frontend com mensagens claras
**Arquivo:** `src/pages/PatientDetail.tsx`

Nos 3 blocos `catch` (handleGenerateAnalysis, handleGenerateProtocols, handleReportConfirm):
- Detectar erros HTTP especificos (429, 402) vindos do invoke e mostrar toasts diferenciados
- Verificar `_truncated` no response e mostrar toast warning: "Analise pode estar incompleta. Considere usar o modo Somente Analise."
- Verificar `_diagnostics` para log no console

### Iteracao 4: Tabela ai_call_logs (opcional, observabilidade)
**Migracao SQL + Edge function**

- Criar tabela `ai_call_logs` com campos: `patient_id`, `specialty_id`, `mode`, `input_tokens`, `output_tokens`, `finish_reason`, `success`, `error_type`, `duration_ms`, `created_at`, `practitioner_id`
- RLS: practitioner so ve seus proprios logs
- Na edge function, inserir registro apos cada chamada (fire-and-forget, sem bloquear o response)

## Detalhes tecnicos

### Edge function -- max_tokens dinamico
```text
const MAX_TOKENS_BY_MODE = {
  analysis_only: 6000,
  protocols_only: 8000,
  full: 16384,
};
const maxTokens = MAX_TOKENS_BY_MODE[effectiveMode] ?? 16384;
```

### Frontend -- mapeamento de erros
```text
catch (err) {
  // supabase.functions.invoke retorna { error } com context
  if (err?.context?.status === 429) -> toast rate limit
  if (err?.context?.status === 402) -> toast creditos
  default -> toast generico
}

// Apos sucesso, checar truncamento:
if (analysisData?._truncated) -> toast warning
```

### Tabela ai_call_logs (se aprovado)
```text
CREATE TABLE public.ai_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL,
  patient_id uuid REFERENCES patients(id),
  specialty_id text,
  mode text,
  input_tokens int,
  output_tokens int,
  finish_reason text,
  success boolean DEFAULT true,
  error_type text,
  duration_ms int,
  created_at timestamptz DEFAULT now()
);
-- RLS: practitioner ve apenas seus logs
```

## Sequencia de implementacao
1. max_tokens por modo (edge function)
2. Flag `_truncated` no response (edge function)
3. Mapeamento de erros no frontend (PatientDetail.tsx)
4. Tabela ai_call_logs (migracao + edge function) -- opcional

