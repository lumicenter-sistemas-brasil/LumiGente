# LumiGente

Sistema de gestão de pessoas e engajamento organizacional desenvolvido para Lumicenter. Plataforma completa para feedbacks, avaliações, pesquisas, objetivos, gamificação e análise de humor da equipe.

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Tecnologias](#tecnologias)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Banco de Dados](#banco-de-dados)
- [Executando o Projeto](#executando-o-projeto)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Estrutura do Banco de Dados](#estrutura-do-banco-de-dados)
- [Migração SQL Server → MySQL](#migração-sql-server--mysql)
- [Arquitetura](#arquitetura)
- [Segurança](#segurança)
- [Contribuindo](#contribuindo)

## 🎯 Sobre o Projeto

O LumiGente é uma plataforma completa de gestão de pessoas que oferece:

- **Feedbacks e Reconhecimentos**: Sistema de feedbacks entre colaboradores com gamificação
- **Avaliações de Desempenho**: Avaliações de 45 e 90 dias, além de avaliações de desempenho completas
- **Humor do Dia**: Registro diário do humor dos colaboradores com análises e tendências
- **Objetivos e PDIs**: Gestão de objetivos organizacionais e planos de desenvolvimento individual
- **Pesquisas**: Sistema completo de pesquisas com filtros por filial e departamento
- **Analytics**: Dashboard completo com métricas de engajamento, humor e objetivos
- **Hierarquia Organizacional**: Sistema de hierarquia baseado em centro de custo
- **Usuários Externos**: Gestão de usuários externos com auditoria completa

## 🛠 Tecnologias

### Backend
- **Node.js** (v18+)
- **Express.js** (v5.1.0)
- **MySQL2** (v3.11.0) - Banco de dados MySQL
- **bcrypt** (v5.1.1) - Hash de senhas
- **Nodemailer** (v7.0.10) - Envio de emails
- **Express-Session** - Gerenciamento de sessões
- **Helmet** - Segurança HTTP
- **Jest** - Testes unitários

### Frontend
- **HTML5/CSS3/JavaScript** (Vanilla)
- **Responsive Design** - Mobile-first
- **Modular Architecture** - Componentes reutilizáveis

## 📁 Estrutura do Projeto

```
LumiGente-main/
├── backend/
│   ├── config/              # Configurações (DB, Session)
│   ├── controllers/         # Controladores das rotas
│   ├── services/            # Lógica de negócio
│   ├── routes/              # Definição de rotas
│   ├── middleware/          # Middlewares (Auth, Security, Error)
│   ├── jobs/                # Jobs agendados (Cron)
│   ├── scripts/             # Scripts utilitários
│   │   └── setup-mysql-database-complete.js  # Setup completo do banco
│   ├── utils/               # Funções utilitárias
│   ├── server.js            # Arquivo principal do servidor
│   └── .env                 # Variáveis de ambiente
│
└── frontend/
    ├── pages/               # Páginas HTML
    ├── js/
    │   └── modules/         # Módulos JavaScript organizados
    │       ├── auth/        # Autenticação
    │       ├── tabs/        # Abas da aplicação
    │       ├── shared/      # Componentes compartilhados
    │       └── utils/       # Utilitários frontend
    ├── styles/              # Arquivos CSS
    └── assets/              # Imagens, ícones, etc.
```

## 📦 Pré-requisitos

- **Node.js** v18 ou superior
- **MySQL** 8.0 ou superior
- **npm** ou **yarn**
- Acesso ao servidor MySQL (configurado no `.env`)

## 🚀 Instalação

1. **Clone o repositório**
   ```bash
   git clone <repository-url>
   cd LumiGente-main
   ```

2. **Instale as dependências**
   ```bash
   cd backend
   npm install
   ```

3. **Configure as variáveis de ambiente**
   ```bash
   cp .env.example .env  # Se houver um arquivo de exemplo
   # Edite o arquivo .env com suas configurações
   ```

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na pasta `backend/` com as seguintes variáveis:

```env
# Servidor
PORT=3057
NODE_ENV=development
APP_BASE_URL=http://localhost:3057

# Banco de Dados MySQL
DB_HOST=172.16.129.58
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=LumiGente

# Pool de Conexões
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT=30000

# Sessão
SESSION_SECRET=seu_secret_aleatorio_aqui
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_MAX_AGE=28800000

# Email (Nodemailer)
EMAIL_HOST=smtp.exemplo.com
EMAIL_PORT=587
EMAIL_USER=seu_email@exemplo.com
EMAIL_PASS=sua_senha_email
EMAIL_FROM=noreply@lumigente.com

# Sincronização
SYNC_INTERVAL_MINUTES=30
```

Veja a seção [Variáveis de Ambiente](#variáveis-de-ambiente) para a lista completa.

## 🗄️ Banco de Dados

### Setup Inicial

**IMPORTANTE**: Execute o script de setup do banco de dados **ANTES** de iniciar o servidor pela primeira vez.

```bash
cd backend
node scripts/setup-mysql-database-complete.js
```

Este script irá:
- Criar todas as **43 tabelas** necessárias
- Criar **2 views** (vw_SurveysSummary, vw_UserHierarchy)
- Inserir dados iniciais (Roles, TiposAvaliacao)

### Tabelas Populadas via Airflow

As seguintes tabelas devem ser populadas via jobs do Airflow:

- **TAB_HIST_SRA**: Dados de funcionários do sistema de RH (Oracle)
- **HIERARQUIA_CC**: Hierarquia organizacional baseada em centro de custo

> **Nota**: Consulte o arquivo `INFORMACOES_AIRFLOW.md` (se existir) para detalhes sobre a configuração dos jobs do Airflow.

### Estrutura do Banco

O banco de dados MySQL contém:

- **43 tabelas** principais
- **2 views** para consultas otimizadas
- **Índices** otimizados para performance
- **Foreign Keys** para integridade referencial

Principais tabelas:
- `Users` - Usuários do sistema
- `Roles` - Perfis de acesso
- `Feedbacks` - Feedbacks entre colaboradores
- `Recognitions` - Reconhecimentos com gamificação
- `DailyMood` - Humor diário dos colaboradores
- `Avaliacoes` - Avaliações de 45/90 dias
- `AvaliacoesDesempenho` - Avaliações de desempenho
- `Objetivos` - Objetivos organizacionais
- `PDIs` - Planos de Desenvolvimento Individual
- `Surveys` - Pesquisas
- `TAB_HIST_SRA` - Histórico de funcionários (populado via Airflow)
- `HIERARQUIA_CC` - Hierarquia organizacional (populada via Airflow)

## ▶️ Executando o Projeto

### Modo Desenvolvimento

```bash
cd backend
npm run dev
```

O servidor será iniciado com **nodemon** (reinicia automaticamente em mudanças).

### Modo Produção

```bash
cd backend
npm start
```

O servidor estará disponível em: `http://localhost:3057` (ou a porta configurada no `.env`)

### Primeira Execução

1. Execute o setup do banco de dados:
   ```bash
   node scripts/setup-mysql-database-complete.js
   ```

2. Inicie o servidor:
   ```bash
   npm start
   ```

3. Acesse: `http://localhost:3057`

4. Faça login com um usuário administrador (ou crie um via banco de dados)

## 📜 Scripts Disponíveis

### Desenvolvimento
```bash
npm run dev          # Inicia com nodemon (hot reload)
npm start            # Inicia o servidor
```

### Testes
```bash
npm test             # Executa todos os testes
npm run test:watch   # Testes em modo watch
npm run test:coverage # Testes com cobertura
```

### Banco de Dados
```bash
node scripts/setup-mysql-database-complete.js  # Setup completo do banco
```

## 🔐 Variáveis de Ambiente

### Obrigatórias

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DB_HOST` | Host do MySQL | `172.16.129.58` |
| `DB_PORT` | Porta do MySQL | `3306` |
| `DB_USER` | Usuário do MySQL | `root` |
| `DB_PASSWORD` | Senha do MySQL | `sua_senha` |
| `DB_NAME` | Nome do banco | `LumiGente` |
| `SESSION_SECRET` | Secret para sessões | `string_aleatoria` |
| `APP_BASE_URL` | URL base da aplicação | `http://localhost:3057` |

### Opcionais

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor | `3000` |
| `NODE_ENV` | Ambiente | `development` |
| `DB_POOL_MAX` | Máximo de conexões | `10` |
| `SYNC_INTERVAL_MINUTES` | Intervalo de sincronização | `30` |
| `EMAIL_HOST` | SMTP host | - |
| `EMAIL_PORT` | SMTP port | `587` |
| `CORS_ORIGIN` | CORS origin | `*` |

## 🔄 Migração SQL Server → MySQL

O projeto foi migrado de **SQL Server** para **MySQL**. Principais mudanças:

### Sintaxe SQL Convertida

- `GETDATE()` → `NOW()`
- `TOP N` → `LIMIT N`
- `ISNULL()` → `COALESCE()`
- `IDENTITY` → `AUTO_INCREMENT`
- `NVARCHAR/NTEXT` → `VARCHAR/TEXT`
- `BIT` → `TINYINT(1)`
- `OUTPUT INSERTED.Id` → `insertId`
- `DATEADD()` → `DATE_ADD()`
- `STRING_AGG()` → `GROUP_CONCAT()`
- `LEN()` → `LENGTH()`
- `LTRIM(RTRIM())` → `TRIM()`

### Mudanças Arquiteturais

- **HIERARQUIA_CC**: Era uma VIEW no SQL Server (consultava Oracle via Linked Server). No MySQL, é uma **TABELA** populada via Airflow.
- **TAB_HIST_SRA**: Continua sendo tabela, mas agora populada via Airflow diretamente do Oracle.

### Scripts de Migração

Os scripts de migração temporários foram removidos após a conclusão:
- ✅ `sync-test-data.js` (removido)
- ✅ `inspect-sqlserver-schema.js` (removido)
- ✅ `export-sqlserver-data.js` (removido)
- ✅ `setup-mysql-database.js` (versão antiga, removida)

Mantido apenas:
- ✅ `setup-mysql-database-complete.js` (script oficial de setup)

## 🏗️ Arquitetura

### Backend

- **MVC Pattern**: Controllers, Services, Models
- **Clean Architecture**: Separação de responsabilidades
- **Middleware Chain**: Autenticação, segurança, validação
- **Service Layer**: Lógica de negócio isolada

### Frontend

- **Modular**: Módulos JavaScript organizados por funcionalidade
- **Event Delegation**: Eventos delegados para performance
- **Component-Based**: Componentes reutilizáveis
- **Responsive**: Design mobile-first

### Banco de Dados

- **Normalização**: Tabelas normalizadas (3NF)
- **Índices**: Índices otimizados para queries frequentes
- **Foreign Keys**: Integridade referencial
- **Views**: Views para consultas complexas

## 🔒 Segurança

### Implementado

- ✅ **Helmet.js**: Headers de segurança HTTP
- ✅ **CORS**: Configuração de origem
- ✅ **Rate Limiting**: Limite de requisições
- ✅ **bcrypt**: Hash de senhas (salt rounds: 10)
- ✅ **Session Security**: HttpOnly, Secure cookies
- ✅ **Input Sanitization**: Sanitização de inputs
- ✅ **SQL Injection Protection**: Prepared statements
- ✅ **XSS Protection**: Sanitização de outputs
- ✅ **CSRF Protection**: Tokens CSRF (quando aplicável)

### Boas Práticas

- Nunca commitar `.env` no repositório
- Usar variáveis de ambiente para dados sensíveis
- Validar e sanitizar todos os inputs
- Usar prepared statements para queries SQL
- Implementar rate limiting em rotas sensíveis
- Manter dependências atualizadas

## 📝 Contribuindo

1. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
2. Commit suas mudanças (`git commit -m 'feat: Adiciona MinhaFeature'`)
3. Push para a branch (`git push origin feature/MinhaFeature`)
4. Abra um Pull Request

### Convenções de Commit

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` Nova funcionalidade
- `fix:` Correção de bug
- `refactor:` Refatoração de código
- `docs:` Documentação
- `chore:` Tarefas de manutenção
- `test:` Testes
- `style:` Formatação de código

## 📄 Licença

Este projeto é propriedade da Lumicenter. Todos os direitos reservados.

## 👥 Equipe

Desenvolvido pela equipe de desenvolvimento Lumicenter.

## 📞 Suporte

Para dúvidas ou problemas, entre em contato com a equipe de desenvolvimento.