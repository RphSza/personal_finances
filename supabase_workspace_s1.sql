-- Sprint S1 migration: workspace isolation + membership roles (owner/admin/viewer)
-- Run after supabase_ddl.sql and supabase_auth_rbac.sql

begin;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

drop trigger if exists trg_workspaces_updated_at on public.workspaces;
create trigger trg_workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

drop trigger if exists trg_workspace_members_updated_at on public.workspace_members;
create trigger trg_workspace_members_updated_at
before update on public.workspace_members
for each row execute function public.set_updated_at();

-- Expand invites to workspace scope
alter table public.user_invites add column if not exists workspace_id uuid;

alter table public.user_invites drop constraint if exists user_invites_role_check;
alter table public.user_invites
  add constraint user_invites_role_check check (role in ('owner', 'admin', 'viewer'));

alter table public.user_invites drop constraint if exists user_invites_email_key;
create unique index if not exists uq_user_invites_workspace_email
  on public.user_invites(workspace_id, lower(email));

-- Create or fetch default workspace for legacy records
with default_ws as (
  insert into public.workspaces (name, slug)
  values ('Workspace Principal', 'workspace-principal')
  on conflict (slug) do update set name = excluded.name
  returning id
)
select id from default_ws;

-- Add workspace_id to business tables (backfilled with default workspace)
alter table public.months add column if not exists workspace_id uuid;
alter table public.category_groups add column if not exists workspace_id uuid;
alter table public.categories add column if not exists workspace_id uuid;
alter table public.entries add column if not exists workspace_id uuid;
alter table public.recurrence_rules add column if not exists workspace_id uuid;
alter table public.monthly_balances add column if not exists workspace_id uuid;

with ws as (
  select id from public.workspaces order by created_at asc limit 1
)
update public.months set workspace_id = (select id from ws) where workspace_id is null;
with ws as (
  select id from public.workspaces order by created_at asc limit 1
)
update public.category_groups set workspace_id = (select id from ws) where workspace_id is null;
with ws as (
  select id from public.workspaces order by created_at asc limit 1
)
update public.categories set workspace_id = (select id from ws) where workspace_id is null;
with ws as (
  select id from public.workspaces order by created_at asc limit 1
)
update public.entries set workspace_id = (select id from ws) where workspace_id is null;
with ws as (
  select id from public.workspaces order by created_at asc limit 1
)
update public.recurrence_rules set workspace_id = (select id from ws) where workspace_id is null;
with ws as (
  select id from public.workspaces order by created_at asc limit 1
)
update public.monthly_balances set workspace_id = (select id from ws) where workspace_id is null;

alter table public.months
  alter column workspace_id set not null,
  add constraint months_workspace_fk foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table public.category_groups
  alter column workspace_id set not null,
  add constraint category_groups_workspace_fk foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table public.categories
  alter column workspace_id set not null,
  add constraint categories_workspace_fk foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table public.entries
  alter column workspace_id set not null,
  add constraint entries_workspace_fk foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table public.recurrence_rules
  alter column workspace_id set not null,
  add constraint recurrence_rules_workspace_fk foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table public.monthly_balances
  alter column workspace_id set not null,
  add constraint monthly_balances_workspace_fk foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table public.user_invites
  alter column workspace_id set not null,
  add constraint user_invites_workspace_fk foreign key (workspace_id) references public.workspaces(id) on delete cascade;

-- Legacy uniques replaced by workspace-scoped uniques
alter table public.months drop constraint if exists months_month_start_key;
create unique index if not exists uq_months_workspace_start on public.months(workspace_id, month_start);

alter table public.category_groups drop constraint if exists category_groups_code_key;
alter table public.category_groups drop constraint if exists category_groups_name_key;
create unique index if not exists uq_category_groups_workspace_code on public.category_groups(workspace_id, code);
create unique index if not exists uq_category_groups_workspace_name on public.category_groups(workspace_id, name);

alter table public.categories drop constraint if exists categories_code_key;
create unique index if not exists uq_categories_workspace_code on public.categories(workspace_id, code);

alter table public.categories drop constraint if exists categories_group_id_name_key;
create unique index if not exists uq_categories_workspace_group_name on public.categories(workspace_id, group_id, name);

create index if not exists idx_entries_workspace_month on public.entries(workspace_id, month_id);
create index if not exists idx_categories_workspace on public.categories(workspace_id);
create index if not exists idx_category_groups_workspace on public.category_groups(workspace_id);
create index if not exists idx_recurrence_workspace on public.recurrence_rules(workspace_id, active);

create or replace view public.v_monthly_totals as
select
  m.workspace_id,
  m.id as month_id,
  m.month_start,
  coalesce(sum(case when e.type = 'receita' and e.status <> 'cancelado' then e.amount end), 0) as receita_total,
  coalesce(sum(case when e.type = 'despesa' and e.status <> 'cancelado' then e.amount end), 0) as despesa_total,
  coalesce(sum(case when e.type = 'despesa' and e.is_recurring and e.status <> 'cancelado' then e.amount end), 0) as despesa_recorrente,
  coalesce(sum(case when e.type = 'investimento' and e.status <> 'cancelado' then e.amount end), 0) as investimento_total,
  coalesce(sum(case when e.type = 'receita' and e.status <> 'cancelado' then e.amount end), 0)
    - coalesce(sum(case when e.type in ('despesa','investimento') and e.status <> 'cancelado' then e.amount end), 0)
    as resultado_mes
