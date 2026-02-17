create type public.entry_status as enum ('previsto', 'realizado', 'cancelado');

create type public.entry_type as enum ('receita', 'despesa', 'investimento');

create type public.recurrence_freq as enum ('mensal', 'anual');

create table public.categories (
  id uuid default gen_random_uuid() not null,
  group_id uuid not null,
  code text not null,
  name text not null,
  default_type entry_type not null,
  default_is_recurring boolean default false not null,
  active boolean default true not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  workspace_id uuid not null
);

create table public.category_groups (
  id uuid default gen_random_uuid() not null,
  code text not null,
  name text not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  workspace_id uuid not null
);

create table public.entries (
  id uuid default gen_random_uuid() not null,
  month_id uuid not null,
  category_id uuid not null,
  description text not null,
  amount numeric(14,2) not null,
  type entry_type not null,
  status entry_status default 'previsto'::entry_status not null,
  is_recurring boolean default false not null,
  planned_date date,
  realized_at date,
  color_hint text,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  workspace_id uuid not null
);

create table public.monthly_balances (
  month_id uuid not null,
  receita_total numeric(14,2) default 0 not null,
  despesa_total numeric(14,2) default 0 not null,
  despesa_recorrente numeric(14,2) default 0 not null,
  investimento_total numeric(14,2) default 0 not null,
  resultado_mes numeric(14,2) default 0 not null,
  resultado_anterior numeric(14,2) default 0 not null,
  resultado_acumulado numeric(14,2) default 0 not null,
  calculated_at timestamp with time zone default now() not null,
  workspace_id uuid not null
);

create table public.months (
  id uuid default gen_random_uuid() not null,
  month_start date not null,
  month_end date generated always as (((month_start + '1 mon -1 days'::interval))::date) stored,
  closed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  workspace_id uuid not null
);

create table public.recurrence_rules (
  id uuid default gen_random_uuid() not null,
  category_id uuid not null,
  description text not null,
  amount numeric(14,2) not null,
  type entry_type not null,
  freq recurrence_freq default 'mensal'::recurrence_freq not null,
  day_of_month integer default 1 not null,
  start_month date not null,
  end_month date,
  active boolean default true not null,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  workspace_id uuid not null
);

create table public.user_invites (
  id uuid default gen_random_uuid() not null,
  email text not null,
  role text not null,
  created_at timestamp with time zone default now() not null,
  accepted_at timestamp with time zone,
  workspace_id uuid not null
);

create table public.user_profiles (
  id uuid not null,
  email text,
  role text default 'viewer'::text not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.workspace_members (
  workspace_id uuid not null,
  user_id uuid not null,
  role text not null,
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

alter table public.categories add constraint categories_group_id_fkey FOREIGN KEY (group_id) REFERENCES category_groups(id) ON DELETE RESTRICT;

alter table public.categories add constraint categories_pkey PRIMARY KEY (id);

alter table public.categories add constraint categories_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.category_groups add constraint category_groups_pkey PRIMARY KEY (id);

alter table public.category_groups add constraint category_groups_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.entries add constraint entries_amount_check CHECK (amount >= 0::numeric);

alter table public.entries add constraint entries_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT;

alter table public.entries add constraint entries_month_id_fkey FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE;

alter table public.entries add constraint entries_pkey PRIMARY KEY (id);

alter table public.entries add constraint entries_realized_date_chk CHECK (status = 'realizado'::entry_status AND realized_at IS NOT NULL OR status <> 'realizado'::entry_status);

alter table public.entries add constraint entries_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.monthly_balances add constraint monthly_balances_month_id_fkey FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE;

alter table public.monthly_balances add constraint monthly_balances_pkey PRIMARY KEY (month_id);

alter table public.monthly_balances add constraint monthly_balances_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.months add constraint months_first_day_chk CHECK (month_start = date_trunc('month'::text, month_start::timestamp with time zone)::date);

alter table public.months add constraint months_pkey PRIMARY KEY (id);

alter table public.months add constraint months_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.recurrence_rules add constraint recurrence_end_month_chk CHECK (end_month IS NULL OR end_month = date_trunc('month'::text, end_month::timestamp with time zone)::date);

alter table public.recurrence_rules add constraint recurrence_period_chk CHECK (end_month IS NULL OR end_month >= start_month);

alter table public.recurrence_rules add constraint recurrence_rules_amount_check CHECK (amount >= 0::numeric);

alter table public.recurrence_rules add constraint recurrence_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;

alter table public.recurrence_rules add constraint recurrence_rules_day_of_month_check CHECK (day_of_month >= 1 AND day_of_month <= 31);

alter table public.recurrence_rules add constraint recurrence_rules_pkey PRIMARY KEY (id);

alter table public.recurrence_rules add constraint recurrence_rules_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.recurrence_rules add constraint recurrence_start_month_chk CHECK (start_month = date_trunc('month'::text, start_month::timestamp with time zone)::date);

alter table public.user_invites add constraint user_invites_pkey PRIMARY KEY (id);

alter table public.user_invites add constraint user_invites_role_check CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'viewer'::text]));

