# Data Model Specification (Speckit)

## 1. Diretriz central

Todas as entidades de negócio devem conter `workspace_id` para garantir isolamento multi-tenant.

## 2. Entidades base (workspace e acesso)

- `workspaces`
  - `id`, `name`, `slug`, `plan`, `status`, `created_at`
- `workspace_members`
  - `workspace_id`, `user_id`, `role` (`owner|admin|viewer`), `active`
- `workspace_features`
  - `workspace_id`, `feature_code`, `enabled`, `limits_json`

## 3. Núcleo financeiro

- `months`
  - `workspace_id`, `month_start`, `closed_at`
- `category_groups`
  - `workspace_id`, `code`, `name`, `sort_order`
- `categories`
  - `workspace_id`, `group_id`, `code`, `name`, `default_type`, `default_is_recurring`
- `entries`
  - `workspace_id`, `month_id`, `category_id`,
  - `description`, `amount`, `type`, `status`,
  - `planned_date`, `realized_at`, `notes`
- `recurrence_rules`
  - `workspace_id`, `category_id`, `description`, `amount`, `freq`, `day_of_month`, `active`
- `monthly_balances`
  - snapshot mensal agregado.

## 3.1 Extensão para visualização board

- `entry_boards`
  - `id`, `workspace_id`, `name`, `scope` (`global|user`), `owner_user_id`, `active`
- `board_groups`
  - `id`, `workspace_id`, `board_id`, `category_group_id`, `title`,
  - `x`, `y`, `width`, `height`, `z_index`, `color_token`, `sort_order`, `active`
- `board_group_categories`
  - mapeamento de categorias permitidas em cada grupo visual
  - `board_group_id`, `category_id`
- `board_cards`
  - `id`, `workspace_id`, `board_id`, `entry_id`,
  - `board_group_id`, `category_id`,
  - `x`, `y`, `sort_order`, `color_status_override`, `updated_at`
- `board_layout_versions`
  - histórico de layout para rollback: `board_id`, `version`, `snapshot_json`, `created_by`

Regras:
- `board_cards.entry_id` referencia `entries.id`.
- ao mover card para outro grupo/categoria, refletir em `entries.category_id` e/ou grupo correspondente.
- manter trilha em `audit_logs` para operações de drag-and-drop e resize/reorder.

## 4. Investimentos

- `investment_accounts`
  - `workspace_id`, `name`, `institution`, `currency`, `active`
- `investment_assets`
  - `workspace_id`, `ticker`, `name`, `asset_type`, `country`, `currency`, `metadata_json`
- `investment_transactions`
  - `workspace_id`, `account_id`, `asset_id`,
  - `operation_type` (`buy|sell|deposit|withdraw|dividend|interest|fee|tax|amortization`),
  - `quantity`, `unit_price`, `gross_amount`, `net_amount`, `operation_date`, `notes`
- `investment_positions`
  - materialização de posição (ou view calculada).
- `asset_prices`
  - histórico de preços por ativo/data.

## 5. Orçamento

- `budget_cycles`
  - `workspace_id`, `month_start`, `status`
- `budget_lines`
  - `workspace_id`, `cycle_id`, `category_id`, `budget_amount`, `alert_threshold_pct`
- `budget_snapshots`
  - consolidado por categoria/ciclo.

## 6. Integrações e importação

- `integration_connections`
  - `workspace_id`, `provider`, `external_account_id`, `status`, `last_sync_at`
- `import_jobs`
  - `workspace_id`, `source_type`, `status`, `started_at`, `finished_at`, `error_message`
- `import_job_rows`
  - `job_id`, `raw_payload`, `mapped_payload`, `result_status`
- `bank_card_transactions`
  - staging de transações importadas.

## 7. Billing e add-ons (pronto para futuro)

- `subscriptions`
  - `workspace_id`, `plan_code`, `status`, `current_period_start/end`
- `subscription_items`
  - add-ons ativos.
- `billing_events`
  - webhook events de gateway.

## 8. Auditoria e compliance

- `audit_logs`
  - `workspace_id`, `actor_user_id`, `entity`, `entity_id`, `action`, `before_json`, `after_json`, `created_at`
- `data_subject_requests`
  - solicitações LGPD (acesso, anonimização, exclusão, portabilidade).

## 9. Consistência transacional (board x ledger)

- operação de drop deve executar em transação:
  1. atualizar `board_cards`,
  2. atualizar `entries` (categoria/grupo, quando aplicável),
  3. registrar `audit_logs`.
- rollback completo em caso de falha parcial.

## 10. Backlog de migracoes prioritarias (Q1-Q2 2026)

M1 - Isolamento de dados:
- completar `workspace_id` em entidades legadas.
- criar indices compostos (`workspace_id`, `month_start`) e (`workspace_id`, `status`).
- validar constraints para impedir registros sem workspace.

M2 - Recorrencia idempotente:
- incluir chave funcional para materializacao unica por regra+competencia.
- registrar origem de criacao (`source = recurrence_job`) em `entries`.
- preparar tabela de eventos de processamento para auditoria.

M3 - Importador v1:
- endurecer `import_jobs` e `import_job_rows` com estado detalhado.
- armazenar hash canonico para dedupe.
- persistir erro estruturado por linha para suporte.

M4 - Orcamento v1:
- garantir unicidade de `budget_lines` por ciclo+categoria+workspace.
- criar snapshot mensal para comparativo historico.

Criterios de aceite de migracao:
- toda migration com rollback validado em staging.
- nenhuma consulta critica sem filtro por `workspace_id`.
