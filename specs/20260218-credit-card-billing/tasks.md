# Task List: Credit Card Billing — Lancamentos no Regime de Caixa

**Branch**: `20260218-credit-card-billing` | **Date**: 2026-02-18
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Phase 1 — Migracao SQL e Schema (base para tudo)

> Cria os campos, enum, constraint, trigger e views no banco. Nenhuma outra fase pode comecar antes desta.

- [x] T001 [US3,US6] Criar migracao `supabase/migrations/20260218_credit_card_billing.sql`: ALTER TYPE `transaction_type` ADD VALUE `'transfer'` (FR-003)
- [x] T002 [US1] Na mesma migracao: ALTER TABLE `transactions` ADD COLUMN `is_credit_card boolean DEFAULT false NOT NULL` (FR-001)
- [x] T003 [US1] Na mesma migracao: ALTER TABLE `transactions` ADD COLUMN `credit_card_bill_date date` (FR-001)
- [x] T004 [US1] Na mesma migracao: ADD CONSTRAINT `transactions_cc_bill_date_chk` CHECK `(NOT (is_credit_card AND status = 'settled' AND credit_card_bill_date IS NULL))` (FR-002)
- [x] T005 [US3] Na mesma migracao: CREATE OR REPLACE FUNCTION `refresh_period_balances()` adicionando `AND t.type <> 'transfer'` em todos os 5 CASE WHEN dos somatorios (FR-006)
- [x] T006 [US3] Na mesma migracao: CREATE OR REPLACE VIEW `v_period_totals` excluindo `transfer` dos CASE WHEN (FR-007)
- [x] T007 [US3] Na mesma migracao: CREATE OR REPLACE VIEW `v_period_totals_by_status` excluindo `transfer` do JOIN/CASE (FR-008)
- [x] T008 [US3] Atualizar `supabase/schema_snapshot.sql` com todos os novos campos, constraint, enum value, trigger e views (FR-005)

**Checkpoint**: Migracao aplicavel sem erro. Dados existentes inalterados (`is_credit_card = false` para todos). Trigger e views excluem `transfer`. Snapshot reflete o estado final.

---

## Phase 2 — Tipos TypeScript

> Atualiza tipos e queries do frontend para refletir o schema. Desbloqueia todas as fases seguintes.

- [x] T009 [P] [US6] Editar `src/types.ts`: adicionar `'transfer'` ao type `TransactionType` (FR-003)
- [x] T010 [P] [US1] Editar `src/types.ts`: adicionar `is_credit_card: boolean` e `credit_card_bill_date: string | null` ao type `TransactionRow` (FR-001)
- [x] T011 [P] [US4] Editar `src/types.ts`: adicionar `isCreditCard: boolean` e `creditCardBillDate: string` ao type `TransactionForm`
- [x] T012 [US1] Editar `src/hooks/useTransactions.ts`: adicionar `is_credit_card, credit_card_bill_date` na lista de colunas do `.select()` (linha 32)
- [x] T013 [US4] Editar `src/hooks/useTransactions.ts`: atualizar `defaultForm` com `isCreditCard: false` e `creditCardBillDate: ""`

**Checkpoint**: Build passa sem erros TS. Queries retornam os novos campos. Nenhuma mudanca visual ainda.

---

## Phase 3A — Importacao de CSV de Cartao (US1)

> Fluxo principal da feature. Adiciona campo de data de pagamento no modal e ajusta a logica de confirmacao.

