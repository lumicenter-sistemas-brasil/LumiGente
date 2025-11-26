Siga práticas modernas de segurança em todo o sistema:
- Nunca exponha dados sensíveis ou chaves no código
- Utilize variáveis de ambiente e conexões seguras
- Evite `eval`, `innerHTML` e scripts inline
- Proteja contra XSS, SQL Injection e CSRF
- Sempre sanitize e valide todos os dados **no frontend e no backend**
  - O frontend deve validar campos antes de enviar (tipos, tamanhos, formatos)
  - O backend deve revalidar tudo que chega (nunca confiar em dados do cliente)
- Use hashing forte para senhas (ex: bcrypt)
- Mantenha dependências atualizadas e seguras