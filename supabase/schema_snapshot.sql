create type public.recurrence_freq as enum ('monthly', 'yearly');

create type public.transaction_status as enum ('planned', 'settled', 'cancelled');

create type public.transaction_type as enum ('income', 'expense', 'investment', 'transfer');

create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');

create table public.audit_events (
  id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  period_id uuid,
  event_type text not null,
  event_key text not null,
  payload jsonb default '{}'::jsonb not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null
);

create table public.categories (
  id uuid default gen_random_uuid() not null,
  group_id uuid not null,
  workspace_id uuid,
  code text not null,
  name text not null,
  default_type transaction_type not null,
  default_is_recurring boolean default false not null,
  sort_order integer default 0 not null,
  created_by uuid,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.fiscal_periods (
  id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  period_start date not null,
  period_end date generated always as (((period_start + '1 mon -1 days'::interval))::date) stored,
  closed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.groups (
  id uuid default gen_random_uuid() not null,
  workspace_id uuid,
  code text not null,
  name text not null,
  sort_order integer default 0 not null,
  created_by uuid,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.import_job_rows (
  id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  job_id uuid not null,
  period_id uuid not null,
  category_id uuid,
  row_index integer not null,
  description text not null,
  amount numeric(14,2) not null,
  type transaction_type not null,
  occurrence_date date,
  dedupe_key text not null,
  is_duplicate boolean default false not null,
  is_error boolean default false not null,
  error_reason text,
  raw_payload jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null
);

create table public.import_jobs (
  id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  period_id uuid not null,
  created_by uuid not null,
  source_format text not null,
  file_name text not null,
  status text default 'processing'::text not null,
  total_rows integer default 0 not null,
  valid_rows integer default 0 not null,
  duplicate_rows integer default 0 not null,
  error_rows integer default 0 not null,
  imported_rows integer default 0 not null,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table public.period_balances (
  period_id uuid not null,
  workspace_id uuid not null,
  income_total numeric(14,2) default 0 not null,
  expense_total numeric(14,2) default 0 not null,
  recurring_expense numeric(14,2) default 0 not null,
  investment_total numeric(14,2) default 0 not null,
  net_result numeric(14,2) default 0 not null,
  prior_balance numeric(14,2) default 0 not null,
  cumulative_balance numeric(14,2) default 0 not null,
  calculated_at timestamp with time zone default now() not null
);

create table public.recurrences (
  id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  category_id uuid not null,
  description text not null,
  amount numeric(14,2) not null,
  type transaction_type not null,
  frequency recurrence_freq default 'monthly'::recurrence_freq not null,
  day_of_month integer default 1 not null,
  start_month date not null,
  end_month date,
  active boolean default true not null,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.transactions (
  id uuid default gen_random_uuid() not null,
  period_id uuid not null,
  workspace_id uuid not null,
  category_id uuid not null,
  description text not null,
  amount numeric(14,2) not null,
  type transaction_type not null,
  status transaction_status default 'planned'::transaction_status not null,
  is_recurring boolean default false not null,
  planned_date date,
  settled_at date,
  notes text,
  created_by uuid,
  is_credit_card boolean default false not null,
  credit_card_bill_date date,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  recurrence_materialization_key text
);

create table public.user_profiles (
  id uuid not null,
  email text,
  role text default 'client'::text not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.workspace_invites (
  id uuid default gen_random_uuid() not null,
  email text not null,
  role workspace_role not null,
  created_at timestamp with time zone default now() not null,
  accepted_at timestamp with time zone,
  workspace_id uuid not null
);

create table public.workspace_members (
  workspace_id uuid not null,
  user_id uuid not null,
  role workspace_role not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.workspaces (
  id uuid default gen_random_uuid() not null,
  name text not null,
  slug text,
  status text default 'active'::text not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table public.audit_events add constraint audit_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table public.audit_events add constraint audit_events_period_id_fkey FOREIGN KEY (period_id) REFERENCES fiscal_periods(id) ON DELETE SET NULL;

alter table public.audit_events add constraint audit_events_pkey PRIMARY KEY (id);

alter table public.audit_events add constraint audit_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.categories add constraint categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table public.categories add constraint categories_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE RESTRICT;

alter table public.categories add constraint categories_pkey PRIMARY KEY (id);

alter table public.categories add constraint categories_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.groups add constraint category_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table public.groups add constraint category_groups_pkey PRIMARY KEY (id);

alter table public.groups add constraint category_groups_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.fiscal_periods add constraint fiscal_periods_first_day_chk CHECK (period_start = date_trunc('month'::text, period_start::timestamp with time zone)::date);

alter table public.fiscal_periods add constraint fiscal_periods_pkey PRIMARY KEY (id);

alter table public.fiscal_periods add constraint fiscal_periods_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.import_job_rows add constraint import_job_rows_amount_check CHECK (amount >= 0::numeric);

alter table public.import_job_rows add constraint import_job_rows_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

alter table public.import_job_rows add constraint import_job_rows_job_id_fkey FOREIGN KEY (job_id) REFERENCES import_jobs(id) ON DELETE CASCADE;

alter table public.import_job_rows add constraint import_job_rows_period_id_fkey FOREIGN KEY (period_id) REFERENCES fiscal_periods(id) ON DELETE CASCADE;

alter table public.import_job_rows add constraint import_job_rows_pkey PRIMARY KEY (id);

alter table public.import_job_rows add constraint import_job_rows_row_index_check CHECK (row_index > 0);

alter table public.import_job_rows add constraint import_job_rows_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.import_jobs add constraint import_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table public.import_jobs add constraint import_jobs_period_id_fkey FOREIGN KEY (period_id) REFERENCES fiscal_periods(id) ON DELETE CASCADE;

alter table public.import_jobs add constraint import_jobs_pkey PRIMARY KEY (id);

alter table public.import_jobs add constraint import_jobs_source_format_check CHECK (source_format = ANY (ARRAY['csv'::text, 'ofx'::text]));

alter table public.import_jobs add constraint import_jobs_status_check CHECK (status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text]));

alter table public.import_jobs add constraint import_jobs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.period_balances add constraint period_balances_period_id_fkey FOREIGN KEY (period_id) REFERENCES fiscal_periods(id) ON DELETE CASCADE;

alter table public.period_balances add constraint period_balances_pkey PRIMARY KEY (period_id);

alter table public.period_balances add constraint period_balances_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.recurrences add constraint recurrences_amount_check CHECK (amount >= 0::numeric);

alter table public.recurrences add constraint recurrences_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;

alter table public.recurrences add constraint recurrences_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table public.recurrences add constraint recurrences_day_of_month_check CHECK (day_of_month >= 1 AND day_of_month <= 31);

alter table public.recurrences add constraint recurrences_end_month_chk CHECK (end_month IS NULL OR end_month = date_trunc('month'::text, end_month::timestamp with time zone)::date);

alter table public.recurrences add constraint recurrences_period_chk CHECK (end_month IS NULL OR end_month >= start_month);

alter table public.recurrences add constraint recurrences_pkey PRIMARY KEY (id);

alter table public.recurrences add constraint recurrences_start_month_chk CHECK (start_month = date_trunc('month'::text, start_month::timestamp with time zone)::date);

alter table public.recurrences add constraint recurrences_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.transactions add constraint transactions_amount_check CHECK (amount >= 0::numeric);

alter table public.transactions add constraint transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT;

alter table public.transactions add constraint transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table public.transactions add constraint transactions_period_id_fkey FOREIGN KEY (period_id) REFERENCES fiscal_periods(id) ON DELETE CASCADE;

alter table public.transactions add constraint transactions_pkey PRIMARY KEY (id);

alter table public.transactions add constraint transactions_cc_bill_date_chk CHECK (NOT (is_credit_card AND status = 'settled'::transaction_status AND credit_card_bill_date IS NULL));

alter table public.transactions add constraint transactions_settled_date_chk CHECK (status = 'settled'::transaction_status AND settled_at IS NOT NULL OR status <> 'settled'::transaction_status);

alter table public.transactions add constraint transactions_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.user_profiles add constraint user_profiles_email_key UNIQUE (email);

alter table public.user_profiles add constraint user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.user_profiles add constraint user_profiles_pkey PRIMARY KEY (id);

alter table public.user_profiles add constraint user_profiles_role_check CHECK (role = ANY (ARRAY['internal'::text, 'client'::text]));

alter table public.workspace_invites add constraint workspace_invites_pkey PRIMARY KEY (id);

alter table public.workspace_invites add constraint workspace_invites_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.workspace_members add constraint workspace_members_pkey PRIMARY KEY (workspace_id, user_id);

alter table public.workspace_members add constraint workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.workspace_members add constraint workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.workspaces add constraint workspaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table public.workspaces add constraint workspaces_pkey PRIMARY KEY (id);

alter table public.workspaces add constraint workspaces_slug_key UNIQUE (slug);

alter table public.workspaces add constraint workspaces_status_check CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]));

CREATE INDEX idx_audit_events_workspace_type_created ON public.audit_events USING btree (workspace_id, event_type, created_at DESC);

CREATE INDEX idx_categories_deleted_at ON public.categories USING btree (deleted_at);

CREATE INDEX idx_categories_workspace ON public.categories USING btree (workspace_id);

CREATE INDEX idx_category_groups_deleted_at ON public.groups USING btree (deleted_at);

CREATE INDEX idx_category_groups_workspace ON public.groups USING btree (workspace_id);

CREATE INDEX idx_import_job_rows_job ON public.import_job_rows USING btree (job_id, row_index);

CREATE INDEX idx_import_job_rows_workspace_dedupe ON public.import_job_rows USING btree (workspace_id, dedupe_key);

CREATE INDEX idx_import_jobs_workspace_created ON public.import_jobs USING btree (workspace_id, created_at DESC);

CREATE INDEX idx_import_jobs_workspace_period ON public.import_jobs USING btree (workspace_id, period_id, created_at DESC);

CREATE INDEX idx_recurrences_active_period ON public.recurrences USING btree (active, start_month, end_month);

CREATE INDEX idx_recurrences_workspace ON public.recurrences USING btree (workspace_id, active);

CREATE INDEX idx_transactions_category ON public.transactions USING btree (category_id);

CREATE INDEX idx_transactions_period ON public.transactions USING btree (period_id);

CREATE INDEX idx_transactions_period_status ON public.transactions USING btree (period_id, status);

CREATE INDEX idx_transactions_period_type ON public.transactions USING btree (period_id, type);

CREATE INDEX idx_transactions_status ON public.transactions USING btree (status);

CREATE INDEX idx_transactions_type ON public.transactions USING btree (type);

CREATE INDEX idx_transactions_workspace_period ON public.transactions USING btree (workspace_id, period_id);

CREATE UNIQUE INDEX uq_audit_events_workspace_key ON public.audit_events USING btree (workspace_id, event_key);

CREATE UNIQUE INDEX uq_categories_global_group_code_active ON public.categories USING btree (group_id, lower(code)) WHERE ((workspace_id IS NULL) AND (deleted_at IS NULL));

CREATE UNIQUE INDEX uq_categories_global_group_name_active ON public.categories USING btree (group_id, lower(name)) WHERE ((workspace_id IS NULL) AND (deleted_at IS NULL));

CREATE UNIQUE INDEX uq_categories_workspace_code_active ON public.categories USING btree (workspace_id, lower(code)) WHERE ((workspace_id IS NOT NULL) AND (deleted_at IS NULL));

CREATE UNIQUE INDEX uq_categories_workspace_group_name_active ON public.categories USING btree (workspace_id, group_id, lower(name)) WHERE ((workspace_id IS NOT NULL) AND (deleted_at IS NULL));

CREATE UNIQUE INDEX uq_category_groups_global_code_active ON public.groups USING btree (upper(code)) WHERE ((workspace_id IS NULL) AND (deleted_at IS NULL));

CREATE UNIQUE INDEX uq_category_groups_global_name_active ON public.groups USING btree (lower(name)) WHERE ((workspace_id IS NULL) AND (deleted_at IS NULL));

CREATE UNIQUE INDEX uq_category_groups_workspace_code_active ON public.groups USING btree (workspace_id, upper(code)) WHERE ((workspace_id IS NOT NULL) AND (deleted_at IS NULL));

CREATE UNIQUE INDEX uq_category_groups_workspace_name_active ON public.groups USING btree (workspace_id, lower(name)) WHERE ((workspace_id IS NOT NULL) AND (deleted_at IS NULL));

CREATE UNIQUE INDEX uq_fiscal_periods_workspace_start ON public.fiscal_periods USING btree (workspace_id, period_start);

CREATE UNIQUE INDEX uq_transactions_workspace_recurrence_key ON public.transactions USING btree (workspace_id, recurrence_materialization_key) WHERE (recurrence_materialization_key IS NOT NULL);

CREATE UNIQUE INDEX uq_workspace_invites_workspace_email ON public.workspace_invites USING btree (workspace_id, lower(email));

create or replace view public.v_period_totals as  SELECT fp.workspace_id,
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
  GROUP BY fp.workspace_id, fp.id, fp.period_start;;

create or replace view public.v_period_totals_by_status as  SELECT fp.workspace_id,
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
  GROUP BY fp.workspace_id, fp.id, fp.period_start, t.status;;

CREATE OR REPLACE FUNCTION public.bootstrap_workspace(p_name text DEFAULT 'Workspace Principal'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
begin
  -- Check if user already has a workspace
  select wm.workspace_id into v_workspace_id
  from public.workspace_members wm
  where wm.user_id = v_user_id and wm.active = true
  limit 1;

  if v_workspace_id is not null then
    return v_workspace_id;
  end if;

  insert into public.workspaces (name, status, created_by)
  values (p_name, 'active', v_user_id)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, active)
  values (v_workspace_id, v_user_id, 'owner', true);

  return v_workspace_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.enforce_category_scope_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_group_workspace_id uuid;
  v_group_deleted_at timestamptz;
begin
  select g.workspace_id, g.deleted_at
    into v_group_workspace_id, v_group_deleted_at
  from public.category_groups g
  where g.id = new.group_id;

  if not found then
    raise exception 'Invalid group for category.';
  end if;

  if v_group_deleted_at is not null then
    raise exception 'Group is deleted. Select an active group.';
  end if;

  -- Custom group: category must belong to the same workspace
  if v_group_workspace_id is not null
     and new.workspace_id is distinct from v_group_workspace_id then
    raise exception 'Workspace category must belong to the same workspace as its group.';
  end if;

  -- Global category can only belong to a global group
  if new.workspace_id is null and v_group_workspace_id is not null then
    raise exception 'Global category can only belong to a global group.';
  end if;

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.enforce_global_taxonomy_soft_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.workspace_id is null
     and new.deleted_at is distinct from old.deleted_at
     and not public.is_admin() then
    raise exception 'Only global admins can delete/restore global records.';
  end if;

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role
  from public.user_profiles
  where id = auth.uid()
    and active = true;
$function$


CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, active)
  VALUES (new.id, new.email, 'client', true)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.workspace_invites
  SET accepted_at = now()
  WHERE lower(email) = lower(new.email)
    AND accepted_at IS NULL;

  RETURN new;
END;
$function$


CREATE OR REPLACE FUNCTION public.has_workspace_role(p_workspace_id uuid, p_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.active = true
      and wm.role::text = any (p_roles)
  );
$function$


CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'internal'
      AND active = true
  );
$function$


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

  -- Also recalculate if the period changed (e.g., entry moved between periods)
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
$function$


CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$


CREATE TRIGGER trg_categories_enforce_scope BEFORE INSERT OR UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION enforce_category_scope_match();

CREATE TRIGGER trg_categories_global_soft_delete BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION enforce_global_taxonomy_soft_delete();

CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_category_groups_global_soft_delete BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION enforce_global_taxonomy_soft_delete();

CREATE TRIGGER trg_category_groups_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fiscal_periods_updated_at BEFORE UPDATE ON fiscal_periods FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_recurrences_updated_at BEFORE UPDATE ON recurrences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_transactions_refresh_balances AFTER INSERT OR DELETE OR UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION refresh_period_balances();

CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_workspace_members_updated_at BEFORE UPDATE ON workspace_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION set_updated_at();

alter table public.audit_events enable row level security;

alter table public.categories enable row level security;

alter table public.fiscal_periods enable row level security;

alter table public.groups enable row level security;

alter table public.import_job_rows enable row level security;

alter table public.import_jobs enable row level security;

alter table public.period_balances enable row level security;

alter table public.recurrences enable row level security;

alter table public.transactions enable row level security;

alter table public.user_profiles enable row level security;

alter table public.workspace_invites enable row level security;

alter table public.workspace_members enable row level security;

alter table public.workspaces enable row level security;

create policy "audit_events.member:select" on public.audit_events for select to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "audit_events.writer:write" on public.audit_events for all to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text])) with check (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text]));

