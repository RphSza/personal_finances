-- Sprint S2: idempotent recurrence materialization + audit trail
-- Note: Base tables and columns are defined in schema_snapshot.sql.
-- This migration exists for auditability and is idempotent.

alter table public.transactions
  add column if not exists recurrence_materialization_key text;

create unique index if not exists uq_transactions_workspace_recurrence_key
  on public.transactions(workspace_id, recurrence_materialization_key)
  where recurrence_materialization_key is not null;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  period_id uuid references public.fiscal_periods(id) on delete set null,
  event_type text not null,
  event_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists uq_audit_events_workspace_key
  on public.audit_events(workspace_id, event_key);

create index if not exists idx_audit_events_workspace_type_created
  on public.audit_events(workspace_id, event_type, created_at desc);

alter table public.audit_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'audit_events' and policyname = 'audit_events.member:select') then
    create policy "audit_events.member:select" on public.audit_events
      for select to authenticated
      using (has_workspace_role(workspace_id, array['owner','admin','viewer']));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'audit_events' and policyname = 'audit_events.admin:write') then
    create policy "audit_events.admin:write" on public.audit_events
      for all to authenticated
      using (has_workspace_role(workspace_id, array['owner','admin']))
      with check (has_workspace_role(workspace_id, array['owner','admin']));
  end if;
end $$;
