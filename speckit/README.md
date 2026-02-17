# Speckit - Master Index

Este diretorio consolida a especificacao de produto e tecnologia para evolucao do sistema de financas pessoais para uma plataforma SaaS multi-tenant.

## Documentos

1. `speckit/01-product-spec.md`
   - Visao, escopo, personas, modulos e requisitos.
2. `speckit/02-architecture-spec.md`
   - Arquitetura de referencia, servicos, frontend, backend e observabilidade.
3. `speckit/03-data-model-spec.md`
   - Modelo de dados alvo (workspaces, financas, investimentos, orcamento, billing).
4. `speckit/04-security-lgpd-spec.md`
   - Seguranca, privacidade, LGPD, retencao e governanca.
5. `speckit/05-integrations-spec.md`
   - Bancos/cartoes, importacoes, WhatsApp e gateways de pagamento.
6. `speckit/06-roadmap-backlog.md`
   - Roadmap por fases, criterios de aceitacao e backlog priorizado.
7. `speckit/07-visual-identity-spec.md`
   - Identidade visual, design tokens e regras de layout para login e modulos principais.

## Como usar

- Trate estes arquivos como **fonte de verdade** para refinamento tecnico e planejamento.
- Leia `LICOES_APRENDIDAS.md` antes de editar qualquer spec.
- Em cada sprint:
  - escolha epicos em `06-roadmap-backlog.md`,
  - detalhe historias no padrao de `01-product-spec.md`,
  - valide impactos em seguranca com `04-security-lgpd-spec.md`.
