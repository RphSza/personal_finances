-- ============================================================
-- Personal Finances SaaS — Schema Snapshot (v2 - English)
-- Run this FIRST, then migrations S2 → S3 → S4 in order.
-- ============================================================

-- Enums
create type public.transaction_type as enum ('income', 'expense', 'investment');
create type public.transaction_status as enum ('planned', 'settled', 'cancelled');
create type public.recurrence_freq as enum ('monthly', 'yearly');
create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');

-- ============================================================
-- Tables
-- ============================================================

create table public.workspaces (
  id uuid default gen_random_uuid() not null,
  name text not null,
  slug text,
  status text default 'active'::text not null,
  created_by uuid,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.user_profiles (
  id uuid not null,
  email text,
  role text default 'client'::text not null,
  active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.workspace_members (
  workspace_id uuid not null,
  user_id uuid not null,
  role workspace_role not null,
  active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.workspace_invites (
  id uuid default gen_random_uuid() not null,
  email text not null,
  role workspace_role not null,
  created_at timestamptz default now() not null,
  accepted_at timestamptz,
  workspace_id uuid not null
);

create table public.groups (
  id uuid default gen_random_uuid() not null,
  workspace_id uuid,
  code text not null,
  name text not null,
  sort_order integer default 0 not null,
  created_by uuid,
  deleted_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
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
  deleted_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.fiscal_periods (
  id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  period_start date not null,
  period_end date generated always as (((period_start + '1 mon -1 days'::interval))::date) stored,
  closed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
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
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  recurrence_materialization_key text
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
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
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
  calculated_at timestamptz default now() not null
);

create table public.audit_events (
  id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  period_id uuid,
  event_type text not null,
  event_key text not null,
  payload jsonb default '{}'::jsonb not null,
  created_by uuid,
  created_at timestamptz default now() not null
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
  completed_at timestamptz,
  created_at timestamptz default now() not null
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
  created_at timestamptz default now() not null
);

-- ============================================================
-- Primary Keys
-- ============================================================

alter table public.workspaces add constraint workspaces_pkey primary key (id);
alter table public.user_profiles add constraint user_profiles_pkey primary key (id);
alter table public.workspace_members add constraint workspace_members_pkey primary key (workspace_id, user_id);
alter table public.workspace_invites add constraint workspace_invites_pkey primary key (id);
alter table public.groups add constraint groups_pkey primary key (id);
alter table public.categories add constraint categories_pkey primary key (id);
alter table public.fiscal_periods add constraint fiscal_periods_pkey primary key (id);
alter table public.transactions add constraint transactions_pkey primary key (id);
alter table public.recurrences add constraint recurrences_pkey primary key (id);
alter table public.period_balances add constraint period_balances_pkey primary key (period_id);
alter table public.audit_events add constraint audit_events_pkey primary key (id);
alter table public.import_jobs add constraint import_jobs_pkey primary key (id);
alter table public.import_job_rows add constraint import_job_rows_pkey primary key (id);

-- ============================================================
-- Foreign Keys
-- ============================================================

-- workspaces
alter table public.workspaces add constraint workspaces_created_by_fkey
  foreign key (created_by) references auth.users(id);

-- user_profiles
alter table public.user_profiles add constraint user_profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- workspace_members
alter table public.workspace_members add constraint workspace_members_workspace_id_fkey
  foreign key (workspace_id) references workspaces(id) on delete cascade;
alter table public.workspace_members add constraint workspace_members_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- workspace_invites
alter table public.workspace_invites add constraint workspace_invites_workspace_fk
  foreign key (workspace_id) references workspaces(id) on delete cascade;

-- groups
alter table public.groups add constraint groups_workspace_fk
  foreign key (workspace_id) references workspaces(id) on delete cascade;
alter table public.groups add constraint groups_created_by_fkey
  foreign key (created_by) references auth.users(id);

-- categories
alter table public.categories add constraint categories_group_id_fkey
  foreign key (group_id) references groups(id) on delete restrict;
alter table public.categories add constraint categories_workspace_fk
  foreign key (workspace_id) references workspaces(id) on delete cascade;
alter table public.categories add constraint categories_created_by_fkey
  foreign key (created_by) references auth.users(id);

-- fiscal_periods
alter table public.fiscal_periods add constraint fiscal_periods_workspace_fk
  foreign key (workspace_id) references workspaces(id) on delete cascade;

-- transactions
alter table public.transactions add constraint transactions_period_id_fkey
  foreign key (period_id) references fiscal_periods(id) on delete cascade;
alter table public.transactions add constraint transactions_category_id_fkey
  foreign key (category_id) references categories(id) on delete restrict;
alter table public.transactions add constraint transactions_workspace_fk
  foreign key (workspace_id) references workspaces(id) on delete cascade;
alter table public.transactions add constraint transactions_created_by_fkey
  foreign key (created_by) references auth.users(id);

-- recurrences
alter table public.recurrences add constraint recurrences_category_id_fkey
  foreign key (category_id) references categories(id) on delete cascade;
alter table public.recurrences add constraint recurrences_workspace_fk
  foreign key (workspace_id) references workspaces(id) on delete cascade;
alter table public.recurrences add constraint recurrences_created_by_fkey
  foreign key (created_by) references auth.users(id);

-- period_balances
alter table public.period_balances add constraint period_balances_period_id_fkey
  foreign key (period_id) references fiscal_periods(id) on delete cascade;
alter table public.period_balances add constraint period_balances_workspace_fk
  foreign key (workspace_id) references workspaces(id) on delete cascade;

-- audit_events
alter table public.audit_events add constraint audit_events_workspace_id_fkey
  foreign key (workspace_id) references workspaces(id) on delete cascade;
alter table public.audit_events add constraint audit_events_period_id_fkey
  foreign key (period_id) references fiscal_periods(id) on delete set null;
alter table public.audit_events add constraint audit_events_created_by_fkey
  foreign key (created_by) references auth.users(id);

-- import_jobs
alter table public.import_jobs add constraint import_jobs_workspace_id_fkey
  foreign key (workspace_id) references workspaces(id) on delete cascade;
alter table public.import_jobs add constraint import_jobs_period_id_fkey
  foreign key (period_id) references fiscal_periods(id) on delete cascade;
alter table public.import_jobs add constraint import_jobs_created_by_fkey
  foreign key (created_by) references auth.users(id);

-- import_job_rows
alter table public.import_job_rows add constraint import_job_rows_workspace_id_fkey
  foreign key (workspace_id) references workspaces(id) on delete cascade;
alter table public.import_job_rows add constraint import_job_rows_job_id_fkey
  foreign key (job_id) references import_jobs(id) on delete cascade;
alter table public.import_job_rows add constraint import_job_rows_period_id_fkey
  foreign key (period_id) references fiscal_periods(id) on delete cascade;
alter table public.import_job_rows add constraint import_job_rows_category_id_fkey
  foreign key (category_id) references categories(id) on delete set null;

-- ============================================================
-- Check Constraints
-- ============================================================

alter table public.workspaces add constraint workspaces_status_check
  check (status = any (array['active'::text, 'inactive'::text]));
alter table public.workspaces add constraint workspaces_slug_key unique (slug);

alter table public.user_profiles add constraint user_profiles_email_key unique (email);
alter table public.user_profiles add constraint user_profiles_role_check
  check (role = any (array['internal'::text, 'client'::text]));

alter table public.fiscal_periods add constraint fiscal_periods_first_day_chk
  check (period_start = date_trunc('month'::text, period_start::timestamp with time zone)::date);

alter table public.transactions add constraint transactions_amount_check
  check (amount >= 0::numeric);
alter table public.transactions add constraint transactions_settled_date_chk
  check (status = 'settled'::transaction_status and settled_at is not null
      or status <> 'settled'::transaction_status);

alter table public.recurrences add constraint recurrences_amount_check
  check (amount >= 0::numeric);
alter table public.recurrences add constraint recurrences_day_of_month_check
  check (day_of_month >= 1 and day_of_month <= 31);
alter table public.recurrences add constraint recurrences_start_month_chk
  check (start_month = date_trunc('month'::text, start_month::timestamp with time zone)::date);
alter table public.recurrences add constraint recurrences_end_month_chk
  check (end_month is null or end_month = date_trunc('month'::text, end_month::timestamp with time zone)::date);
alter table public.recurrences add constraint recurrences_period_chk
  check (end_month is null or end_month >= start_month);

alter table public.import_jobs add constraint import_jobs_source_format_check
  check (source_format = any (array['csv'::text, 'ofx'::text]));
alter table public.import_jobs add constraint import_jobs_status_check
  check (status = any (array['processing'::text, 'completed'::text, 'failed'::text]));

alter table public.import_job_rows add constraint import_job_rows_row_index_check
  check (row_index > 0);
alter table public.import_job_rows add constraint import_job_rows_amount_check
  check (amount >= 0::numeric);

-- ============================================================
-- Indexes
-- ============================================================

-- groups
create index idx_groups_workspace on public.groups using btree (workspace_id);
create index idx_groups_deleted_at on public.groups using btree (deleted_at);

-- categories
create index idx_categories_workspace on public.categories using btree (workspace_id);
create index idx_categories_deleted_at on public.categories using btree (deleted_at);

-- fiscal_periods
create unique index uq_fiscal_periods_workspace_start on public.fiscal_periods using btree (workspace_id, period_start);

-- transactions
create index idx_transactions_category on public.transactions using btree (category_id);
create index idx_transactions_period on public.transactions using btree (period_id);
create index idx_transactions_period_status on public.transactions using btree (period_id, status);
create index idx_transactions_period_type on public.transactions using btree (period_id, type);
create index idx_transactions_status on public.transactions using btree (status);
create index idx_transactions_type on public.transactions using btree (type);
create index idx_transactions_workspace_period on public.transactions using btree (workspace_id, period_id);
create unique index uq_transactions_workspace_recurrence_key on public.transactions using btree (workspace_id, recurrence_materialization_key)
  where (recurrence_materialization_key is not null);

-- recurrences
create index idx_recurrences_active_period on public.recurrences using btree (active, start_month, end_month);
create index idx_recurrences_workspace on public.recurrences using btree (workspace_id, active);

-- audit_events
create index idx_audit_events_workspace_type_created on public.audit_events using btree (workspace_id, event_type, created_at desc);
create unique index uq_audit_events_workspace_key on public.audit_events using btree (workspace_id, event_key);

-- workspace_invites
create unique index uq_workspace_invites_workspace_email on public.workspace_invites using btree (workspace_id, lower(email));

-- import_jobs
create index idx_import_jobs_workspace_created on public.import_jobs using btree (workspace_id, created_at desc);
create index idx_import_jobs_workspace_period on public.import_jobs using btree (workspace_id, period_id, created_at desc);

-- import_job_rows
create index idx_import_job_rows_job on public.import_job_rows using btree (job_id, row_index);
create index idx_import_job_rows_workspace_dedupe on public.import_job_rows using btree (workspace_id, dedupe_key);

-- ============================================================
-- Views
-- ============================================================

create or replace view public.v_period_totals as
select
  fp.workspace_id,
  fp.id as period_id,
  fp.period_start,
  coalesce(sum(case when t.type = 'income'::transaction_type and t.status <> 'cancelled'::transaction_status then t.amount end), 0::numeric) as income_total,
  coalesce(sum(case when t.type = 'expense'::transaction_type and t.status <> 'cancelled'::transaction_status then t.amount end), 0::numeric) as expense_total,
  coalesce(sum(case when t.type = 'expense'::transaction_type and t.is_recurring and t.status <> 'cancelled'::transaction_status then t.amount end), 0::numeric) as recurring_expense,
  coalesce(sum(case when t.type = 'investment'::transaction_type and t.status <> 'cancelled'::transaction_status then t.amount end), 0::numeric) as investment_total,
  coalesce(sum(case when t.type = 'income'::transaction_type and t.status <> 'cancelled'::transaction_status then t.amount end), 0::numeric)
    - coalesce(sum(case when t.type in ('expense'::transaction_type, 'investment'::transaction_type) and t.status <> 'cancelled'::transaction_status then t.amount end), 0::numeric) as net_result
from fiscal_periods fp
  left join transactions t on t.period_id = fp.id and t.workspace_id = fp.workspace_id
group by fp.workspace_id, fp.id, fp.period_start;

create or replace view public.v_period_totals_by_status as
select
  fp.workspace_id,
  fp.id as period_id,
  fp.period_start,
  t.status,
  coalesce(sum(case when t.type = 'income'::transaction_type then t.amount end), 0::numeric) as income_total,
  coalesce(sum(case when t.type = 'expense'::transaction_type then t.amount end), 0::numeric) as expense_total,
  coalesce(sum(case when t.type = 'investment'::transaction_type then t.amount end), 0::numeric) as investment_total
from fiscal_periods fp
  left join transactions t on t.period_id = fp.id and t.workspace_id = fp.workspace_id
group by fp.workspace_id, fp.id, fp.period_start, t.status;

-- ============================================================
-- Functions
-- ============================================================

create or replace function public.get_user_role()
returns text
language sql
stable security definer
set search_path to 'public'
as $function$
  select role
  from public.user_profiles
  where id = auth.uid()
    and active = true;
$function$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.user_profiles (id, email, role, active)
  values (new.id, new.email, 'client', true)
  on conflict (id) do nothing;

  update public.workspace_invites
  set accepted_at = now()
  where lower(email) = lower(new.email)
    and accepted_at is null;

  return new;
end;
$function$;

create or replace function public.has_workspace_role(p_workspace_id uuid, p_roles text[])
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.active = true
      and wm.role::text = any (p_roles)
  );
$function$;

create or replace function public.is_admin()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and role = 'internal'
      and active = true
  );
$function$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.refresh_period_balances()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  where t.period_id = v_period_id and t.workspace_id = v_workspace_id
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
    where t.period_id = OLD.period_id and t.workspace_id = OLD.workspace_id
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

-- ============================================================
-- Triggers
-- ============================================================

create trigger trg_workspaces_updated_at before update on workspaces for each row execute function set_updated_at();
create trigger trg_user_profiles_updated_at before update on user_profiles for each row execute function set_updated_at();
create trigger trg_workspace_members_updated_at before update on workspace_members for each row execute function set_updated_at();
create trigger trg_groups_updated_at before update on groups for each row execute function set_updated_at();
create trigger trg_categories_updated_at before update on categories for each row execute function set_updated_at();
create trigger trg_fiscal_periods_updated_at before update on fiscal_periods for each row execute function set_updated_at();
create trigger trg_transactions_updated_at before update on transactions for each row execute function set_updated_at();
create trigger trg_recurrences_updated_at before update on recurrences for each row execute function set_updated_at();

-- Auto-refresh period_balances when transactions change
create trigger trg_transactions_refresh_balances
  after insert or update or delete on transactions
  for each row execute function refresh_period_balances();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.workspaces enable row level security;
alter table public.user_profiles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.groups enable row level security;
alter table public.categories enable row level security;
alter table public.fiscal_periods enable row level security;
alter table public.transactions enable row level security;
alter table public.recurrences enable row level security;
alter table public.period_balances enable row level security;
alter table public.audit_events enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_job_rows enable row level security;

-- ============================================================
-- RLS Policies
-- ============================================================

-- workspaces
create policy "workspaces.authenticated:insert" on public.workspaces
  for insert to authenticated
  with check ((created_by = auth.uid()) or (created_by is null));

create policy "workspaces.member:select" on public.workspaces
  for select to authenticated
  using (has_workspace_role(id, array['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "workspaces.owner:update" on public.workspaces
  for update to authenticated
  using (has_workspace_role(id, array['owner'::text]))
  with check (has_workspace_role(id, array['owner'::text]));

-- user_profiles
create policy "user_profiles.self:insert" on public.user_profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "user_profiles.authenticated:select" on public.user_profiles
  for select to authenticated
  using ((id = auth.uid()) or is_admin());

create policy "user_profiles.admin:update" on public.user_profiles
  for update to authenticated
  using (is_admin())
  with check (is_admin());

-- workspace_members
create policy "workspace_members.member:select" on public.workspace_members
  for select to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "workspace_members.admin:write" on public.workspace_members
  for all to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text]))
  with check (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text]));

