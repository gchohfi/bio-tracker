
# Diagnostico e Correções: "Relatórios Gerados Não Saem"

## Análise do Codigo Atual

Após investigação detalhada do pipeline completo (edge function `analyze-lab-results` -> `generateReport.ts` -> PDF), identifiquei os pontos de falha reais no seu sistema:

## Causas Confirmadas

### 1. H2 Confirmada: Sem controle de `max_tokens` na chamada AI
A chamada ao gateway (linha 890 do edge function) **não define `max_tokens`**. O prompt CERTO pede 3 documentos completos + prescrição tabular + protocolos. Com muitos marcadores, a resposta pode ser truncada silenciosamente. O JSON truncado causa falha no `JSON.parse` (linha 913), que cai no fallback com `full_text: content` e campos vazios, resultando em relatório sem os 3 documentos.

### 2. H1 Confirmada: Fallback do JSON.parse descarta campos estruturados
Quando `JSON.parse` falha (linha 914), o fallback cria um objeto com `summary` cortado e arrays vazios. Os campos `technical_analysis`, `patient_plan` e `prescription_table` ficam `undefined`, e o PDF sai sem os Documentos 1, 2 e 3.

### 3. H3 Parcial: Sem validação de dados antes de chamar a IA
O `handleGenerateAnalysis` e `handleReportConfirm` não verificam se `enrichedResults` tem dados. Se o paciente não tem resultados, a IA recebe lista vazia e responde com texto genérico.

### 4. Problema de modo: `analysis_only` não gera prescrição
Quando o usuário clica "Gerar Análise" (modo `analysis_only`), a instrução no prompt diz para retornar `protocol_recommendations` vazio. Os prompts CERTO do banco, porém, pedem prescrição completa. Conflito: o prompt do banco pede 3 documentos, mas o modo diz "apenas analise". O modelo pode obedecer ao modo e omitir documentos 2 e 3, ou pode tentar gerar tudo e estourar tokens.

## Plano de Correções

### Tarefa 1: Adicionar `max_tokens` e validar resposta na edge function
- Adicionar `max_tokens: 16384` na chamada ao gateway (linha 890)
- Verificar `finish_reason` na resposta (`aiResponse.choices[0].finish_reason`)
- Se `finish_reason === "length"`, logar aviso e tentar extrair JSON parcial
- Melhorar o fallback do `JSON.parse`: tentar limpar o JSON truncado (fechar chaves/colchetes abertos)

### Tarefa 2: Validar dados antes de chamar a IA
- Em `handleGenerateAnalysis` e `handleReportConfirm`, verificar se `enrichedResults.length > 0` antes de invocar a edge function
- Mostrar toast amigável: "Nenhum resultado laboratorial encontrado para analisar"

### Tarefa 3: Ajustar fallback do JSON.parse com extração parcial
- Ao falhar o parse, tentar extrair campos individuais via regex do texto bruto (ex: buscar `"summary":`, `"technical_analysis":`)
- Garantir que mesmo com resposta parcial, o PDF gere o que tiver disponível

### Tarefa 4: Adicionar log de diagnostico na edge function
- Logar `finish_reason`, `usage.completion_tokens`, e tamanho do `content` antes do parse
- Retornar `finish_reason` e `usage` na resposta ao frontend para debug

### Tarefa 5: Tratar conflito de modo vs prompt do banco
- Quando `mode === "analysis_only"` e o prompt do banco pede 3 documentos, adicionar instrução clara no userPrompt: "Gere technical_analysis e patient_plan, mas omita prescription_table e protocol_recommendations"
- Quando `mode === "full"`, não adicionar restrições

## Detalhes Tecnicos

```text
Pipeline atual:
  PatientDetail.tsx
    -> supabase.functions.invoke("analyze-lab-results")
       -> AI Gateway (sem max_tokens!)
       -> JSON.parse (falha silenciosa se truncado)
       -> retorna analysis
    -> generatePatientReport(... , analysis)
       -> verifica aiAnalysis.technical_analysis (undefined se parse falhou)
       -> Documentos 1/2/3 não renderizam

Pipeline corrigido:
  PatientDetail.tsx
    -> valida enrichedResults.length > 0
    -> supabase.functions.invoke("analyze-lab-results")
       -> AI Gateway (max_tokens: 16384)
       -> verifica finish_reason
       -> JSON.parse com fallback robusto
       -> retorna analysis + diagnostics
    -> generatePatientReport(... , analysis)
       -> renderiza o que estiver disponível
```

### Arquivos a modificar:
1. `supabase/functions/analyze-lab-results/index.ts` -- max_tokens, finish_reason, fallback robusto, log
2. `src/pages/PatientDetail.tsx` -- validação pre-chamada, tratamento de resposta parcial