create policy "categories.authenticated:select" on public.categories for select to authenticated using (((deleted_at IS NULL) AND ((workspace_id IS NULL) OR has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]))));

create policy "categories.writer:write" on public.categories for all to authenticated using ((((workspace_id IS NULL) AND is_admin()) OR ((workspace_id IS NOT NULL) AND has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text])))) with check ((((workspace_id IS NULL) AND is_admin()) OR ((workspace_id IS NOT NULL) AND has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text]))));

create policy "category_groups.admin:write" on public.groups for all to authenticated using ((((workspace_id IS NULL) AND is_admin()) OR ((workspace_id IS NOT NULL) AND has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text])))) with check ((((workspace_id IS NULL) AND is_admin()) OR ((workspace_id IS NOT NULL) AND has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text]))));

create policy "category_groups.authenticated:select" on public.groups for select to authenticated using (((deleted_at IS NULL) AND ((workspace_id IS NULL) OR has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'viewer'::text]))));

create policy "fiscal_periods.member:select" on public.fiscal_periods for select to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "fiscal_periods.writer:write" on public.fiscal_periods for all to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text])) with check (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text]));

create policy "groups.authenticated:select" on public.groups for select to authenticated using (((deleted_at IS NULL) AND ((workspace_id IS NULL) OR has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]))));