alter table public.user_invites add constraint user_invites_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.user_profiles add constraint user_profiles_email_key UNIQUE (email);

alter table public.user_profiles add constraint user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.user_profiles add constraint user_profiles_pkey PRIMARY KEY (id);

alter table public.user_profiles add constraint user_profiles_role_check CHECK (role = ANY (ARRAY['admin'::text, 'viewer'::text]));

alter table public.workspace_members add constraint workspace_members_pkey PRIMARY KEY (workspace_id, user_id);

alter table public.workspace_members add constraint workspace_members_role_check CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'viewer'::text]));

alter table public.workspace_members add constraint workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.workspace_members add constraint workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

alter table public.workspaces add constraint workspaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table public.workspaces add constraint workspaces_pkey PRIMARY KEY (id);

alter table public.workspaces add constraint workspaces_slug_key UNIQUE (slug);

alter table public.workspaces add constraint workspaces_status_check CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]));

CREATE INDEX idx_categories_workspace ON public.categories USING btree (workspace_id);

CREATE INDEX idx_category_groups_workspace ON public.category_groups USING btree (workspace_id);

CREATE INDEX idx_entries_category ON public.entries USING btree (category_id);

CREATE INDEX idx_entries_month ON public.entries USING btree (month_id);

CREATE INDEX idx_entries_month_status ON public.entries USING btree (month_id, status);

CREATE INDEX idx_entries_month_type ON public.entries USING btree (month_id, type);

CREATE INDEX idx_entries_status ON public.entries USING btree (status);

CREATE INDEX idx_entries_type ON public.entries USING btree (type);

CREATE INDEX idx_entries_workspace_month ON public.entries USING btree (workspace_id, month_id);

CREATE INDEX idx_recurrence_active_period ON public.recurrence_rules USING btree (active, start_month, end_month);

CREATE INDEX idx_recurrence_workspace ON public.recurrence_rules USING btree (workspace_id, active);

CREATE UNIQUE INDEX uq_categories_workspace_code ON public.categories USING btree (workspace_id, code);

CREATE UNIQUE INDEX uq_categories_workspace_group_name ON public.categories USING btree (workspace_id, group_id, name);

CREATE UNIQUE INDEX uq_category_groups_workspace_code ON public.category_groups USING btree (workspace_id, code);

CREATE UNIQUE INDEX uq_category_groups_workspace_name ON public.category_groups USING btree (workspace_id, name);

CREATE UNIQUE INDEX uq_months_workspace_start ON public.months USING btree (workspace_id, month_start);

CREATE UNIQUE INDEX uq_user_invites_workspace_email ON public.user_invites USING btree (workspace_id, lower(email));

create or replace view public.v_monthly_totals as  SELECT m.workspace_id,
    m.id AS month_id,
    m.month_start,
    COALESCE(sum(
        CASE
            WHEN e.type = 'receita'::entry_type AND e.status <> 'cancelado'::entry_status THEN e.amount
            ELSE NULL::numeric
        END), 0::numeric) AS receita_total,
    COALESCE(sum(
        CASE
            WHEN e.type = 'despesa'::entry_type AND e.status <> 'cancelado'::entry_status THEN e.amount
            ELSE NULL::numeric
        END), 0::numeric) AS despesa_total,
    COALESCE(sum(
        CASE
            WHEN e.type = 'despesa'::entry_type AND e.is_recurring AND e.status <> 'cancelado'::entry_status THEN e.amount
            ELSE NULL::numeric
        END), 0::numeric) AS despesa_recorrente,
    COALESCE(sum(
        CASE
            WHEN e.type = 'investimento'::entry_type AND e.status <> 'cancelado'::entry_status THEN e.amount
            ELSE NULL::numeric
        END), 0::numeric) AS investimento_total,
    COALESCE(sum(
        CASE
            WHEN e.type = 'receita'::entry_type AND e.status <> 'cancelado'::entry_status THEN e.amount
            ELSE NULL::numeric
        END), 0::numeric) - COALESCE(sum(
        CASE
            WHEN (e.type = ANY (ARRAY['despesa'::entry_type, 'investimento'::entry_type])) AND e.status <> 'cancelado'::entry_status THEN e.amount
            ELSE NULL::numeric
        END), 0::numeric) AS resultado_mes
   FROM months m
     LEFT JOIN entries e ON e.month_id = m.id AND e.workspace_id = m.workspace_id
  GROUP BY m.workspace_id, m.id, m.month_start;;

