# Implementation Plan: Credit Card Billing — Lancamentos no Regime de Caixa

**Branch**: `20260218-credit-card-billing` | **Date**: 2026-02-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/20260218-credit-card-billing/spec.md`

## Summary

Permitir que despesas de cartao de credito sejam importadas e gerenciadas no regime de caixa. Cada lancamento individual preserva sua data original de compra (em `planned_date`) e categoria, mas todos os lancamentos de uma mesma fatura compartilham a data de pagamento da fatura (em `settled_at` e `credit_card_bill_date`) e pertencem ao periodo fiscal do pagamento. Transacoes do tipo `transfer` sao adicionadas para representar movimentacoes entre contas (pagamento de fatura no extrato bancario), excluidas de todos os somatorios.

**Abordagem tecnica**: Estender o schema existente com 2 novos campos na tabela `transactions` (`is_credit_card`, `credit_card_bill_date`) e 1 novo valor no enum `transaction_type` (`transfer`). Ajustar trigger de saldos e views. Estender o fluxo de importacao (hook + modal) para suportar data de pagamento da fatura. Adicionar badge visual e campos no formulario manual.

## Technical Context

**Language/Version**: TypeScript 5.x (React 18 + Vite)
**Primary Dependencies**: React, TanStack Query, TanStack Router, Supabase JS, date-fns
**Storage**: PostgreSQL 15+ via Supabase (RLS, triggers, views)
**Testing**: Manual (sem suite automatizada estabelecida)
**Target Platform**: Web (desktop-first, responsivo)
**Project Type**: SPA com backend Supabase
**Performance Goals**: Import de 100+ linhas < 5s; queries de periodo < 2s p95
**Constraints**: Multi-tenant com RLS obrigatorio; UTF-8 em todos os arquivos
**Scale/Scope**: ~15 arquivos afetados (1 migracao SQL, ~10 arquivos TS/TSX, 1 CSS, 1 schema snapshot)

## Constitution Check

| Principio | Status | Notas |
|-----------|--------|-------|
| I. Workspace Isolation | OK | Novos campos sao colunas de `transactions`, ja protegida por RLS. Auto-create de periodo respeita `workspace_id`. |
| II. Single Auth Source | OK | Nenhuma mudanca em auth. |
| III. Type and Schema Consistency | OK | Migracao SQL + snapshot update + tipos TS atualizados. |
| IV. UX and Visual Identity | OK | Badge usa tokens existentes (`--accent-soft`, `--accent`, `--radius-sm`). |
| V. Feature Modularity | OK | Mudancas confinadas ao modulo `entries` e hooks relacionados. |
| VI. Spec-First Delivery | OK | Spec completa com 24 FRs e 6 SCs antes da implementacao. |
| VII. Operational Safety | OK | Migracao com campos nullable/defaulted nao impacta dados existentes. Trigger ajustado ignora `transfer` nos calculos. |

## Project Structure

### Documentation (this feature)

```text
specs/20260218-credit-card-billing/
├── spec.md              # Especificacao da feature (pronto)
├── plan.md              # Este arquivo
└── tasks.md             # Sera gerado por /speckit.tasks
```

### Source Code — Arquivos Afetados

```text
supabase/
├── migrations/
│   └── 20260218_credit_card_billing.sql       # CRIAR — migracao com novos campos, enum e trigger
└── schema_snapshot.sql                         # MODIFICAR — atualizar com novos campos