- [x] T014 [US1] Editar `src/hooks/useImport.ts`: adicionar estado `cardBillDate: string` e setter `setCardBillDate` (FR-009)
- [x] T015 [US1] Editar `src/hooks/useImport.ts`: expor `isCardStatement` derivado de `isLikelyCardStatement(importFileName)` no return do hook (FR-009)
- [x] T016 [US1] Editar `src/hooks/useImport.ts`: criar funcao `ensurePeriodForDate(workspaceId, date)` que busca periodo fiscal contendo a data ou cria um novo; retorna `{ periodId, created, closed }` (FR-012, FR-013, FR-014, FR-024)
- [x] T017 [US1] Editar `src/hooks/useImport.ts`: no `confirmMutation`, quando `cardBillDate` preenchido: (a) chamar `ensurePeriodForDate` para resolver `period_id`, (b) abortar se `closed`, (c) usar `period_id` resolvido em vez de `period.id` (FR-012, FR-013, FR-014)
- [x] T018 [US1] Editar `src/hooks/useImport.ts`: no `confirmMutation`, quando `cardBillDate`: ajustar cada entry do `entriesPayload` para incluir `is_credit_card: true`, `credit_card_bill_date: cardBillDate`, `settled_at: cardBillDate`, `status: 'settled'` (FR-010)
- [x] T019 [US1] Editar `src/hooks/useImport.ts`: expor `cardBillDate`, `setCardBillDate` e `isCardStatement` no return do hook
- [x] T020 [US1] Editar `src/hooks/useImport.ts`: adicionar validacao — se `isCardStatement && !cardBillDate`, setar feedback "Informe a data de pagamento da fatura." e nao prosseguir (edge case: CSV de cartao sem data)
- [x] T021 [US1] Editar `src/hooks/useImport.ts`: no `clearPreview`/`resetImport`, resetar `cardBillDate` para `""`
- [x] T022 [US1] Editar `src/features/entries/ImportModal.tsx`: renderizar campo `<input type="date">` com label "Data de pagamento da fatura" quando `isCardStatement`, abaixo do seletor de arquivo (FR-009)
- [x] T023 [US1] Editar `src/features/entries/ImportModal.tsx`: adicionar validacao visual — borda `var(--danger)` quando `isCardStatement && !cardBillDate` e usuario tenta confirmar
- [x] T024 [US1] Editar `src/features/entries/ImportModal.tsx`: exibir mensagem informativa quando `isCardStatement && cardBillDate`: "Lancamentos serao alocados em [Mes/Ano] (periodo da data de pagamento)"

**Checkpoint**: Importar CSV de cartao com 5 linhas informando data de pagamento 08/02/2026. Verificar que todos os lancamentos aparecem no periodo de fevereiro com `settled_at = 2026-02-08`, `is_credit_card = true`, `credit_card_bill_date = 2026-02-08`, `planned_date` = data original do CSV. Verificar que importar sem data de pagamento e bloqueado.

---

## Phase 3B — Badge de Cartao na Listagem (US2)

> Pode rodar em paralelo com Phase 3A. Toca apenas `EntriesPage.tsx` e `styles.css`.

- [x] T025 [P] [US2] Editar `src/styles.css`: adicionar classe `.pill.credit-card` com fundo `var(--accent-soft)`, texto `var(--accent)`, borda `var(--line)`, font-size `0.75rem`, font-weight 500, border-radius `var(--radius-sm)` (FR-017)
- [x] T026 [P] [US6] Editar `src/styles.css`: adicionar classe `.pill.transfer` com fundo `var(--surface-soft)`, texto `var(--ink-secondary)` (FR-003)
- [x] T027 [US2] Editar `src/features/entries/EntriesPage.tsx` (modo lista): na renderizacao de cada row, se `t.is_credit_card`, exibir pill com icone SVG de cartao (inline, 14px) + texto "pago em DD/MM" formatado com `format(parseISO(t.credit_card_bill_date), 'dd/MM')` (FR-017)
- [x] T028 [US2] Editar `src/features/entries/EntriesPage.tsx` (modo lista): na coluna de data, exibir `t.planned_date` quando `t.is_credit_card && t.planned_date`, mantendo logica existente para os demais (FR-019)
- [x] T029 [US2] Editar `src/features/entries/EntriesPage.tsx` (modo board): exibir o mesmo badge de cartao nos cards do board view (FR-018)

**Checkpoint**: Lancamentos com `is_credit_card = true` exibem badge "pago em DD/MM" tanto em lista quanto board. Data exibida e a data original da compra. Lancamentos normais inalterados.

