-- ============================================================
-- S5: Bootstrap workspace RPC + GRANTs + trigger fix
-- ============================================================

-- 1. Trigger to auto-create user_profiles on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. RPC: creates workspace + membership in one transaction (security definer bypasses RLS)
create or replace function public.bootstrap_workspace(p_name text default 'Workspace Principal')
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
begin
  insert into public.workspaces (name, status, created_by)
  values (p_name, 'active', v_user_id)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, active)
  values (v_workspace_id, v_user_id, 'owner', true);

  return v_workspace_id;
end;
$function$;

grant execute on function public.bootstrap_workspace(text) to authenticated;

-- 3. Bootstrap policy for workspace_members (allows creator to self-add)
create policy "workspace_members.creator:insert" on public.workspace_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.workspaces w
      where w.id = workspace_id
        and w.created_by = auth.uid()
    )
  );

-- 4. Table-level GRANTs (RLS still controls row-level access)
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.user_profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.workspace_invites to authenticated;
grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.fiscal_periods to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.recurrences to authenticated;
grant select, insert, update, delete on public.period_balances to authenticated;
grant select, insert, update, delete on public.audit_events to authenticated;
grant select, insert, update, delete on public.import_jobs to authenticated;
grant select, insert, update, delete on public.import_job_rows to authenticated;

grant select on public.v_period_totals to authenticated;
grant select on public.v_period_totals_by_status to authenticated;
