-- ============================================================
-- S6: RBAC — Add 'member' workspace role + Rename global roles
-- ============================================================
-- IMPORTANT: Run section 1a FIRST (outside a transaction), then
-- run the rest. ALTER TYPE ADD VALUE cannot run inside a transaction.
-- ============================================================

-- ============================================================
-- 1a. Add 'member' to workspace_role enum
-- ============================================================
ALTER TYPE public.workspace_role ADD VALUE IF NOT EXISTS 'member' BEFORE 'viewer';

-- ============================================================
-- 1b. Rename global roles in user_profiles
-- ============================================================
-- Drop the old constraint FIRST so the UPDATE can set new values
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

UPDATE public.user_profiles SET role = 'internal' WHERE role = 'admin';
UPDATE public.user_profiles SET role = 'client'   WHERE role = 'user';

ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role = ANY (ARRAY['internal'::text, 'client'::text]));

ALTER TABLE public.user_profiles ALTER COLUMN role SET DEFAULT 'client';

-- ============================================================
-- 1c. Update handle_new_user() — insert 'client' instead of 'user'
-- ============================================================
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
$function$;

-- ============================================================
-- 1d. Update is_admin() — check 'internal' instead of 'admin'
-- ============================================================
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
$function$;

-- ============================================================
-- 1e. Update RLS SELECT policies — add 'member'
-- ============================================================

-- workspaces
DROP POLICY IF EXISTS "workspaces.member:select" ON public.workspaces;
CREATE POLICY "workspaces.member:select" ON public.workspaces
  FOR SELECT TO authenticated
  USING (has_workspace_role(id, ARRAY['owner','admin','member','viewer']));

-- workspace_members
DROP POLICY IF EXISTS "workspace_members.member:select" ON public.workspace_members;
CREATE POLICY "workspace_members.member:select" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','member','viewer']));

-- groups
DROP POLICY IF EXISTS "groups.authenticated:select" ON public.groups;
CREATE POLICY "groups.authenticated:select" ON public.groups
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (workspace_id IS NULL OR has_workspace_role(workspace_id, ARRAY['owner','admin','member','viewer'])));

-- categories
DROP POLICY IF EXISTS "categories.authenticated:select" ON public.categories;
CREATE POLICY "categories.authenticated:select" ON public.categories
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (workspace_id IS NULL OR has_workspace_role(workspace_id, ARRAY['owner','admin','member','viewer'])));

-- fiscal_periods
DROP POLICY IF EXISTS "fiscal_periods.member:select" ON public.fiscal_periods;
CREATE POLICY "fiscal_periods.member:select" ON public.fiscal_periods
  FOR SELECT TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','member','viewer']));

-- transactions
DROP POLICY IF EXISTS "transactions.member:select" ON public.transactions;
CREATE POLICY "transactions.member:select" ON public.transactions
  FOR SELECT TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','member','viewer']));

-- recurrences
DROP POLICY IF EXISTS "recurrences.member:select" ON public.recurrences;
CREATE POLICY "recurrences.member:select" ON public.recurrences
  FOR SELECT TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','member','viewer']));

-- period_balances
DROP POLICY IF EXISTS "period_balances.member:select" ON public.period_balances;
CREATE POLICY "period_balances.member:select" ON public.period_balances
  FOR SELECT TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','member','viewer']));

-- audit_events
DROP POLICY IF EXISTS "audit_events.member:select" ON public.audit_events;
CREATE POLICY "audit_events.member:select" ON public.audit_events
  FOR SELECT TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','member','viewer']));

-- import_jobs
DROP POLICY IF EXISTS "import_jobs.member:select" ON public.import_jobs;
CREATE POLICY "import_jobs.member:select" ON public.import_jobs
  FOR SELECT TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','member','viewer']));

-- import_job_rows
DROP POLICY IF EXISTS "import_job_rows.member:select" ON public.import_job_rows;
CREATE POLICY "import_job_rows.member:select" ON public.import_job_rows
  FOR SELECT TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','member','viewer']));

-- ============================================================
-- 1f. Update RLS WRITE policies — add 'member' to data tables
-- ============================================================

-- transactions
DROP POLICY IF EXISTS "transactions.admin:write" ON public.transactions;
CREATE POLICY "transactions.writer:write" ON public.transactions
  FOR ALL TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','member']))
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','member']));

-- fiscal_periods
DROP POLICY IF EXISTS "fiscal_periods.admin:write" ON public.fiscal_periods;
CREATE POLICY "fiscal_periods.writer:write" ON public.fiscal_periods
  FOR ALL TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','member']))
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','member']));

-- recurrences
DROP POLICY IF EXISTS "recurrences.admin:write" ON public.recurrences;
CREATE POLICY "recurrences.writer:write" ON public.recurrences
  FOR ALL TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','member']))
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','member']));

-- period_balances
DROP POLICY IF EXISTS "period_balances.admin:write" ON public.period_balances;
CREATE POLICY "period_balances.writer:write" ON public.period_balances
  FOR ALL TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','member']))
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','member']));

-- audit_events
DROP POLICY IF EXISTS "audit_events.admin:write" ON public.audit_events;
CREATE POLICY "audit_events.writer:write" ON public.audit_events
  FOR ALL TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','member']))
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','member']));

-- import_jobs (also requires created_by = auth.uid())
DROP POLICY IF EXISTS "import_jobs.admin:write" ON public.import_jobs;
CREATE POLICY "import_jobs.writer:write" ON public.import_jobs
  FOR ALL TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','member']) AND created_by = auth.uid())
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','member']) AND created_by = auth.uid());

-- import_job_rows
DROP POLICY IF EXISTS "import_job_rows.admin:write" ON public.import_job_rows;
CREATE POLICY "import_job_rows.writer:write" ON public.import_job_rows
  FOR ALL TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','member']))
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','member']));

-- groups (workspace-scoped uses member; global uses is_admin())
DROP POLICY IF EXISTS "groups.admin:write" ON public.groups;
CREATE POLICY "groups.writer:write" ON public.groups
  FOR ALL TO authenticated
  USING ((workspace_id IS NULL AND is_admin()) OR (workspace_id IS NOT NULL AND has_workspace_role(workspace_id, ARRAY['owner','admin','member'])))
  WITH CHECK ((workspace_id IS NULL AND is_admin()) OR (workspace_id IS NOT NULL AND has_workspace_role(workspace_id, ARRAY['owner','admin','member'])));

-- categories (workspace-scoped uses member; global uses is_admin())
DROP POLICY IF EXISTS "categories.admin:write" ON public.categories;
CREATE POLICY "categories.writer:write" ON public.categories
  FOR ALL TO authenticated
  USING ((workspace_id IS NULL AND is_admin()) OR (workspace_id IS NOT NULL AND has_workspace_role(workspace_id, ARRAY['owner','admin','member'])))
  WITH CHECK ((workspace_id IS NULL AND is_admin()) OR (workspace_id IS NOT NULL AND has_workspace_role(workspace_id, ARRAY['owner','admin','member'])));

-- ============================================================
-- Management policies stay admin-only (no member):
--   workspace_members.admin:write  → owner, admin
--   workspace_invites.admin:all    → owner, admin
--   workspaces.owner:update        → owner only
-- These are NOT modified.
-- ============================================================
