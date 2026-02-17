-- Run after supabase_ddl.sql
-- Adds role model (admin/viewer), invites, profile bootstrap and RLS.

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_profiles
  where id = auth.uid()
    and active = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and role = 'admin'
      and active = true
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_role text;
begin
  select role
    into invite_role
  from public.user_invites
  where lower(email) = lower(new.email)
    and accepted_at is null
  order by created_at desc
  limit 1;

  insert into public.user_profiles (id, email, role, active)
  values (
    new.id,
    new.email,
    coalesce(invite_role, 'viewer'),
    true
  )
  on conflict (id) do nothing;

  update public.user_invites
  set accepted_at = now()
  where lower(email) = lower(new.email)
    and accepted_at is null;

  return new;
end;
$$;

drop trigger if exists trg_auth_users_after_insert on auth.users;
create trigger trg_auth_users_after_insert
after insert on auth.users
for each row execute function public.handle_new_user();

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

alter table public.user_profiles enable row level security;
alter table public.user_invites enable row level security;
alter table public.months enable row level security;
alter table public.category_groups enable row level security;
alter table public.categories enable row level security;
alter table public.entries enable row level security;
alter table public.recurrence_rules enable row level security;
alter table public.monthly_balances enable row level security;

drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select
on public.user_profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists user_profiles_insert_self on public.user_profiles;
create policy user_profiles_insert_self
on public.user_profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists user_profiles_update on public.user_profiles;
create policy user_profiles_update
on public.user_profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists user_invites_all_admin on public.user_invites;
create policy user_invites_all_admin
on public.user_invites
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists months_select_auth on public.months;
create policy months_select_auth
on public.months
for select
to authenticated
using (true);

drop policy if exists months_write_admin on public.months;
create policy months_write_admin
on public.months
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists category_groups_select_auth on public.category_groups;
create policy category_groups_select_auth
on public.category_groups
for select
to authenticated
using (true);

drop policy if exists category_groups_write_admin on public.category_groups;
create policy category_groups_write_admin
on public.category_groups
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists categories_select_auth on public.categories;
create policy categories_select_auth
on public.categories
for select
to authenticated
using (true);

drop policy if exists categories_write_admin on public.categories;
create policy categories_write_admin
on public.categories
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists entries_select_auth on public.entries;
create policy entries_select_auth
on public.entries
for select
to authenticated
using (true);

drop policy if exists entries_write_admin on public.entries;
create policy entries_write_admin
on public.entries
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists recurrence_rules_select_auth on public.recurrence_rules;
create policy recurrence_rules_select_auth
on public.recurrence_rules
for select
to authenticated
using (true);

drop policy if exists recurrence_rules_write_admin on public.recurrence_rules;
create policy recurrence_rules_write_admin
on public.recurrence_rules
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists monthly_balances_select_auth on public.monthly_balances;
create policy monthly_balances_select_auth
on public.monthly_balances
for select
to authenticated
using (true);

drop policy if exists monthly_balances_write_admin on public.monthly_balances;
create policy monthly_balances_write_admin
on public.monthly_balances
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Bootstrap: after running this script, run once with your own auth user id:
-- update public.user_profiles set role = 'admin' where id = 'YOUR_AUTH_USER_UUID';