-- workspace_invites
create policy "workspace_invites.admin:all" on public.workspace_invites
  for all to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text]))
  with check (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text]));

-- groups
create policy "groups.authenticated:select" on public.groups
  for select to authenticated
  using (deleted_at is null and (workspace_id is null or has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text])));

create policy "groups.writer:write" on public.groups
  for all to authenticated
  using ((workspace_id is null and is_admin()) or (workspace_id is not null and has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text])))
  with check ((workspace_id is null and is_admin()) or (workspace_id is not null and has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text])));

-- categories
create policy "categories.authenticated:select" on public.categories
  for select to authenticated
  using (deleted_at is null and (workspace_id is null or has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text])));

create policy "categories.writer:write" on public.categories
  for all to authenticated
  using ((workspace_id is null and is_admin()) or (workspace_id is not null and has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text])))
  with check ((workspace_id is null and is_admin()) or (workspace_id is not null and has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text])));

-- fiscal_periods
create policy "fiscal_periods.member:select" on public.fiscal_periods
  for select to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "fiscal_periods.writer:write" on public.fiscal_periods
  for all to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text]))
  with check (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text]));

-- transactions
create policy "transactions.member:select" on public.transactions
  for select to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "transactions.writer:write" on public.transactions
  for all to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text]))
  with check (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text]));

-- recurrences
create policy "recurrences.member:select" on public.recurrences
  for select to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "recurrences.writer:write" on public.recurrences
  for all to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text]))
  with check (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text]));

-- period_balances
create policy "period_balances.member:select" on public.period_balances
  for select to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "period_balances.writer:write" on public.period_balances
  for all to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text]))
  with check (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text]));

-- audit_events
create policy "audit_events.member:select" on public.audit_events
  for select to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "audit_events.writer:write" on public.audit_events
  for all to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text]))
  with check (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text]));

-- import_jobs
create policy "import_jobs.member:select" on public.import_jobs
  for select to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "import_jobs.writer:write" on public.import_jobs
  for all to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text]) and created_by = auth.uid())
  with check (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text]) and created_by = auth.uid());

-- import_job_rows
create policy "import_job_rows.member:select" on public.import_job_rows
  for select to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

create policy "import_job_rows.writer:write" on public.import_job_rows
  for all to authenticated
  using (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text]))
  with check (has_workspace_role(workspace_id, array['owner'::text, 'admin'::text, 'member'::text]));
