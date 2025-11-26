# LumiGente

Monorepo contendo os módulos **backend** e **frontend** do projeto LumiGente.

## Estrutura

- `LumiGente-main/backend/` – API Node.js + Express, integrações com SQL Server e serviços de e-mail/notificações.
- `LumiGente-main/frontend/` – Aplicação web com HTML/CSS/JS modularizada por funcionalidades.

## Pré-requisitos

- Node.js 18+
- SQL Server com banco configurado
- Conta SMTP corporativa (para disparo de e-mails)

## Configuração Rápida

### Backend

```bash
cd LumiGente-main/backend
cp .env.example .env   # ajustar variáveis de ambiente
npm install
npm run migrate        # se aplicável aos scripts da pasta scripts/
npm run dev            # executa servidor com nodemon
```

### Frontend

O frontend é uma aplicação estática. Durante o desenvolvimento, utilize um servidor local:

```bash
cd LumiGente-main/frontend
npm install             # se existir tooling opcional
npm run dev             # ou usar o Live Server/serve para HTTP local
```

## Scripts Úteis

- `npm run lint` – validação estática (quando configurado).
- `npm run test` – testes automatizados (quando existentes).
- `npm run build` – build de produção (frontend) quando aplicável.

## CI/CD

O repositório possui pipelines configurados em `.github/workflows/ci.yml` que executam automaticamente:

- Lint e testes do backend (Jest) com geração de cobertura.
- Verificação de formatação/qualidade do frontend via Prettier.
- Auditoria de vulnerabilidades com `npm audit` (nível alto).
- Empacotamento de artefatos backend/frontend (disponibilizados como artefatos do workflow).

Dependabot executa semanalmente (arquivo `.github/dependabot.yml`) para manter dependências npm e GitHub Actions atualizadas.

> Para novos ambientes de deploy, crie workflows adicionais reutilizando os artefatos gerados pela pipeline de CI.

## Convenções

- Commits seguem o padrão **Conventional Commits**.
- Pull Requests devem incluir descrição e checklist de testes.
- Variáveis sensíveis sempre via `.env` (nunca commitá-las).

## Segurança

- Tokens e chaves permanecem apenas em variáveis de ambiente.
- Todas as novas rotas devem validar autenticação/autorizações conforme `authentication-and-authorization.mdc`.

## Contato

Dúvidas ou suporte: `ti.sistemas@lumicenter.com`.

