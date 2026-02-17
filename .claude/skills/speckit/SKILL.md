---
name: speckit
description: Criar, manter e evoluir especificações de produto, arquitetura, dados, segurança, integrações e roadmap deste sistema financeiro. Use quando o usuário pedir documentação estratégica, detalhamento de requisitos, planejamento de módulos (investimentos, orçamento, multi-tenant), definição de backlog, padrões de implementação, LGPD ou decisões técnicas de longo prazo. Antes de responder, ler sempre `references/licoes-aprendidas.md`.
---

# Speckit Skill

## Fluxo obrigatório

1. Ler `references/licoes-aprendidas.md`.
2. Ler o índice em `references/spec-index.md`.
3. Mapear quais specs devem ser atualizadas.
4. Atualizar as specs com:
   - escopo claro,
   - critérios de aceite verificáveis,
   - riscos e mitigação,
   - impactos em dados, segurança e operação.
5. Garantir consistência entre produto, arquitetura, dados e roadmap.

## Estrutura e referências

- Índice: `references/spec-index.md`
- Processo: `references/processo-spec.md`
- Lições aprendidas: `references/licoes-aprendidas.md`

## Regras de qualidade

- Não deixar requisito sem critério de aceite.
- Não propor integração sem tratar idempotência, falhas e segurança.
- Não propor feature multi-tenant sem `workspace_id` e RLS.
- Não propor tratamento de dados pessoais sem seção de LGPD.

## Padrão de saída

Ao final de qualquer atualização de spec, registrar:

1. o que foi alterado;
2. o porquê da decisão;
3. impacto no roadmap;
4. próximos passos objetivos.