create or replace view public.v_monthly_totals_by_status as  SELECT m.workspace_id,
    m.id AS month_id,
    m.month_start,
    e.status,
    COALESCE(sum(
        CASE
            WHEN e.type = 'receita'::entry_type THEN e.amount
            ELSE NULL::numeric
        END), 0::numeric) AS receita_total,
    COALESCE(sum(
        CASE
            WHEN e.type = 'despesa'::entry_type THEN e.amount
            ELSE NULL::numeric
        END), 0::numeric) AS despesa_total,
    COALESCE(sum(
        CASE
            WHEN e.type = 'investimento'::entry_type THEN e.amount
            ELSE NULL::numeric
        END), 0::numeric) AS investimento_total
   FROM months m
     LEFT JOIN entries e ON e.month_id = m.id AND e.workspace_id = m.workspace_id
  GROUP BY m.workspace_id, m.id, m.month_start, e.status;;

CREATE OR REPLACE FUNCTION public.current_user_role()
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
      and wm.role = any (p_roles)
  );
$function$


CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and role = 'admin'
      and active = true
  );
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


CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_category_groups_updated_at BEFORE UPDATE ON category_groups FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_entries_updated_at BEFORE UPDATE ON entries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_months_updated_at BEFORE UPDATE ON months FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_recurrence_rules_updated_at BEFORE UPDATE ON recurrence_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_workspace_members_updated_at BEFORE UPDATE ON workspace_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION set_updated_at();

alter table public.categories enable row level security;

alter table public.category_groups enable row level security;

alter table public.entries enable row level security;

alter table public.monthly_balances enable row level security;

alter table public.months enable row level security;

alter table public.recurrence_rules enable row level security;

alter table public.user_invites enable row level security;

alter table public.user_profiles enable row level security;

alter table public.workspace_members enable row level security;

alter table public.workspaces enable row level security;

create policy categories_select_workspace on public.categories for select to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'viewer'::text]));

create policy categories_write_workspace on public.categories for all to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text])) with check (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text]));

create policy category_groups_select_workspace on public.category_groups for select to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'viewer'::text]));

create policy category_groups_write_workspace on public.category_groups for all to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text])) with check (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text]));

create policy entries_select_workspace on public.entries for select to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'viewer'::text]));

create policy entries_write_workspace on public.entries for all to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text])) with check (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text]));

create policy monthly_balances_select_workspace on public.monthly_balances for select to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'viewer'::text]));

create policy monthly_balances_write_workspace on public.monthly_balances for all to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text])) with check (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text]));

create policy months_select_workspace on public.months for select to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'viewer'::text]));

create policy months_write_workspace on public.months for all to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text])) with check (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text]));

create policy recurrence_rules_select_workspace on public.recurrence_rules for select to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'viewer'::text]));

create policy recurrence_rules_write_workspace on public.recurrence_rules for all to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text])) with check (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text]));

create policy user_invites_workspace_admin on public.user_invites for all to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text])) with check (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text]));

create policy user_profiles_insert_self on public.user_profiles for insert to authenticated with check ((id = auth.uid()));

create policy user_profiles_select on public.user_profiles for select to authenticated using (((id = auth.uid()) OR is_admin()));

create policy user_profiles_update on public.user_profiles for update to authenticated using (is_admin()) with check (is_admin());

create policy workspace_members_select_member on public.workspace_members for select to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text, 'viewer'::text]));

create policy workspace_members_write_owner_admin on public.workspace_members for all to authenticated using (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text])) with check (has_workspace_role(workspace_id, ARRAY['owner'::text, 'admin'::text]));

create policy workspaces_insert_owner on public.workspaces for insert to authenticated with check (((created_by = auth.uid()) OR (created_by IS NULL)));

create policy workspaces_select_member on public.workspaces for select to authenticated using (has_workspace_role(id, ARRAY['owner'::text, 'admin'::text, 'viewer'::text]));

create policy workspaces_update_owner on public.workspaces for update to authenticated using (has_workspace_role(id, ARRAY['owner'::text])) with check (has_workspace_role(id, ARRAY['owner'::text]));