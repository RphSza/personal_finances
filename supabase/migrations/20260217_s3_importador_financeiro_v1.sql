-- Sprint S3: financial importer v1 (CSV/OFX) with batch audit trail
-- Note: Base tables are defined in schema_snapshot.sql.
-- This migration exists for auditability and is idempotent.

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  period_id uuid not null references public.fiscal_periods(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  source_format text not null check (source_format in ('csv', 'ofx')),
  file_name text not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  error_rows integer not null default 0 check (error_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_import_jobs_workspace_created
  on public.import_jobs(workspace_id, created_at desc);
create index if not exists idx_import_jobs_workspace_period
  on public.import_jobs(workspace_id, period_id, created_at desc);

create table if not exists public.import_job_rows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null references public.import_jobs(id) on delete cascade,
  period_id uuid not null references public.fiscal_periods(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  row_index integer not null check (row_index > 0),
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  type transaction_type not null,
  occurrence_date date,
  dedupe_key text not null,
  is_duplicate boolean not null default false,
  is_error boolean not null default false,
  error_reason text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_import_job_rows_job
  on public.import_job_rows(job_id, row_index);
create index if not exists idx_import_job_rows_workspace_dedupe
  on public.import_job_rows(workspace_id, dedupe_key);

alter table public.import_jobs enable row level security;
alter table public.import_job_rows enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'import_jobs' and policyname = 'import_jobs.member:select') then
    create policy "import_jobs.member:select" on public.import_jobs
      for select to authenticated
      using (has_workspace_role(workspace_id, array['owner','admin','viewer']));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'import_jobs' and policyname = 'import_jobs.admin:write') then
    create policy "import_jobs.admin:write" on public.import_jobs
      for all to authenticated
      using (has_workspace_role(workspace_id, array['owner','admin']) and created_by = auth.uid())
      with check (has_workspace_role(workspace_id, array['owner','admin']) and created_by = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where tablename = 'import_job_rows' and policyname = 'import_job_rows.member:select') then
    create policy "import_job_rows.member:select" on public.import_job_rows
      for select to authenticated
      using (has_workspace_role(workspace_id, array['owner','admin','viewer']));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'import_job_rows' and policyname = 'import_job_rows.admin:write') then
    create policy "import_job_rows.admin:write" on public.import_job_rows
      for all to authenticated
      using (has_workspace_role(workspace_id, array['owner','admin']))
      with check (has_workspace_role(workspace_id, array['owner','admin']));
  end if;
end $$;
