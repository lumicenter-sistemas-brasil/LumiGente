Implementa autenticação e controle de acesso seguro em APIs e sistemas.

rules:
  - Utilize JWT ou OAuth2 para autenticação
  - Proteja endpoints com middleware de autorização
  - Valide o nível de permissão do usuário antes de executar ações sensíveis
  - Armazene tokens com segurança (cookies HttpOnly + SameSite)
  - Evite expor dados de sessão no frontend