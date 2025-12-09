# Tabelas e Views do Banco de Dados (ordem alfabética)

**Total de tabelas:** 44  
**Total de views:** 4

**Legenda:**
- **Criação**: `auto` (criada automaticamente na inicialização), `on-demand` (criada quando necessário), `existente` (precisa já existir)
- **População automática**: `sim` (populada por seeds/jobs), `não` (apenas via uso manual)

---

- **AuditLog_Users_External** — Criação: existente; População: não (trigger/auditoria)
- **Avaliacoes** — Criação: auto; População: sim (job diário às 08:00 cria avaliações 45d/90d)
- **AvaliacoesDesempenho** — Criação: existente; População: não (criadas manualmente)
- **CalibragemConsideracoes** — Criação: existente; População: não (uso de calibragem)
- **Calibragens** — Criação: existente; População: não (uso de calibragem)
- **DailyMood** — Criação: existente; População: não (uso de mood diário)
- **FeedbackReactions** — Criação: existente; População: não (reações a feedbacks)
- **FeedbackReplies** — Criação: existente; População: não (respostas a feedbacks)
- **FeedbackReplyReactions** — Criação: existente; População: não (reações a respostas)
- **Feedbacks** — Criação: existente; População: não (criados manualmente)
- **FeedbacksAvaliacaoDesempenho** — Criação: existente; População: não (uso de avaliações)
- **Gamification** — Criação: existente; População: não (pontos por ações)
- **Notifications** — Criação: on-demand (primeiro uso); População: não (conforme notificações)
- **ObjetivoCheckins** — Criação: on-demand (primeiro uso de objetivos); População: não (checkins de objetivos)
- **ObjetivoResponsaveis** — Criação: on-demand (primeiro uso de objetivos); População: não (responsáveis de objetivos)
- **Objetivos** — Criação: on-demand (primeiro uso de objetivos); População: não (criados manualmente)
- **OpcoesPerguntasAvaliacao** — Criação: auto; População: não (snapshot ao criar perguntas)
- **OpcoesPerguntasAvaliacaoDesempenho** — Criação: existente; População: não (opções de perguntas de desempenho)
- **OpcoesQuestionario45** — Criação: existente; População: não (opções do questionário padrão 45 dias)
- **OpcoesQuestionario90** — Criação: existente; População: não (opções do questionário padrão 90 dias)
- **PDICheckins** — Criação: existente; População: não (checkins de PDIs)
- **PDIs** — Criação: existente; População: não (criados manualmente)
- **PerguntasAvaliacao** — Criação: auto; População: não (snapshot ao criar avaliações)
- **PerguntasAvaliacaoDesempenho** — Criação: existente; População: não (perguntas de avaliações de desempenho)
- **QuestionarioPadrao45** — Criação: existente; População: não (questionário padrão 45 dias)
- **QuestionarioPadrao90** — Criação: existente; População: não (questionário padrão 90 dias)
- **Recognitions** — Criação: existente; População: não (reconhecimentos entre usuários)
- **RespostasAvaliacoes** — Criação: auto; População: não (respostas de colaboradores/gestores)
- **RespostasDesempenho** — Criação: existente; População: não (respostas de avaliações de desempenho)
- **Roles** — Criação: existente; População: não (3 registros: roles padrão)
- **SurveyDepartamentoFilters** — Criação: existente; População: não (filtros de departamento em pesquisas)
- **SurveyEligibleUsers** — Criação: existente; População: não (usuários elegíveis para pesquisas)
- **SurveyFilialFilters** — Criação: existente; População: não (filtros de filial em pesquisas)
- **SurveyNotificationLog** — Criação: auto; População: sim (jobs de notificações de pesquisas)
- **SurveyQuestionOptions** — Criação: existente; População: não (opções de perguntas de pesquisas)
- **SurveyQuestions** — Criação: existente; População: não (perguntas de pesquisas)
- **SurveyResponses** — Criação: existente; População: não (respostas de pesquisas)
- **Surveys** — Criação: existente; População: não (pesquisas criadas manualmente)
- **TAB_HIST_SRA** — Criação: existente (fonte externa); População: externa (5.355 registros)
- **TiposAvaliacao** — Criação: auto; População: **sim** (2 registros padrão: 45 dias e 90 dias)
- **UserPoints** — Criação: existente; População: não (pontos totais por usuário)
- **UserRankings** — Criação: existente; População: não (rankings mensais de usuários)
- **Users** — Criação: existente; População: **sim** (sincronizador na inicialização + a cada 30min, 490 registros)
- **sysdiagrams** — Criação: existente (sistema SQL Server); População: não (diagramas do banco)

---

## Views do Banco de Dados

- **HIERARQUIA_CC** — View de hierarquia organizacional (19 colunas); **Usada extensivamente** no código (hierarchyManager, authService, sincronizador, etc.)
- **ULTIMOS_5_PEDIDOS** — View de pedidos recentes (5 colunas); **Não encontrada no código** (possivelmente legado)
- **vw_SurveysSummary** — View resumo de pesquisas com estatísticas (16 colunas); **Usada em** pesquisaController.js
- **vw_UserHierarchy** — View de hierarquia de usuários (27 colunas); **Não encontrada no código** (possivelmente legado)

---

## Resumo por Categoria

### Criadas Automaticamente na Inicialização (6 tabelas)
1. `Avaliacoes`
2. `OpcoesPerguntasAvaliacao`
3. `PerguntasAvaliacao`
4. `RespostasAvaliacoes`
5. `SurveyNotificationLog`
6. `TiposAvaliacao`

### Populadas Automaticamente (3 tabelas)
1. `TiposAvaliacao` — 2 registros padrão (45d e 90d) inseridos na criação
2. `Users` — Sincronizada da `TAB_HIST_SRA` na inicialização e a cada 30 minutos
3. `Avaliacoes` — Criadas automaticamente por job diário às 08:00
4. `SurveyNotificationLog` — Populada por jobs de notificações de pesquisas

### Criadas Sob Demanda (3 tabelas)
1. `Notifications` — Criada no primeiro uso
2. `Objetivos` + `ObjetivoCheckins` + `ObjetivoResponsaveis` — Criadas no primeiro uso de objetivos

### Tabelas Existentes (32 tabelas)
Todas as demais tabelas precisam já existir no banco e são populadas apenas através de uso manual ou operações do sistema.

### Views Utilizadas pelo Sistema (2 views)
1. `HIERARQUIA_CC` — View de hierarquia organizacional, usada extensivamente em múltiplos serviços e controllers
2. `vw_SurveysSummary` — View resumo de pesquisas com estatísticas, usada em pesquisaController.js

### Views Não Utilizadas (2 views)
1. `ULTIMOS_5_PEDIDOS` — View de pedidos recentes (possivelmente legado)
2. `vw_UserHierarchy` — View de hierarquia de usuários (possivelmente legado)
