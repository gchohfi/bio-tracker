

# Plano: Aplicar todas as correções pendentes

## 1. Anti-alucinação no `extract-lab-results` (já parcialmente implementado)

As travas anti-alucinação (cross-check textual + plausibilidade + prompt reforçado) já estão implementadas no código atual. Não há alterações pendentes neste arquivo.

## 2. Remover "exames recebidos" da análise IA

### Arquivo: `supabase/functions/analyze-lab-results/index.ts` (linha 664)

Alterar a descrição do campo `technical_analysis` no formato JSON de saída:

**De:**
```
"technical_analysis": "DOCUMENTO 1 — ANÁLISE TÉCNICA COMPLETA: texto detalhado com faixas funcionais, cálculos mostrados (ex: HOMA-IR = glicose × insulina / 405), correlações entre marcadores, exames recebidos listados com unidades, exames ausentes sinalizados."
```

**Para:**
```
"technical_analysis": "DOCUMENTO 1 — ANÁLISE TÉCNICA COMPLETA: texto detalhado com faixas funcionais, cálculos mostrados (ex: HOMA-IR = glicose × insulina / 405), correlações entre marcadores, exames ausentes sinalizados. NÃO liste os exames recebidos — eles já são exibidos na interface."
```

### Migration SQL: Atualizar prompts existentes na tabela `analysis_prompts`

Executar UPDATE para remover referências a "exames recebidos" dos prompts de todas as especialidades, substituindo por instrução de não listar.

### Escopo total
- 1 linha editada em `supabase/functions/analyze-lab-results/index.ts`
- 1 operação de UPDATE nos dados da tabela `analysis_prompts`

