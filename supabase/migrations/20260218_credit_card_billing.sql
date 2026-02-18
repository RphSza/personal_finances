-- Migration: Credit Card Billing — Lancamentos no Regime de Caixa
-- T001: Add 'transfer' to transaction_type enum
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'transfer';

-- T002: Add is_credit_card column
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_credit_card boolean DEFAULT false NOT NULL;

-- T003: Add credit_card_bill_date column
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS credit_card_bill_date date;

-- T004: Constraint — credit_card_bill_date required when is_credit_card + settled
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_cc_bill_date_chk
  CHECK (NOT (is_credit_card AND status = 'settled' AND credit_card_bill_date IS NULL));

-- T005: Update refresh_period_balances() to exclude 'transfer' from all sums
CREATE OR REPLACE FUNCTION public.refresh_period_balances()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_period_id uuid;
  v_workspace_id uuid;
begin
  if TG_OP = 'DELETE' then
    v_period_id := OLD.period_id;
    v_workspace_id := OLD.workspace_id;
  else
    v_period_id := NEW.period_id;
    v_workspace_id := NEW.workspace_id;
  end if;

  insert into period_balances (period_id, workspace_id, income_total, expense_total, recurring_expense, investment_total, net_result, calculated_at)
  select
    v_period_id,
    v_workspace_id,
    coalesce(sum(case when t.type = 'income' and t.status <> 'cancelled' then t.amount end), 0),
    coalesce(sum(case when t.type = 'expense' and t.status <> 'cancelled' then t.amount end), 0),
    coalesce(sum(case when t.type = 'expense' and t.is_recurring and t.status <> 'cancelled' then t.amount end), 0),
    coalesce(sum(case when t.type = 'investment' and t.status <> 'cancelled' then t.amount end), 0),
    coalesce(sum(case when t.type = 'income' and t.status <> 'cancelled' then t.amount end), 0)
      - coalesce(sum(case when t.type in ('expense', 'investment') and t.status <> 'cancelled' then t.amount end), 0),
    now()
  from transactions t
  where t.period_id = v_period_id and t.workspace_id = v_workspace_id and t.type <> 'transfer'
  on conflict (period_id) do update set
    income_total = excluded.income_total,
    expense_total = excluded.expense_total,
    recurring_expense = excluded.recurring_expense,
    investment_total = excluded.investment_total,
    net_result = excluded.net_result,
    calculated_at = excluded.calculated_at;

  if TG_OP = 'UPDATE' and OLD.period_id is distinct from NEW.period_id then
    insert into period_balances (period_id, workspace_id, income_total, expense_total, recurring_expense, investment_total, net_result, calculated_at)
    select
      OLD.period_id,
      OLD.workspace_id,
      coalesce(sum(case when t.type = 'income' and t.status <> 'cancelled' then t.amount end), 0),
      coalesce(sum(case when t.type = 'expense' and t.status <> 'cancelled' then t.amount end), 0),
      coalesce(sum(case when t.type = 'expense' and t.is_recurring and t.status <> 'cancelled' then t.amount end), 0),
      coalesce(sum(case when t.type = 'investment' and t.status <> 'cancelled' then t.amount end), 0),
      coalesce(sum(case when t.type = 'income' and t.status <> 'cancelled' then t.amount end), 0)
        - coalesce(sum(case when t.type in ('expense', 'investment') and t.status <> 'cancelled' then t.amount end), 0),
      now()
    from transactions t
    where t.period_id = OLD.period_id and t.workspace_id = OLD.workspace_id and t.type <> 'transfer'
    on conflict (period_id) do update set
      income_total = excluded.income_total,
      expense_total = excluded.expense_total,
      recurring_expense = excluded.recurring_expense,
      investment_total = excluded.investment_total,
      net_result = excluded.net_result,
      calculated_at = excluded.calculated_at;
  end if;

  return null;
end;
$function$;

-- T006: Update v_period_totals to exclude 'transfer'
CREATE OR REPLACE VIEW public.v_period_totals AS
SELECT fp.workspace_id,
    fp.id AS period_id,
    fp.period_start,
    COALESCE(sum(
        CASE
            WHEN t.type = 'income'::transaction_type AND t.status <> 'cancelled'::transaction_status THEN t.amount
            ELSE NULL::numeric
        END), 0::numeric) AS income_total,
    COALESCE(sum(
        CASE
            WHEN t.type = 'expense'::transaction_type AND t.status <> 'cancelled'::transaction_status THEN t.amount
            ELSE NULL::numeric
        END), 0::numeric) AS expense_total,
    COALESCE(sum(
        CASE
            WHEN t.type = 'expense'::transaction_type AND t.is_recurring AND t.status <> 'cancelled'::transaction_status THEN t.amount
            ELSE NULL::numeric
        END), 0::numeric) AS recurring_expense,
    COALESCE(sum(
        CASE
            WHEN t.type = 'investment'::transaction_type AND t.status <> 'cancelled'::transaction_status THEN t.amount
            ELSE NULL::numeric
        END), 0::numeric) AS investment_total,
    COALESCE(sum(
        CASE
            WHEN t.type = 'income'::transaction_type AND t.status <> 'cancelled'::transaction_status THEN t.amount
            ELSE NULL::numeric
        END), 0::numeric) - COALESCE(sum(
        CASE
            WHEN (t.type = ANY (ARRAY['expense'::transaction_type, 'investment'::transaction_type])) AND t.status <> 'cancelled'::transaction_status THEN t.amount
            ELSE NULL::numeric
        END), 0::numeric) AS net_result
   FROM fiscal_periods fp
     LEFT JOIN transactions t ON t.period_id = fp.id AND t.workspace_id = fp.workspace_id AND t.type <> 'transfer'::transaction_type
  GROUP BY fp.workspace_id, fp.id, fp.period_start;

-- T007: Update v_period_totals_by_status to exclude 'transfer'
CREATE OR REPLACE VIEW public.v_period_totals_by_status AS
SELECT fp.workspace_id,
    fp.id AS period_id,
    fp.period_start,
    t.status,
    COALESCE(sum(
        CASE
            WHEN t.type = 'income'::transaction_type THEN t.amount
            ELSE NULL::numeric
        END), 0::numeric) AS income_total,
    COALESCE(sum(
        CASE
            WHEN t.type = 'expense'::transaction_type THEN t.amount
            ELSE NULL::numeric
        END), 0::numeric) AS expense_total,
    COALESCE(sum(
        CASE
            WHEN t.type = 'investment'::transaction_type THEN t.amount
            ELSE NULL::numeric
        END), 0::numeric) AS investment_total
   FROM fiscal_periods fp
     LEFT JOIN transactions t ON t.period_id = fp.id AND t.workspace_id = fp.workspace_id AND t.type <> 'transfer'::transaction_type
  GROUP BY fp.workspace_id, fp.id, fp.period_start, t.status;
