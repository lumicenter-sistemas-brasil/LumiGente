# LumiGente

Monorepo contendo os módulos **backend** e **frontend** do projeto LumiGente.

## Estrutura

- `LumiGente-main/backend/` – API Node.js + Express, integrações com SQL Server e serviços de e-mail/notificações.
- `LumiGente-main/frontend/` – Aplicação web com HTML/CSS/JS modularizada por funcionalidades.
- `.cursor/` – Configurações de automação da IDE (não versionadas).
- `service/` – Serviços locais/instalações do NSSM (excluídos do versionamento).

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

## Convenções

- Commits seguem o padrão **Conventional Commits**.
- Pull Requests devem incluir descrição e checklist de testes.
- Variáveis sensíveis sempre via `.env` (nunca commitá-las).

## Segurança

- Tokens e chaves permanecem apenas em variáveis de ambiente.
- Todas as novas rotas devem validar autenticação/autorizações conforme `authentication-and-authorization.mdc`.

## Contato

Dúvidas ou suporte: `ti.sistemas@lumicenter.com`.