create policy "groups.writer:write" on public.groups for all to authenticated using ((((workspace_id IS NULL) AND is_admin()) OR ((workspace_id IS NOT NULL) AND has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text])))) with check ((((workspace_id IS NULL) AND is_admin()) OR ((workspace_id IS NOT NULL) AND has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text]))));

create policy "import_job_rows.member:select" on public.import_job_rows for select to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "import_job_rows.writer:write" on public.import_job_rows for all to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text])) with check (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text]));

create policy "import_jobs.member:select" on public.import_jobs for select to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "import_jobs.writer:write" on public.import_jobs for all to authenticated using ((has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text]) AND (created_by = auth.uid()))) with check ((has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text]) AND (created_by = auth.uid())));

create policy "period_balances.member:select" on public.period_balances for select to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "period_balances.writer:write" on public.period_balances for all to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text])) with check (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text]));

create policy "recurrences.member:select" on public.recurrences for select to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "recurrences.writer:write" on public.recurrences for all to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text])) with check (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text]));

create policy "transactions.member:select" on public.transactions for select to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "transactions.writer:write" on public.transactions for all to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text])) with check (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text]));

create policy "user_profiles.admin:update" on public.user_profiles for update to authenticated using (is_admin()) with check (is_admin());

create policy "user_profiles.authenticated:select" on public.user_profiles for select to authenticated using (((id = auth.uid()) OR is_admin()));

create policy "user_profiles.self:insert" on public.user_profiles for insert to authenticated with check ((id = auth.uid()));

create policy "workspace_invites.admin:all" on public.workspace_invites for all to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text])) with check (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text]));

create policy "workspace_members.admin:write" on public.workspace_members for all to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text])) with check (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text]));

create policy "workspace_members.creator:insert" on public.workspace_members for insert to authenticated with check (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM workspaces w
  WHERE ((w.id = workspace_members.workspace_id) AND (w.created_by = auth.uid()))))));

create policy "workspace_members.member:select" on public.workspace_members for select to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "workspaces.authenticated:insert" on public.workspaces for insert to authenticated with check (((created_by = auth.uid()) OR (created_by IS NULL)));

create policy "workspaces.member:select" on public.workspaces for select to authenticated using (has_workspace_role(id, ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "workspaces.owner:update" on public.workspaces for update to authenticated using (has_workspace_role(id, ARRAY['owner'::text])) with check (has_workspace_role(id, ARRAY['owner'::text]));