src/
├── types.ts                                    # MODIFICAR — TransactionType, TransactionRow, TransactionForm
├── hooks/
│   ├── useImport.ts                            # MODIFICAR — logica de fatura, periodo override
│   └── useTransactions.ts                      # MODIFICAR — select, save, toggle com novos campos
├── utils/
│   └── importHelpers.ts                        # MODIFICAR — detectBillPaymentInBankStatement()
├── features/entries/
│   ├── ImportModal.tsx                          # MODIFICAR — campo data pagamento, logica card mode
│   └── EntriesPage.tsx                         # MODIFICAR — badge, formulario, date display
└── styles.css                                  # MODIFICAR — classes para badge e pill transfer
```

**Structure Decision**: Projeto segue estrutura SPA existente. Nenhum arquivo novo de componente necessario — as mudancas se encaixam nos arquivos existentes. A unica criacao e o arquivo de migracao SQL.

## Decisoes Tecnicas

### D1: Reutilizar `planned_date` para data original da compra

**Decisao**: Armazenar a data original da compra no campo `planned_date` existente, em vez de criar um campo novo.

**Justificativa**: O campo ja existe, e nullable, e semanticamente alinhado — e a "data de referencia" do gasto. A `settled_at` carrega a data de pagamento da fatura. `credit_card_bill_date` serve como campo dedicado e consultavel para queries de fatura.

**Risco**: Se `planned_date` precisar de semantica diferente para cartao no futuro, `credit_card_bill_date` ja oferece alternativa.

### D2: `credit_card_bill_date` como campo dedicado

**Decisao**: Manter `credit_card_bill_date` separado de `settled_at`, mesmo que tenham o mesmo valor para lancamentos de cartao realizados.

**Justificativa**: `settled_at` pode ser alterado pelo usuario (toggle planned/settled). `credit_card_bill_date` e o vinculo permanente com a fatura. Permite queries como `WHERE credit_card_bill_date = '2026-02-08'` para agrupar lancamentos de uma fatura sem depender do status.

### D3: Enum `transfer` no `transaction_type`

**Decisao**: Adicionar `'transfer'` ao enum em vez de criar flag `exclude_from_totals`.

**Justificativa**: Mais expressivo. O enum ja controla a logica de somatorios no trigger e views. `ALTER TYPE ... ADD VALUE` e seguro no Supabase (PG 15+). Alinha com o modelo da industria.

### D4: Periodo override na importacao de cartao

**Decisao**: Quando importando CSV de cartao com data de pagamento, todos os lancamentos vao para o periodo do pagamento (ignorando o periodo selecionado no UI).

**Justificativa**: No regime de caixa, o dinheiro sai no mes do pagamento. O sistema deve comunicar claramente: "Lancamentos serao alocados em Fevereiro 2026 (periodo da data de pagamento)."

**Impacto em `useImport.ts`**: `confirmMutation` atualmente usa `period.id` fixo. Para cartao, precisa resolver `period_id` a partir de `credit_card_bill_date`, criando o periodo se necessario.

### D5: Deteccao de transfer (US5) — sugestao nao-bloqueante

**Decisao**: Detectar pagamento de fatura no extrato bancario e sugerir `transfer`, sem bloquear.

**Justificativa**: False positives sao possiveis. Nao bloquear evita frustrar o usuario.

## Mapeamento Spec → Codigo

### US1: Vincular Lancamentos a Fatura (P1)

| FR | Arquivo | Mudanca |
|----|---------|---------|
| FR-009 | `useImport.ts` | Novo estado `cardBillDate: string`; detectar card mode via `isLikelyCardStatement()` |
| FR-009 | `ImportModal.tsx` | Renderizar `<input type="date">` quando `isCardStatement`, abaixo do file input |
| FR-010 | `useImport.ts` | Em `confirmMutation`: se `cardBillDate`, setar `is_credit_card=true`, `credit_card_bill_date`, `settled_at=cardBillDate`, `status='settled'` |
| FR-011 | `useImport.ts` | `planned_date` ja usa `row.occurrenceDate` — manter (linha 336) |
| FR-012 | `useImport.ts` | Resolver `period_id` do `cardBillDate`: buscar ou criar periodo fiscal |
| FR-013 | `useImport.ts` | Funcao `ensurePeriodForDate(workspaceId, date)`: busca periodo existente, cria se nao existir |
| FR-014 | `useImport.ts` | Verificar `closed_at` do periodo resolvido; se fechado, setar feedback de erro e abortar |

### US2: Badge na Listagem (P1)

| FR | Arquivo | Mudanca |
|----|---------|---------|
| FR-017 | `EntriesPage.tsx` | Na renderizacao de cada row (modo lista), se `t.is_credit_card`: pill com "pago em DD/MM" |
| FR-018 | `EntriesPage.tsx` | No board view, mesmo badge no card component |
| FR-019 | `EntriesPage.tsx` | Coluna de data: exibir `planned_date` quando `is_credit_card && planned_date`, senao manter logica atual |

### US3: Somatorios (P1)

| FR | Arquivo | Mudanca |
|----|---------|---------|
| FR-006 | migracao SQL | Em `refresh_period_balances()`: adicionar `AND t.type <> 'transfer'` em todos os 5 CASE WHEN |
| FR-007 | migracao SQL | `CREATE OR REPLACE VIEW v_period_totals`: adicionar `WHERE t.type <> 'transfer'` ou filtrar nos CASE |
| FR-008 | migracao SQL | `CREATE OR REPLACE VIEW v_period_totals_by_status`: idem |

### US4: Formulario Manual (P2)

| FR | Arquivo | Mudanca |
|----|---------|---------|
| FR-020 | `EntriesPage.tsx` | Checkbox "Cartao de credito" visivel quando `form.type === 'expense'` |
| FR-021 | `EntriesPage.tsx` | Campo `creditCardBillDate` condicional; obrigatorio se checkbox + status settled |
| FR-022 | `useTransactions.ts` | Em `useSaveTransaction`: se `isCreditCard`, resolver `period_id` da data de pagamento |
| — | `types.ts` | Adicionar `isCreditCard: boolean` e `creditCardBillDate: string` ao `TransactionForm` |

### US5: Deteccao de Transfer em Extrato (P2)

| FR | Arquivo | Mudanca |
|----|---------|---------|
| FR-015 | `importHelpers.ts` | Nova funcao `isBankStatementBillPayment(desc)` com regex expandido: `fatura\|pgto\s*cart\|nubank\|visa\s*payment\|mastercard\|pagamento.*cartao` |
| FR-015 | `useImport.ts` | Na `previewFile`, quando nao-card mode: chamar `isBankStatementBillPayment()` e sugerir tipo `transfer` |
| FR-016 | `ImportModal.tsx` | Permitir que o usuario altere o tipo sugerido para qualquer linha na preview |

### US6: Tipo Transfer (P2)

| FR | Arquivo | Mudanca |
|----|---------|---------|
| FR-003 | migracao SQL | `ALTER TYPE transaction_type ADD VALUE 'transfer'` |
| FR-003 | `types.ts` | `TransactionType = "income" \| "expense" \| "investment" \| "transfer"` |
| — | `styles.css` | `.pill.transfer` com cores neutras (`--surface-soft`, `--ink-secondary`) |
| — | `EntriesPage.tsx` | Labels/filtros: adicionar opcao "Transferencia" onde houver filtro de tipo |

### Migracao SQL e Schema (base para tudo)

| FR | Arquivo | Mudanca |
|----|---------|---------|
| FR-001 | migracao SQL | `ALTER TABLE transactions ADD COLUMN is_credit_card boolean DEFAULT false NOT NULL` |
| FR-001 | migracao SQL | `ALTER TABLE transactions ADD COLUMN credit_card_bill_date date` |
| FR-002 | migracao SQL | `ADD CONSTRAINT transactions_cc_bill_date_chk CHECK (NOT (is_credit_card AND status = 'settled' AND credit_card_bill_date IS NULL))` |
| FR-003 | migracao SQL | `ALTER TYPE transaction_type ADD VALUE 'transfer'` |
| FR-005 | `schema_snapshot.sql` | Atualizar com novos campos, constraint, enum value, trigger e views |
| — | `types.ts` | `TransactionRow`: adicionar `is_credit_card: boolean` e `credit_card_bill_date: string \| null` |
| — | `useTransactions.ts` | Query select: adicionar `is_credit_card, credit_card_bill_date` na lista de colunas (linha 32) |

## Riscos e Mitigacoes

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Enum ALTER TYPE exige reconexao em PG antigo | Baixo | Supabase PG 15+ suporta sem restart. Testar em staging. |
| Queries existentes com `type IN ('income','expense','investment')` ignoram `transfer` | Medio | Varrer codebase por todas as refs a `transaction_type`. Views e trigger sao corrigidos na migracao. Frontend filtra por tipo em poucos pontos (board grouping, form type select). |
| `planned_date` sobrecarregado com dupla semantica | Medio | `credit_card_bill_date` ja separa a semantica. Documentar no spec. |
| UX: usuario esquece data de pagamento | Alto | Validacao bloqueante: nao confirmar import sem data preenchida. |
| Auto-create de periodo pode criar periodo indesejado | Baixo | Comunicar na UI antes de confirmar ("Periodo Fev/2026 sera criado"). |
| Trigger `refresh_period_balances` mais complexo | Baixo | Mudanca e apenas `AND t.type <> 'transfer'` — nao adiciona JOINs. |

## Dependencias entre Fases

```
Fase 1: Migracao SQL (enum + campos + constraint + trigger + views)
   │
   └─→ Fase 2: Tipos TS (TransactionType, TransactionRow, TransactionForm)
        │
        ├─→ Fase 3A: Import de cartao (useImport + ImportModal) ─── US1
        │
        ├─→ Fase 3B: Badge na listagem (EntriesPage) ─────────── US2
        │
        ├─→ Fase 3C: Somatorios (ja na migracao) ─────────────── US3
        │
        └─→ Fase 4: Formulario manual (EntriesPage + useTransactions) ── US4
             │
             └─→ Fase 5: Transfer no extrato (importHelpers + useImport) ── US5/US6
```

Fases 3A, 3B e 3C podem ser implementadas em paralelo apos Fase 2.
Fase 5 depende de Fase 2 (enum `transfer`) mas e logicamente a ultima.
