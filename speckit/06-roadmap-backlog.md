# Roadmap and Backlog (Speckit)

## 1. Roadmap por trimestre

## Q1 2026 - Foundation confiavel
- Multi-tenant completo (`workspace_id` + RLS + RBAC).
- Fechamento mensal e recorrencia automatica idempotente.
- Auditoria de acoes criticas.
- Correcoes de UX base (responsividade e consistencia PT-BR).

Criterio de saida:
- 0 vazamento entre workspaces em testes automatizados de RLS.
- Fechamento mensal executado sem acao manual fora do sistema em 95% dos casos piloto.

## Q2 2026 - Core Finance Pro
- Importador CSV/OFX v1 com preview e dedupe.
- Orcamento v1 (orcado x realizado x desvio).
- Dashboard avancado v1.
- Board de lancamentos v1 (read-only + DnD com trilha de auditoria).

Criterio de saida:
- usuario consegue operar fluxo financeiro mensal sem planilha externa.

## Q3 2026 - Investimentos e conciliacao
- Investimentos v1 (ativos, operacoes, posicoes).
- Conciliacao basica investimentos x ledger.
- Board v2 (CRUD visual, resize/reorder, zoom/pan com fallback acessivel).

Criterio de saida:
- visao consolidada de caixa + patrimonio com consistencia validada.

## Q4 2026 - Integracoes e escala SaaS
- Open Finance via agregador (piloto controlado).
- Canal WhatsApp v1 com confirmacao humana.
- Billing e add-ons com feature flags por workspace.
- Operacao de onboarding para clientes pagantes.

Criterio de saida:
- onboarding ponta a ponta de cliente pagante com trilha auditavel.

## 2. Proximas entregas detalhadas (8-10 semanas)

## Sprint S1 - Isolamento e governanca de acesso (2 semanas)

Escopo:
- E01 (multi-tenant model) e E02 (membership and roles), incluindo migracoes restantes.

Criterios de aceite:
- todas as tabelas de negocio com `workspace_id` e policy RLS ativa.
- perfis `owner|admin|viewer` respeitados em API e UI.
- suite de teste de autorizacao cobrindo casos positivos e negativos.

Dependencias:
- schema base estabilizado em `supabase_ddl.sql`.

Impactos:
- Dados: backfill de `workspace_id` e indices compostos.
- Seguranca: revisao obrigatoria de RLS por tabela.
- Operacao: playbook de rollback de migracao e monitoramento de erros de policy.

Riscos e mitigacao:
- risco de bloquear acesso legitimo por policy restritiva.
- mitigar com staging + testes de contrato por papel antes de prod.

## Sprint S2 - Fechamento mensal e recorrencia automatica (2 semanas)

Escopo:
- E12 (novo): materializacao automatica de recorrencias por competencia.
- hardening do fechamento mensal com idempotencia.

Criterios de aceite:
- abrir competencia gera recorrencias esperadas sem duplicidade.
- reprocessar job nao altera resultado final (idempotencia comprovada).
- discrepancias entre previsto e realizado sao auditadas por evento.

Dependencias:
- S1 concluido para evitar processar dados fora do workspace.

Impactos:
- Dados: ajuste em `recurrence_rules`, `entries` e `monthly_balances`.
- Seguranca: jobs executam em contexto de servico com escopo minimo.
- Operacao: metricas de sucesso/falha de materializacao com alerta.

Riscos e mitigacao:
- risco de duplicacao por corrida entre jobs.
- mitigar com chave idempotente e lock transacional por workspace+mes.

## Sprint S3 - Importador financeiro v1 (2-3 semanas)

Escopo:
- E05 (upload, parser, preview, dedupe e confirmacao).
- cobertura inicial para CSV e OFX.

Criterios de aceite:
- taxa de dedupe >= 99% em dataset de regressao.
- preview mostra impacto antes de gravar no ledger.
- importacao parcial com erro nao compromete linhas validas.

