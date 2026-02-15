-- Supabase / PostgreSQL DDL for personal finances
-- Focus: historical + forecast (planned) + realized entries by month (competencia)

create extension if not exists pgcrypto;

-- Enums
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'entry_type' and n.nspname = 'public'
  ) then
    create type entry_type as enum ('receita', 'despesa', 'investimento');
  end if;
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'entry_status' and n.nspname = 'public'
  ) then
    create type entry_status as enum ('previsto', 'realizado', 'cancelado');
  end if;
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'recurrence_freq' and n.nspname = 'public'
  ) then
    create type recurrence_freq as enum ('mensal', 'anual');
  end if;
end $$;

-- Competencia (month bucket)
create table if not exists months (
  id uuid primary key default gen_random_uuid(),
  month_start date not null unique, -- always first day of month
  month_end date generated always as ((month_start + interval '1 month - 1 day')::date) stored,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint months_first_day_chk
    check (month_start = date_trunc('month', month_start)::date)
);

-- Group headers like: RECEITA, CASA, EDUCACAO/SAUDE, CARTAO, OUTROS...
create table if not exists category_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,      -- machine name, e.g. "CARTAO_GORDURA"
  name text not null unique,      -- display name
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references category_groups(id) on delete restrict,
  code text not null unique,      -- machine name, e.g. "aluguel"
  name text not null,             -- display name
  default_type entry_type not null,
  default_is_recurring boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, name)
);

-- Financial entries: planned and/or realized
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references months(id) on delete cascade,
  category_id uuid not null references categories(id) on delete restrict,

  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  type entry_type not null,
  status entry_status not null default 'previsto',
  is_recurring boolean not null default false,

  planned_date date,
  realized_at date,               -- date when payment/receipt actually occurred
  color_hint text,                -- optional migration artifact: e.g. "blue"
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint entries_realized_date_chk
    check (
      (status = 'realizado' and realized_at is not null)
      or (status <> 'realizado')
    )
);

-- Optional recurrence templates for future month projection
create table if not exists recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  type entry_type not null,
  freq recurrence_freq not null default 'mensal',
  day_of_month int not null default 1 check (day_of_month between 1 and 31),
  start_month date not null,
  end_month date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurrence_start_month_chk
    check (start_month = date_trunc('month', start_month)::date),
  constraint recurrence_end_month_chk
    check (end_month is null or end_month = date_trunc('month', end_month)::date),
  constraint recurrence_period_chk
    check (end_month is null or end_month >= start_month)
);

-- Snapshot table for SALDOS block (optional denormalized cache)
create table if not exists monthly_balances (
  month_id uuid primary key references months(id) on delete cascade,
  receita_total numeric(14,2) not null default 0,
  despesa_total numeric(14,2) not null default 0,
  despesa_recorrente numeric(14,2) not null default 0,
  investimento_total numeric(14,2) not null default 0,
  resultado_mes numeric(14,2) not null default 0,
  resultado_anterior numeric(14,2) not null default 0,
  resultado_acumulado numeric(14,2) not null default 0,
  calculated_at timestamptz not null default now()
);

-- Helpful views
create or replace view v_monthly_totals as
select
  m.id as month_id,
  m.month_start,
  coalesce(sum(case when e.type = 'receita' and e.status <> 'cancelado' then e.amount end), 0) as receita_total,
  coalesce(sum(case when e.type = 'despesa' and e.status <> 'cancelado' then e.amount end), 0) as despesa_total,
  coalesce(sum(case when e.type = 'despesa' and e.is_recurring and e.status <> 'cancelado' then e.amount end), 0) as despesa_recorrente,
  coalesce(sum(case when e.type = 'investimento' and e.status <> 'cancelado' then e.amount end), 0) as investimento_total,
  coalesce(sum(case when e.type = 'receita' and e.status <> 'cancelado' then e.amount end), 0)
    - coalesce(sum(case when e.type in ('despesa','investimento') and e.status <> 'cancelado' then e.amount end), 0)
    as resultado_mes
from months m
left join entries e on e.month_id = m.id
group by m.id, m.month_start;

create or replace view v_monthly_totals_by_status as
select
  m.id as month_id,
  m.month_start,
  e.status,
  coalesce(sum(case when e.type = 'receita' then e.amount end), 0) as receita_total,
  coalesce(sum(case when e.type = 'despesa' then e.amount end), 0) as despesa_total,
  coalesce(sum(case when e.type = 'investimento' then e.amount end), 0) as investimento_total
from months m
left join entries e on e.month_id = m.id
group by m.id, m.month_start, e.status;

-- Updated_at trigger
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_months_updated_at on months;
create trigger trg_months_updated_at
before update on months
for each row execute function set_updated_at();

drop trigger if exists trg_category_groups_updated_at on category_groups;
create trigger trg_category_groups_updated_at
before update on category_groups
for each row execute function set_updated_at();

drop trigger if exists trg_categories_updated_at on categories;
create trigger trg_categories_updated_at
before update on categories
for each row execute function set_updated_at();

drop trigger if exists trg_entries_updated_at on entries;
create trigger trg_entries_updated_at
before update on entries
for each row execute function set_updated_at();

drop trigger if exists trg_recurrence_rules_updated_at on recurrence_rules;
create trigger trg_recurrence_rules_updated_at
before update on recurrence_rules
for each row execute function set_updated_at();

-- Indexes
create index if not exists idx_entries_month on entries(month_id);
create index if not exists idx_entries_category on entries(category_id);
create index if not exists idx_entries_status on entries(status);
create index if not exists idx_entries_type on entries(type);
create index if not exists idx_entries_month_status on entries(month_id, status);
create index if not exists idx_entries_month_type on entries(month_id, type);
create index if not exists idx_recurrence_active_period on recurrence_rules(active, start_month, end_month);