---

## Phase 3C — Somatorios e Transfer no Frontend (US3, US6)

> Pode rodar em paralelo com 3A e 3B. Ajusta labels, filtros e pills para o tipo `transfer`.

- [x] T030 [P] [US6] Editar `src/features/entries/EntriesPage.tsx`: no select de filtro de tipo, adicionar opcao "Transferencia" mapeada para `'transfer'` (FR-003)
- [x] T031 [P] [US6] Editar `src/features/entries/EntriesPage.tsx`: no select de tipo do formulario (novo/edicao), adicionar opcao "Transferencia" (FR-003)
- [x] T032 [US6] Editar `src/features/entries/EntriesPage.tsx`: na renderizacao de pills de tipo, adicionar case `'transfer'` com label "Transferencia" e classe `.pill.transfer`

**Checkpoint**: Tipo `transfer` e selecionavel em filtros e formulario. Pill de transfer renderiza com cores neutras. Somatorios de `period_balances` ja excluem `transfer` (feito na migracao).

---

## Phase 4 — Formulario Manual de Lancamento de Cartao (US4)

> Depende de Phase 2. Adiciona checkbox e campo de data de pagamento no formulario de criacao/edicao.

- [x] T033 [US4] Editar `src/features/entries/EntriesPage.tsx` (form modal): adicionar checkbox "Lancamento de cartao de credito" visivel quando `form.type === 'expense'`, com state derivado de `form.isCreditCard` (FR-020)
- [x] T034 [US4] Editar `src/features/entries/EntriesPage.tsx` (form modal): quando checkbox marcado, exibir campo `<input type="date">` "Data de pagamento da fatura" vinculado a `form.creditCardBillDate`; obrigatorio se `form.status === 'settled'` (FR-021)
- [x] T035 [US4] Editar `src/hooks/useTransactions.ts` (`useSaveTransaction`): no payload, quando `form.isCreditCard`: setar `is_credit_card: true`, `credit_card_bill_date: form.creditCardBillDate || null` (FR-020)
- [x] T036 [US4] Editar `src/hooks/useTransactions.ts` (`useSaveTransaction`): quando `form.isCreditCard && form.creditCardBillDate`: resolver `period_id` via funcao `ensurePeriodForDate()` (importar de useImport ou extrair para utils) em vez de usar `input.periodId` (FR-022)
- [x] T037 [US4] Editar `src/features/entries/EntriesPage.tsx`: ao abrir formulario para edicao de lancamento existente, popular `isCreditCard` e `creditCardBillDate` a partir de `TransactionRow.is_credit_card` e `TransactionRow.credit_card_bill_date`

**Checkpoint**: Criar lancamento manual marcando "Cartao de credito" com data de compra 20/01 e data de pagamento 08/02. Verificar: lancamento no periodo de fevereiro, `planned_date = 2026-01-20`, `settled_at = 2026-02-08`, badge visivel. Editar lancamento existente de cartao e verificar que campos sao populados corretamente.

---

## Phase 5 — Deteccao de Transfer no Extrato Bancario (US5)

> Ultimo passo. Detecta pagamento de fatura em extratos bancarios e sugere tipo `transfer`.

- [x] T038 [P] [US5] Editar `src/utils/importHelpers.ts`: adicionar funcao `isBankStatementBillPayment(description: string): boolean` com regex `/fatura|pgto\s*cart|nubank|visa\s*payment|mastercard|pagamento.*cartao/i` (FR-015)
- [x] T039 [US5] Editar `src/hooks/useImport.ts`: na `previewFile`, quando nao-card mode (`!cardMode`): para cada row, chamar `isBankStatementBillPayment(row.description)`; se true, sugerir `type: 'transfer'` e setar `errorReason` com mensagem informativa (FR-015)
- [x] T040 [US5] Editar `src/hooks/useImport.ts`: criar novo status de preview `'transfer_sugerido'` ou reutilizar mecanismo existente para que o usuario possa alterar o tipo sugerido (FR-016)
- [x] T041 [US5] Editar `src/features/entries/ImportModal.tsx`: na preview, quando tipo sugerido e `transfer`, exibir pill "Transferencia" com tooltip/mensagem explicativa; permitir ao usuario alterar tipo para `expense` (FR-016)

