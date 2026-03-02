

# Melhorias no Pipeline de IA -- Implementacao Iterativa

## Status Atual (TUDO IMPLEMENTADO ✅)

### Já existia antes
- `response_format: { type: "json_object" }` para forcar JSON
- Verificacao de `finish_reason` com log de warning
- `tryFixTruncatedJson` + `extractPartialAnalysis` como fallback
- Validacao de `enrichedResults.length === 0` antes de chamar a IA
- Tratamento de erros 429 e 402 na edge function

### Iteracao 1 ✅: max_tokens dinamico por modo
- `analysis_only` -> 6000
- `protocols_only` -> 8000
- `full` -> 16384

### Iteracao 2 ✅: Flag `_truncated` no response
- `_truncated: true` quando `finish_reason === 'length'`
- `_diagnostics` inclui `max_tokens`, `mode`, `duration_ms`

### Iteracao 3 ✅: Mapeamento de erros no frontend
- `handleAiError()` mapeia 429 e 402 para toasts especificos
- Truncamento gera toast warning sugerindo modo Somente Analise
- `_diagnostics` logado no console

### Iteracao 4 ✅: Tabela ai_call_logs
- Tabela criada com RLS (practitioner ve apenas seus logs)
- Edge function insere registro fire-and-forget apos cada chamada
- Campos: practitioner_id, patient_id, specialty_id, mode, input_tokens, output_tokens, finish_reason, success, error_type, duration_ms
