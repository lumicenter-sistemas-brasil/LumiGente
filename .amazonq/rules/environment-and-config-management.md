Garante que as configurações do sistema sejam seguras, padronizadas e não expostas no código.

rules:
  - Utilize arquivos `.env` e bibliotecas de configuração seguras (ex: dotenv)
  - Nunca suba `.env` para o repositório
  - Valide variáveis de ambiente obrigatórias em runtime
  - Centralize todas as configurações em um único módulo (`config/`)
  - Documente cada variável obrigatória no README.md