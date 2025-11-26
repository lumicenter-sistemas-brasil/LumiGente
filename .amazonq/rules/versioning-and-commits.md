Mantém o histórico de código limpo, padronizado e rastreável.
  Segue convenções de commits semânticos, boas práticas de versionamento e commits atômicos significativos.

rules:
  - Use o padrão Conventional Commits:
      feat:, fix:, refactor:, docs:, chore:
  - Commits devem ser curtos, descritivos e representar uma unidade funcional completa.
    Exemplo: ao implementar um novo botão, o commit só deve ser feito quando o botão estiver totalmente funcional (frontend + integração).
  - Evite commits parciais que não representem comportamento real do sistema.
  - Cada commit deve conter apenas mudanças relacionadas entre si.
  - Atualize o arquivo CHANGELOG.md automaticamente quando possível.
  - Mantenha tags de versão consistentes (v1.0.0, v1.1.0 etc.).