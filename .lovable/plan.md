
Objetivo: corrigir o erro “não está deixando importar PDF” garantindo que o fluxo de importação/salvamento só rode com sessão autenticada válida no backend.

Diagnóstico confirmado
- O problema não é o parser do PDF em si.
- Na tentativa de salvar a sessão após importar, as requisições de criação de sessão estão indo com token anônimo (não autenticado), então a política de segurança bloqueia o INSERT.
- Evidência: na timeline de rede, o POST de criação de sessão retorna `new row violates row-level security policy for table "lab_sessions"` e o header de autorização está com token anônimo.
- Por isso o usuário consegue preencher/extraír, mas falha no “Salvar”.

Plano de implementação
1) Criar guarda de autenticação antes de operações críticas
- Arquivo: `src/pages/PatientDetail.tsx`
- Adicionar helper `ensureAuthenticated()` para:
  - checar sessão atual (`auth.getSession`)
  - tentar renovar sessão (`auth.refreshSession`) se necessário
  - abortar operação com mensagem amigável se continuar sem sessão
- Aplicar essa guarda no início de:
  - `processPdfFile` (importação)
  - `handleSaveSession` (persistência)
  - opcionalmente `handleGenerateAnalysis`/`handleReportConfirm` para consistência

2) Falhar cedo com UX clara (sem erro técnico de RLS)
- Arquivo: `src/pages/PatientDetail.tsx`
- Substituir erro cru por toast orientativo:
  - “Sua sessão expirou. Faça login novamente para importar/salvar.”
- Redirecionar para `/auth` após confirmação, preservando contexto quando possível.

3) Fortalecer sincronização de sessão no app
- Arquivo: `src/contexts/AuthContext.tsx`
- Melhorar tratamento de mudanças de sessão para evitar estado visual “logado” com cliente sem token válido.
- Garantir que eventos de auth reflitam rapidamente na UI e nas rotas protegidas.

4) Blindagem de fluxo para evitar falso “não existe sessão no dia”
- Arquivo: `src/pages/PatientDetail.tsx`
- Hoje, sem autenticação, a checagem de sessão existente retorna vazio e o app tenta criar nova sessão (que falha por segurança).
- Após `ensureAuthenticated()`, essa checagem só ocorrerá com sessão válida, evitando caminho incorreto.

5) Telemetria mínima para depuração futura
- Arquivo: `src/pages/PatientDetail.tsx`
- Log técnico discreto (dev-only) quando operação for abortada por sessão ausente, para acelerar diagnóstico sem expor detalhes ao usuário final.

Arquivos previstos
- `src/pages/PatientDetail.tsx` (principal)
- `src/contexts/AuthContext.tsx` (reforço de sessão)
- `src/components/ProtectedRoute.tsx` (apenas se necessário para UX de redirecionamento)

Banco de dados / migrações
- Não precisa migração.
- Não alterar políticas de segurança (o bloqueio atual está correto).

Validação (E2E)
1) Login → abrir paciente Julia → importar PDF → salvar:
- Deve criar/atualizar sessão sem erro de segurança.
2) Forçar sessão expirada (ou limpar sessão) → tentar importar/salvar:
- Deve exibir aviso de sessão expirada e redirecionar para login (sem erro técnico).
3) Repetir importação no mesmo dia:
- Deve respeitar lógica de sessão existente sem cair em tentativa inválida.
4) Confirmar no fluxo visual:
- Importação continua preenchendo campos; salvamento persiste normalmente após autenticação válida.

Resultado esperado
- O usuário volta a importar PDF normalmente.
- Quando houver expiração de sessão, o sistema orienta re-login de forma clara, sem “erro silencioso” nem mensagem de RLS.