**Checkpoint**: Importar CSV bancario com linha "PGTO FATURA NUBANK R$5.250". Verificar que a preview mostra tipo `transfer` sugerido. Alterar para `expense` e verificar que importa normalmente. CSV sem padroes de fatura nao e afetado.

---

## Phase 6 — Polish e Validacao Final

> Tarefas transversais de qualidade e consistencia.

- [x] T042 [P] Varrer codebase por refs a `TransactionType` e `transaction_type` que possam ignorar `'transfer'` (ex.: board grouping, dashboard charts, formatadores). Corrigir se necessario.
- [x] T043 [P] Verificar build completo (`npm run build`) — zero erros TypeScript (SC-005)
- [x] T044 Teste manual end-to-end: importar CSV de cartao com 10+ linhas, verificar periodo, badge, somatorios, formulario de edicao
- [x] T045 Atualizar `references/licoes-aprendidas.md` com decisoes e riscos relevantes desta feature

---

## Dependencies

### Phase Dependencies

```
Phase 1 (SQL)
  └─→ Phase 2 (Types)
       ├─→ Phase 3A (Import) ─── paralelo
       ├─→ Phase 3B (Badge) ──── paralelo
       ├─→ Phase 3C (Transfer UI) ── paralelo
       └─→ Phase 4 (Form Manual)
            └─→ Phase 5 (Transfer Detection)
                 └─→ Phase 6 (Polish)
```

### User Story Dependencies

| User Story | Depende de |
|-----------|------------|
| US1 (Import cartao) | Phase 1 + Phase 2 |
| US2 (Badge) | Phase 1 + Phase 2 |
| US3 (Somatorios) | Phase 1 (trigger/views ja resolvem) |
| US4 (Form manual) | Phase 1 + Phase 2 + logica de `ensurePeriodForDate` (de US1/T016) |
| US5 (Transfer extrato) | Phase 1 + Phase 2 + US6 |
| US6 (Tipo transfer) | Phase 1 + Phase 2 |

### Parallel Opportunities

| Grupo | Tasks | Razao |
|-------|-------|-------|
| A | T009, T010, T011 | Edicoes independentes em `src/types.ts` (linhas distintas) |
| B | T025, T026 | Classes CSS independentes em `src/styles.css` |
| C | Phase 3A, Phase 3B, Phase 3C | Tocam arquivos/secoes distintas, sem dependencia cruzada |
| D | T030, T031 | Secoes distintas do mesmo arquivo |
| E | T038 (importHelpers) + T025/T026 (CSS) | Arquivos completamente distintos |
| F | T042, T043 | Validacoes independentes |

---

## FR Coverage Matrix

| FR | Task(s) |
|----|---------|
| FR-001 | T002, T003, T008, T010 |
| FR-002 | T004, T008 |
| FR-003 | T001, T008, T009, T026, T030, T031, T032 |
| FR-004 | T002, T003 (defaults) |
| FR-005 | T008 |
| FR-006 | T005 |
| FR-007 | T006 |
| FR-008 | T007 |
| FR-009 | T014, T015, T019, T022 |
| FR-010 | T018 |
| FR-011 | T018 (planned_date = occurrenceDate) |
| FR-012 | T016, T017 |
| FR-013 | T016 |
| FR-014 | T017, T020 |
| FR-015 | T038, T039 |
| FR-016 | T040, T041 |
| FR-017 | T025, T027 |
| FR-018 | T029 |
| FR-019 | T028 |
| FR-020 | T033, T035 |
| FR-021 | T034 |
| FR-022 | T036 |
| FR-023 | — (RLS existente cobre) |
| FR-024 | T016 |