from public.months m
left join public.entries e
  on e.month_id = m.id
 and e.workspace_id = m.workspace_id
group by m.workspace_id, m.id, m.month_start;

create or replace view public.v_monthly_totals_by_status as
select
  m.workspace_id,
  m.id as month_id,
  m.month_start,
  e.status,
  coalesce(sum(case when e.type = 'receita' then e.amount end), 0) as receita_total,
  coalesce(sum(case when e.type = 'despesa' then e.amount end), 0) as despesa_total,
  coalesce(sum(case when e.type = 'investimento' then e.amount end), 0) as investimento_total
from public.months m
left join public.entries e
  on e.month_id = m.id
 and e.workspace_id = m.workspace_id
group by m.workspace_id, m.id, m.month_start, e.status;

-- Ensure existing users are members of default workspace
insert into public.workspace_members (workspace_id, user_id, role, active)
select
  ws.id,
  up.id,
  case when up.role = 'admin' then 'owner' else 'viewer' end,
  up.active
from public.user_profiles up
cross join lateral (
  select id from public.workspaces order by created_at asc limit 1
) ws
on conflict (workspace_id, user_id) do nothing;

update public.user_invites ui
set workspace_id = ws.id
from lateral (select id from public.workspaces order by created_at asc limit 1) ws
where ui.workspace_id is null;

create or replace function public.has_workspace_role(p_workspace_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.active = true
      and wm.role = any (p_roles)
  );
$$;

grant execute on function public.has_workspace_role(uuid, text[]) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- Workspace policies

drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member
on public.workspaces
for select
to authenticated
using (public.has_workspace_role(id, array['owner','admin','viewer']));

drop policy if exists workspaces_insert_owner on public.workspaces;
create policy workspaces_insert_owner
on public.workspaces
for insert
to authenticated
with check (created_by = auth.uid() or created_by is null);

drop policy if exists workspaces_update_owner on public.workspaces;
create policy workspaces_update_owner
on public.workspaces
for update
to authenticated
using (public.has_workspace_role(id, array['owner']))
with check (public.has_workspace_role(id, array['owner']));

drop policy if exists workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member
on public.workspace_members
for select
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','viewer']));

drop policy if exists workspace_members_write_owner_admin on public.workspace_members;
create policy workspace_members_write_owner_admin
on public.workspace_members
for all
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']))
with check (public.has_workspace_role(workspace_id, array['owner','admin']));

-- Replace broad legacy policies with workspace-scoped policies

drop policy if exists months_select_auth on public.months;
drop policy if exists months_write_admin on public.months;
create policy months_select_workspace
on public.months
for select
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','viewer']));
create policy months_write_workspace
on public.months
for all
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']))
with check (public.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists category_groups_select_auth on public.category_groups;
drop policy if exists category_groups_write_admin on public.category_groups;
create policy category_groups_select_workspace
on public.category_groups
for select
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','viewer']));
create policy category_groups_write_workspace
on public.category_groups
for all
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']))
with check (public.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists categories_select_auth on public.categories;
drop policy if exists categories_write_admin on public.categories;
create policy categories_select_workspace
on public.categories
for select
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','viewer']));
create policy categories_write_workspace
on public.categories
for all
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']))
with check (public.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists entries_select_auth on public.entries;
drop policy if exists entries_write_admin on public.entries;
create policy entries_select_workspace
on public.entries
for select
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','viewer']));
create policy entries_write_workspace
on public.entries
for all
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']))
with check (public.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists recurrence_rules_select_auth on public.recurrence_rules;
drop policy if exists recurrence_rules_write_admin on public.recurrence_rules;
create policy recurrence_rules_select_workspace
on public.recurrence_rules
for select
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','viewer']));
create policy recurrence_rules_write_workspace
on public.recurrence_rules
for all
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']))
with check (public.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists monthly_balances_select_auth on public.monthly_balances;
drop policy if exists monthly_balances_write_admin on public.monthly_balances;
create policy monthly_balances_select_workspace
on public.monthly_balances
for select
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','viewer']));
create policy monthly_balances_write_workspace
on public.monthly_balances
for all
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']))
with check (public.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists user_invites_all_admin on public.user_invites;
create policy user_invites_workspace_admin
on public.user_invites
for all
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']))
with check (public.has_workspace_role(workspace_id, array['owner','admin']));

commit;

-- Manual bootstrap (if needed):
-- update public.workspace_members
-- set role = 'owner'
-- where workspace_id = 'WORKSPACE_UUID' and user_id = 'YOUR_AUTH_USER_UUID';