Dependencias:
- S1 para seguranca de isolamento.
- taxonomia de categorias minimamente estavel.

Impactos:
- Dados: `import_jobs` e `import_job_rows` com trilha completa.
- Seguranca: sanitizacao de arquivo e limite de tamanho por plano.
- Operacao: fila assincrona, retries com backoff e DLQ para falhas.

Riscos e mitigacao:
- risco de mapear coluna errada e gerar classificacao indevida.
- mitigar com tela de validacao obrigatoria + regra de confirmacao explicita.

## Sprint S4 - Orcamento v1 + dashboard basico (2-3 semanas)

Escopo:
- E03 (orcamento mensal por categoria) e E07 parcial (KPIs essenciais).

Criterios de aceite:
- CRUD de orcamento por ciclo mensal com historico.
- relatorio `orcado x realizado x desvio` por categoria e total.
- dashboard carrega em <2s p95 para workspace de referencia.

Dependencias:
- S2 concluido para base mensal confiavel.

Impactos:
- Dados: novas consultas em `budget_lines` e `budget_snapshots`.
- Seguranca: politicas RLS especificas para budget.
- Operacao: metricas de latencia e cache de consultas agregadas.

Riscos e mitigacao:
- risco de queda de performance em agregacoes.
- mitigar com indices e materialized view de apoio.

## 3. Backlog priorizado por valor x risco

Prioridade `P0` (imediato):
- E01 Multi-tenant model.
- E02 Membership and roles.
- E12 Recorrencia automatica idempotente.
- E05 Financial imports v1.
- E03 Budget module v1.

Prioridade `P1` (curto prazo):
- E07 Dashboard advanced v1.
- E11 Board de Lancamentos v1 (B0-B2).
- E06 Card statements v1.

Prioridade `P2` (medio prazo):
- E04 Investments module v1.
- E08 Billing and add-ons.
- E09 WhatsApp channel v1.
- E10 LGPD operations (workflow DSAR completo).

## 4. Plano incremental do Board de Lancamentos

## B0 - Discovery e prototipo (2 semanas)
- validar UX inspirada em planilha.
- selecionar stack de DnD + zoom/pan.
- fechar modelo de persistencia minimo.

Criterio de saida:
- prototipo navegavel aprovado por owner + 2 usuarios piloto.

## B1 - Board read-only (2 semanas)
- grupos e cards por status.
- filtros por mes, grupo e categoria.
- alternancia lista <-> board para o mesmo dataset.

Criterio de saida:
- 100% de consistencia visual com consulta de lancamentos.

## B2 - DnD com reclassificacao transacional (3 semanas)
- mover card entre grupos/categorias.
- atualizar ledger e board na mesma transacao.
- registrar `audit_logs` por operacao.

Criterio de saida:
- 0 inconsistencia entre board e ledger em suite E2E.

## B3 - CRUD visual e layout persistente (3 semanas)
- criar/editar/excluir grupos e cards no board.
- resize/reorder de grupos.
- versionamento de layout com rollback.

Criterio de saida:
- restauracao de layout por workspace sem perda apos deploy.

## B4 - Zoom/pan, mobile e rollout (2 semanas)
- zoom/pan com limites.
- fallback sem drag para acessibilidade.
- feature flag por workspace e rollout progressivo.

Criterio de saida:
- erro critico zero no piloto de 2 semanas.

## 5. Definition of Ready (DoR)

Um item so entra em sprint quando:
- escopo e fronteira funcional estao descritos.
- criterio de aceite e metrica de sucesso estao definidos.
- impacto em dados, seguranca e operacao foi mapeado.
- dependencia externa esta resolvida ou isolada por spike.

## 6. Definition of Done (DoD)

Uma entrega so fecha quando:
- testes automatizados passaram (unitario + integracao + regressao critica).
- migration e rollback foram testados em staging.
- revisao de RLS/policies foi aprovada.
- telemetria minima esta em producao (logs + metricas + alerta).
- documentacao em `speckit/` foi atualizada com decisao e trade-offs.
