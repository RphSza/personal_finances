# Architecture Specification (Speckit)

## 1. Princípios

- Domínio orientado a módulos.
- Multi-tenant desde o banco.
- Segurança como requisito funcional.
- Evolução incremental sem reescrita total.

## 2. Arquitetura alvo

## 2.1 Frontend
- React + TypeScript.
- Camada de estado por domínio (finance, investments, budget, workspace).
- Design system simples (tokens + componentes reutilizáveis).
- Engine de layout para board visual com zoom/pan e drag-and-drop.
- Roteamento:
  - Dashboard
  - Lançamentos
  - Investimentos
  - Orçamento
  - Configurações
  - Administração do workspace

## 2.2 Backend (Supabase-first)
- Postgres como core.
- RLS para isolamento.
- Edge Functions para integrações externas:
  - Open Finance aggregator,
  - WhatsApp webhook,
  - billing gateway.
- Jobs assíncronos para importação e reconciliação.

## 2.3 Serviços lógicos

1. `Ledger Service`
- lançamentos, recorrência, fechamento mensal.

2. `Investment Service`
- operações, posições, cálculo de retorno.

3. `Budget Service`
- orçado x realizado.

4. `Workspace Service`
- membros, papéis, add-ons.

5. `Integration Service`
- conectores bancários, parser de fatura, WhatsApp.

6. `Board Layout Service`
- persiste layout da superfície visual por workspace/usuário,
- aplica regras de movimentação e reclassificação de cards,
- valida permissões e consistência com ledger.

## 2.4 Arquitetura do Board de Lançamentos

- `Board Canvas`: superfície virtual com pan/zoom.
- `Group Containers`: áreas redimensionáveis (largura/altura).
- `Entry Cards`: representação de lançamentos com status visual.
- `DnD Orchestrator`:
  - calcula drop target (grupo/categoria),
  - confirma operação,
  - persiste atualização transacional.
- `Layout Persistence`:
  - salva posição e dimensão de grupos,
  - salva ordenação de grupos e cards.

Diretriz:
- operações visuais devem ser refletidas no domínio financeiro em transação única para evitar inconsistência.

## 3. Padrões de implementação

- Idempotência em importações e webhooks.
- Soft delete quando necessário para trilha de auditoria.
- Versionamento de schema por migration.
- Feature flags por workspace para habilitar módulos.
- Feature flags por workspace para liberar board avançado gradualmente.
- Versionamento de layout do board para evolução sem quebra retrocompatível.

## 4. Observabilidade

- Logs estruturados com correlação (`request_id`, `workspace_id`, `user_id`).
- Métricas:
  - latência por endpoint,
  - falhas de integração,
  - jobs pendentes.
- Alertas:
  - erro em webhook,
  - falha de reconciliação,
  - exceções de autenticação/autorização.
  - falha de persistência em operações de drag-and-drop.

## 4.1 Métricas específicas do board
- tempo médio de interação (drag/drop) por ação,
- taxa de sucesso de drop,
- taxa de rollback por conflito de reclassificação,
- uso de zoom/pan por sessão.

## 5. Estratégia de escalabilidade

- Índices compostos por `workspace_id` + campos de filtro.
- Materialized views para dashboards pesados.
- Particionamento por período (se volume justificar).

## 6. Ambientes

- `dev`, `staging`, `prod`.
- Dados mascarados em staging.
- Gate de qualidade: lint + typecheck + testes + segurança.

## 7. Plano tecnico para proximas entregas

S1 - Multi-tenant e RBAC:
- revisar todas as queries para filtro explicito por `workspace_id`.
- garantir politicas RLS equivalentes a regras da camada de aplicacao.
- adicionar testes de autorizacao por papel (`owner`, `admin`, `viewer`).

S2 - Recorrencia e fechamento:
- executar materializacao em job idempotente por `workspace_id + competencia`.
- usar lock transacional para evitar corrida em processamento paralelo.
- registrar eventos de materializacao e fechamento com `request_id`.

S3 - Importador v1:
- pipeline assincrono `upload -> parse -> preview -> confirm`.
- separar staging (`import_job_rows`) da persistencia final no ledger.
- retries com backoff e DLQ para falhas nao transitorias.

S4 - Orcamento + dashboard:
- consolidacao incremental para consultas abaixo de p95 < 2s.
- materialized view para agregacoes de desvio mensal.
- cache curto por workspace para reduzir custo de leitura.
