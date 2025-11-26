Estabelece pipelines de CI/CD para validar código automaticamente antes do deploy.

rules:
  - Configure pipelines de CI/CD (GitHub Actions, GitLab CI, etc.)
  - Execute lint, testes e build automaticamente antes de cada deploy
  - Bloqueie o deploy se houver falhas de segurança ou testes quebrados
  - Automatize verificação de vulnerabilidades (npm audit, snyk, dependabot)
  - Gere relatórios de build e qualidade de código