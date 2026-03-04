

## Diagnóstico do Problema de Rolagem

O problema de rolagem após importar exames está relacionado à estrutura de layout do `EvolutionTable.tsx` e possivelmente ao `PatientDetail.tsx`. Analisando o código:

### Problemas Identificados

1. **EvolutionTable**: A tabela de evolução usa `ScrollArea` com `ScrollBar orientation="horizontal"` para scroll horizontal, mas não tem controle de altura máxima. Quando há muitos marcadores, a tabela cresce indefinidamente, forçando o scroll da página inteira ao invés de conter o scroll dentro da área visível.

2. **AppLayout**: O layout usa `min-h-screen` com `flex-1` no `<main>`, mas sem restrição de altura. Isso permite que o conteúdo cresça sem limite, quebrando o scroll interno dos componentes.

3. **Regressões recorrentes**: A raiz do problema é que não há uma estrutura de contenção de altura consistente. Cada correção pontual (como `min-h-0` no EditExtractionDialog) resolve um caso mas não o padrão geral.

### Plano de Correção

**1. AppLayout — Contenção de altura (src/components/AppLayout.tsx)**
- Mudar o `<main>` de `flex-1` simples para `flex-1 min-h-0 overflow-y-auto`, garantindo que o conteúdo role dentro do main ao invés de expandir a página.

**2. EvolutionTable — Scroll vertical controlado (src/components/EvolutionTable.tsx)**  
- Envolver a tabela em um container com `max-h-[70vh] overflow-auto` para que a tabela de evolução tenha scroll próprio quando há muitos marcadores, sem empurrar o resto da página.
- Manter o `ScrollArea` horizontal existente para colunas de sessões.

**3. PatientDetail — Tabs content overflow (src/pages/PatientDetail.tsx)**
- Garantir que o `TabsContent` da aba "evolution" tenha `overflow-hidden` para conter o scroll do EvolutionTable.

### Arquivos a Alterar
- `src/components/AppLayout.tsx` — ajuste no main
- `src/components/EvolutionTable.tsx` — max-height na tabela
- `src/pages/PatientDetail.tsx` — overflow no TabsContent de evolução

