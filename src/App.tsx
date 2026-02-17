import { FormEvent, Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { addMonths, format, isAfter, lastDayOfMonth, parseISO, setDate } from "date-fns";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { LoadingCard, Spinner } from "./components/LoadingState";
import { KpiSummary } from "./features/dashboard/KpiSummary";
import { Sidebar } from "./layout/Sidebar";
import { MainHeader } from "./layout/MainHeader";
import type { AppPage, EntryViewMode, SettingsView, TrendMode } from "./features/app/types";
import type {
  CategoryGroupRow,
  CategoryRow,
  EntryForm,
  EntryRow,
  EntryStatus,
  EntryType,
  MonthRow,
  MonthlyTotals,
  MonthlyTotalsByStatus,
  UserInviteRow,
  UserProfileRow,
  UserRole
} from "./types";

const defaultEntryForm: EntryForm = {
  description: "",
  amount: "",
  type: "despesa",
  status: "previsto",
  categoryId: "",
  isRecurring: false,
  plannedDate: "",
  realizedAt: "",
  notes: ""
};

const monthStartIso = (date: Date) => format(date, "yyyy-MM-01");
const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const slugify = (input: string) =>
  input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
const parseMoney = (raw: string) => Number(raw.replace(/\./g, "").replace(",", "."));
const AuthScreen = lazy(() =>
  import("./features/auth/AuthScreen").then((module) => ({ default: module.AuthScreen }))
);
const DashboardPage = lazy(() =>
  import("./features/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage }))
);
const EntriesPage = lazy(() =>
  import("./features/entries/EntriesPage").then((module) => ({ default: module.EntriesPage }))
);
const SettingsPage = lazy(() =>
  import("./features/settings/SettingsPage").then((module) => ({ default: module.SettingsPage }))
);
function App() {
  const [sessionReady, setSessionReady] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  const [entryViewMode, setEntryViewMode] = useState<EntryViewMode>("list");
  const [selectedMonth, setSelectedMonth] = useState(monthStartIso(new Date()));

  const [monthRow, setMonthRow] = useState<MonthRow | null>(null);
  const [groups, setGroups] = useState<CategoryGroupRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [totals, setTotals] = useState<MonthlyTotals | null>(null);
  const [users, setUsers] = useState<UserProfileRow[]>([]);
  const [invites, setInvites] = useState<UserInviteRow[]>([]);
  const [trendRows, setTrendRows] = useState<MonthlyTotals[]>([]);
  const [trendStatusRows, setTrendStatusRows] = useState<MonthlyTotalsByStatus[]>([]);
  const [trendWindow, setTrendWindow] = useState<6 | 12 | 24>(12);
  const [trendMode, setTrendMode] = useState<TrendMode>("rxd");

  const [entryForm, setEntryForm] = useState<EntryForm>(defaultEntryForm);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"todos" | EntryStatus>("todos");

  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [categoryGroupId, setCategoryGroupId] = useState("");
  const [categoryType, setCategoryType] = useState<EntryType>("despesa");
  const [categoryRecurring, setCategoryRecurring] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("viewer");

  const [loading, setLoading] = useState(false);
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();

  const page: AppPage = pathname.startsWith("/entries")
    ? "entries"
    : pathname.startsWith("/settings")
      ? "settings"
      : "dashboard";
  const settingsView: SettingsView =
    pathname === "/settings/groups"
      ? "groups"
      : pathname === "/settings/categories"
        ? "categories"
        : pathname === "/settings/users"
          ? "users"
          : "hub";

  const isAdmin = role === "admin" || role === "owner";
  const showFinancialChrome = page !== "settings";
  const pageTitle =
    page === "dashboard"
      ? "Dashboard"
      : page === "entries"
        ? "Lançamentos"
        : settingsView === "hub"
          ? "Configurações"
          : settingsView === "groups"
            ? "Configurações - Grupos"
            : settingsView === "categories"
              ? "Configurações - Categorias"
              : "Configurações - Usuários";

  const visibleEntries = useMemo(
    () => (statusFilter === "todos" ? entries : entries.filter((entry) => entry.status === statusFilter)),
    [entries, statusFilter]
  );

  const categoryById = useMemo(
    () => categories.reduce<Record<string, CategoryRow>>((acc, cat) => ((acc[cat.id] = cat), acc), {}),
    [categories]
  );
  const groupById = useMemo(
    () => groups.reduce<Record<string, CategoryGroupRow>>((acc, g) => ((acc[g.id] = g), acc), {}),
    [groups]
  );

  const computedTotals = useMemo<MonthlyTotals>(() => {
    if (totals) return totals;
    const receitaTotal = entries
      .filter((e) => e.status !== "cancelado" && e.type === "receita")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const despesaTotal = entries
      .filter((e) => e.status !== "cancelado" && e.type === "despesa")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const investimentoTotal = entries
      .filter((e) => e.status !== "cancelado" && e.type === "investimento")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const despesaRecorrente = entries
      .filter((e) => e.status !== "cancelado" && e.type === "despesa" && e.is_recurring)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    return {
      month_id: monthRow?.id ?? "",
      month_start: selectedMonth,
      receita_total: receitaTotal,
      despesa_total: despesaTotal,
      despesa_recorrente: despesaRecorrente,
      investimento_total: investimentoTotal,
      resultado_mes: receitaTotal - despesaTotal - investimentoTotal
    };
  }, [entries, monthRow?.id, selectedMonth, totals]);

  const boardRows = useMemo(() => {
    const byGroup: Record<string, EntryRow[]> = {};
    for (const entry of visibleEntries) {
      const groupId = categoryById[entry.category_id]?.group_id ?? "unassigned";
      (byGroup[groupId] ??= []).push(entry);
    }
    return Object.entries(byGroup).map(([groupId, rows]) => ({
      groupId,
      groupName: groupById[groupId]?.name ?? "Sem grupo",
      total: rows.reduce((sum, row) => sum + Number(row.amount), 0),
      rows
    }));
  }, [categoryById, groupById, visibleEntries]);

  const topExpenseCategories = useMemo(() => {
    const map = new Map<string, number>();
    entries
      .filter((entry) => entry.type === "despesa" && entry.status !== "cancelado")
      .forEach((entry) => {
        map.set(entry.category_id, (map.get(entry.category_id) ?? 0) + Number(entry.amount));
      });
    const rows = [...map.entries()]
      .map(([categoryId, total]) => ({
        categoryId,
        name: categoryById[categoryId]?.name ?? "Sem categoria",
        total
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
    const max = Math.max(...rows.map((row) => row.total), 1);
    return { rows, max };
  }, [entries, categoryById]);

  const monthStrip = useMemo(() => {
    const base = parseISO(selectedMonth);
    return Array.from({ length: 13 }, (_, i) => {
      const date = addMonths(base, i - 6);
      return { value: monthStartIso(date), label: format(date, "MMM/yy") };
    });
  }, [selectedMonth]);

  const trendMaxValue = useMemo(
    () => Math.max(...trendRows.flatMap((item) => [item.receita_total, item.despesa_total]), 1),
    [trendRows]
  );
  const trendResultMaxAbs = useMemo(
    () => Math.max(...trendRows.map((item) => Math.abs(item.resultado_mes)), 1),
    [trendRows]
  );

  const monthlyStatusTrend = useMemo(() => {
    const monthMap = new Map<
      string,
      { previsto: number; realizado: number; monthLabel: string }
    >();

    for (const row of trendRows) {
      monthMap.set(row.month_start, {
        previsto: 0,
        realizado: 0,
        monthLabel: format(parseISO(row.month_start), "MMM/yy")
      });
    }

    for (const row of trendStatusRows) {
      const month = monthMap.get(row.month_start);
      if (!month || !row.status) continue;
      const resultado = Number(row.receita_total) - Number(row.despesa_total) - Number(row.investimento_total);
      if (row.status === "previsto") month.previsto += resultado;
      if (row.status === "realizado") month.realizado += resultado;
    }

    const rows = [...monthMap.entries()].map(([monthStart, values]) => ({
      monthStart,
      ...values
    }));
    const maxAbs = Math.max(...rows.map((row) => Math.max(Math.abs(row.previsto), Math.abs(row.realizado))), 1);
    return { rows, maxAbs };
  }, [trendRows, trendStatusRows]);

  const ensureProfile = useCallback(async (id: string, email: string | null) => {
    if (!supabase) return;
    const { data, error } = await supabase.from("user_profiles").select("id").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) {
      const { error: createError } = await supabase
        .from("user_profiles")
        .insert({ id, email, role: "viewer", active: true });
      if (createError) throw createError;
    }
  }, []);

  const ensureWorkspaceContext = useCallback(
    async (id: string, email: string | null) => {
      if (!supabase) return;

      if (email) {
        const { data: pendingInvites, error: inviteError } = await supabase
          .from("user_invites")
          .select("id, workspace_id, role")
          .is("accepted_at", null)
          .ilike("email", email);
        if (inviteError) throw inviteError;

        if (pendingInvites && pendingInvites.length > 0) {
          const memberships = pendingInvites.map((invite) => ({
            workspace_id: invite.workspace_id,
            user_id: id,
            role: invite.role,
            active: true
          }));
          const { error: membershipError } = await supabase
            .from("workspace_members")
            .upsert(memberships, { onConflict: "workspace_id,user_id" });
          if (membershipError) throw membershipError;

          const inviteIds = pendingInvites.map((invite) => invite.id);
          const { error: acceptError } = await supabase
            .from("user_invites")
            .update({ accepted_at: new Date().toISOString() })
            .in("id", inviteIds);
          if (acceptError) throw acceptError;
        }
      }

      const { data: memberships, error } = await supabase
        .from("workspace_members")
        .select("workspace_id, role, active")
        .eq("user_id", id)
        .eq("active", true)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (memberships && memberships.length > 0) {
        setCurrentWorkspaceId(memberships[0].workspace_id as string);
        setRole(memberships[0].role as UserRole);
        return;
      }

      const { data: workspace, error: wsError } = await supabase
        .from("workspaces")
        .insert({ name: "Workspace Principal", status: "active", created_by: id })
        .select("id")
        .single();
      if (wsError) throw wsError;

      const { error: memberError } = await supabase.from("workspace_members").insert({
        workspace_id: workspace.id,
        user_id: id,
        role: "owner",
        active: true
      });
      if (memberError) throw memberError;

      setCurrentWorkspaceId(workspace.id as string);
      setRole("owner");
    },
    []
  );

  const ensureMonth = useCallback(async (monthIso: string) => {
    if (!currentWorkspaceId) throw new Error("Workspace não selecionado.");
    const { data, error } = await supabase!
      .from("months")
      .select("id, month_start")
      .eq("workspace_id", currentWorkspaceId)
      .eq("month_start", monthIso)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as MonthRow;
    const { data: inserted, error: insertError } = await supabase!
      .from("months")
      .insert({ workspace_id: currentWorkspaceId, month_start: monthIso })
      .select("id, month_start")
      .single();
    if (insertError) throw insertError;
    return inserted as MonthRow;
  }, [currentWorkspaceId]);

  const syncRecurringRules = useCallback(
    async (month: MonthRow) => {
      if (!supabase || !isAdmin || !currentWorkspaceId) return;
      const { data: rules, error } = await supabase
        .from("recurrence_rules")
        .select("category_id, description, amount, type, day_of_month, start_month, end_month")
        .eq("workspace_id", currentWorkspaceId)
        .eq("active", true);
      if (error) throw error;

      const monthDate = parseISO(month.month_start);
      const valid = (rules ?? []).filter((rule) => {
        if (isAfter(parseISO(rule.start_month), monthDate)) return false;
        return !rule.end_month || !isAfter(monthDate, parseISO(rule.end_month));
      });
      if (!valid.length) return;

      const { data: existing, error: existingError } = await supabase
        .from("entries")
        .select("category_id, description")
        .eq("workspace_id", currentWorkspaceId)
        .eq("month_id", month.id);
      if (existingError) throw existingError;
      const existingKey = new Set((existing ?? []).map((e) => `${e.category_id}::${e.description}`));

      const inserts = valid
        .filter((r) => !existingKey.has(`${r.category_id}::${r.description}`))
        .map((rule) => ({
          workspace_id: currentWorkspaceId,
          month_id: month.id,
          category_id: rule.category_id,
          description: rule.description,
          amount: Number(rule.amount),
          type: rule.type,
          status: "previsto",
          is_recurring: true,
          planned_date: format(setDate(monthDate, Math.min(rule.day_of_month, lastDayOfMonth(monthDate).getDate())), "yyyy-MM-dd")
        }));
      if (inserts.length) {
        const { error: insertError } = await supabase.from("entries").insert(inserts);
        if (insertError) throw insertError;
      }
    },
    [currentWorkspaceId, isAdmin]
  );

  const loadData = useCallback(async () => {
    if (!supabase || !currentUserId || !role || !currentWorkspaceId) return;
    setLoading(true);
    setMessage("");
    try {
      const month = await ensureMonth(selectedMonth);
      setMonthRow(month);
      await syncRecurringRules(month);

      const trendStart = monthStartIso(addMonths(parseISO(selectedMonth), -(trendWindow - 1)));
      const [groupsRes, categoriesRes, entriesRes, totalsRes, trendRes, trendStatusRes] = await Promise.all([
        supabase
          .from("category_groups")
          .select("id, code, name, sort_order")
          .eq("workspace_id", currentWorkspaceId)
          .order("sort_order")
          .order("name"),
        supabase
          .from("categories")
          .select("id, group_id, code, name, default_type, default_is_recurring, active")
          .eq("workspace_id", currentWorkspaceId)
          .order("sort_order")
          .order("name"),
        supabase
          .from("entries")
          .select("id, month_id, category_id, description, amount, type, status, is_recurring, planned_date, realized_at, notes, created_at")
          .eq("workspace_id", currentWorkspaceId)
          .eq("month_id", month.id)
          .order("created_at"),
        supabase
          .from("v_monthly_totals")
          .select("workspace_id, month_id, month_start, receita_total, despesa_total, despesa_recorrente, investimento_total, resultado_mes")
          .eq("workspace_id", currentWorkspaceId)
          .eq("month_start", selectedMonth)
          .maybeSingle(),
        supabase
          .from("v_monthly_totals")
          .select("workspace_id, month_id, month_start, receita_total, despesa_total, despesa_recorrente, investimento_total, resultado_mes")
          .eq("workspace_id", currentWorkspaceId)
          .gte("month_start", trendStart)
          .lte("month_start", selectedMonth)
          .order("month_start", { ascending: true }),
        supabase
          .from("v_monthly_totals_by_status")
          .select("workspace_id, month_id, month_start, status, receita_total, despesa_total, investimento_total")
          .eq("workspace_id", currentWorkspaceId)
          .gte("month_start", trendStart)
          .lte("month_start", selectedMonth)
          .order("month_start", { ascending: true })
      ]);
      if (groupsRes.error) throw groupsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (entriesRes.error) throw entriesRes.error;
      if (totalsRes.error) throw totalsRes.error;
      if (trendRes.error) throw trendRes.error;
      if (trendStatusRes.error) throw trendStatusRes.error;

      setGroups((groupsRes.data as CategoryGroupRow[]) ?? []);
      setCategories((categoriesRes.data as CategoryRow[]) ?? []);
      setEntries(((entriesRes.data as EntryRow[]) ?? []).map((e) => ({ ...e, amount: Number(e.amount) })));
      setTotals((totalsRes.data as MonthlyTotals | null) ?? null);
      setTrendRows(
        ((trendRes.data as MonthlyTotals[]) ?? []).map((row) => ({
          ...row,
          receita_total: Number(row.receita_total),
          despesa_total: Number(row.despesa_total),
          despesa_recorrente: Number(row.despesa_recorrente),
          investimento_total: Number(row.investimento_total),
          resultado_mes: Number(row.resultado_mes)
        }))
      );
      setTrendStatusRows(
        ((trendStatusRes.data as MonthlyTotalsByStatus[]) ?? []).map((row) => ({
          ...row,
          receita_total: Number(row.receita_total),
          despesa_total: Number(row.despesa_total),
          investimento_total: Number(row.investimento_total)
        }))
      );

      if (isAdmin) {
        const [usersRes, invitesRes] = await Promise.all([
          supabase
            .from("workspace_members")
            .select("workspace_id, user_id, role, active, created_at, user_profiles(email)")
            .eq("workspace_id", currentWorkspaceId)
            .order("created_at"),
          supabase
            .from("user_invites")
            .select("id, email, role, created_at, accepted_at")
            .eq("workspace_id", currentWorkspaceId)
            .order("created_at", { ascending: false })
        ]);
        if (usersRes.error) throw usersRes.error;
        if (invitesRes.error) throw invitesRes.error;
        setUsers(
          ((usersRes.data as Array<{ user_id: string; role: UserRole; active: boolean; created_at: string; user_profiles: Array<{ email: string | null }> | null }>) ?? []).map((row) => ({
            id: row.user_id,
            email: row.user_profiles?.[0]?.email ?? null,
            role: row.role,
            active: row.active,
            created_at: row.created_at
          }))
        );
        setInvites((invitesRes.data as UserInviteRow[]) ?? []);
      } else {
        setUsers([]);
        setInvites([]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, currentWorkspaceId, ensureMonth, isAdmin, role, selectedMonth, syncRecurringRules, trendWindow]);

  const saveRecurrenceRule = async (input: { categoryId: string; description: string; amount: number; type: EntryType; baseDate: string }) => {
    if (!supabase || !isAdmin || !currentWorkspaceId) return;
    const { data, error } = await supabase
      .from("recurrence_rules")
      .select("id")
      .eq("workspace_id", currentWorkspaceId)
      .eq("category_id", input.categoryId)
      .eq("description", input.description)
      .eq("active", true)
      .maybeSingle();
    if (error) throw error;
    const day = parseISO(input.baseDate).getDate();
    if (data?.id) {
      const { error: updateError } = await supabase.from("recurrence_rules").update({ amount: input.amount, type: input.type, day_of_month: day }).eq("id", data.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from("recurrence_rules").insert({ workspace_id: currentWorkspaceId, category_id: input.categoryId, description: input.description, amount: input.amount, type: input.type, day_of_month: day, freq: "mensal", start_month: selectedMonth, active: true });
      if (insertError) throw insertError;
    }
  };

  const submitEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !monthRow || !isAdmin || !currentWorkspaceId) return;
    const amount = parseMoney(entryForm.amount);
    if (!entryForm.description.trim() || !entryForm.categoryId || Number.isNaN(amount)) return;
    const payload = {
      workspace_id: currentWorkspaceId,
      month_id: monthRow.id,
      category_id: entryForm.categoryId,
      description: entryForm.description.trim(),
      amount,
      type: entryForm.type,
      status: entryForm.status,
      is_recurring: entryForm.isRecurring,
      planned_date: entryForm.plannedDate || null,
      realized_at: entryForm.status === "realizado" ? entryForm.realizedAt || format(new Date(), "yyyy-MM-dd") : null,
      notes: entryForm.notes.trim() || null
    };
    setEntrySubmitting(true);
    try {
      const { error } = editingEntryId
        ? await supabase.from("entries").update(payload).eq("id", editingEntryId)
        : await supabase.from("entries").insert(payload);
      if (error) return setMessage(error.message);
      if (entryForm.isRecurring) {
        await saveRecurrenceRule({
          categoryId: entryForm.categoryId,
          description: entryForm.description.trim(),
          amount,
          type: entryForm.type,
          baseDate: entryForm.plannedDate || entryForm.realizedAt || format(parseISO(selectedMonth), "yyyy-MM-dd")
        });
      }
      setEntryForm(defaultEntryForm);
      setEditingEntryId(null);
      await loadData();
    } finally {
      setEntrySubmitting(false);
    }
  };

  const editEntry = (entry: EntryRow) => {
    setEditingEntryId(entry.id);
    setEntryForm({
      description: entry.description,
      amount: String(Number(entry.amount).toFixed(2)).replace(".", ","),
      type: entry.type,
      status: entry.status,
      categoryId: entry.category_id,
      isRecurring: entry.is_recurring,
      plannedDate: entry.planned_date ?? "",
      realizedAt: entry.realized_at ?? "",
      notes: entry.notes ?? ""
    });
  };

  const runAdminAction = async (fn: () => Promise<void>, loadingKey: string) => {
    if (!isAdmin) return;
    setActionLoadingKey(loadingKey);
    try {
      await fn();
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na operação.");
    } finally {
      setActionLoadingKey(null);
    }
  };

  useEffect(() => {
    if (!supabase) return setSessionReady(true);
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user ?? null;
      setCurrentUserId(user?.id ?? null);
      setCurrentEmail(user?.email ?? null);
      if (user) {
        await ensureProfile(user.id, user.email ?? null);
        await ensureWorkspaceContext(user.id, user.email ?? null);
      } else {
        setRole(null);
        setCurrentWorkspaceId(null);
      }
      setSessionReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      setCurrentUserId(user?.id ?? null);
      setCurrentEmail(user?.email ?? null);
      if (user) {
        await ensureProfile(user.id, user.email ?? null);
        await ensureWorkspaceContext(user.id, user.email ?? null);
      } else {
        setRole(null);
        setCurrentWorkspaceId(null);
      }
      setSessionReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [ensureProfile, ensureWorkspaceContext]);

  useEffect(() => {
    if (currentUserId && role && currentWorkspaceId) void loadData();
  }, [currentUserId, currentWorkspaceId, role, loadData]);

  useEffect(() => {
    if (!sessionReady) return;
    if (!currentUserId && pathname !== "/auth/login") {
      void navigate({ to: "/auth/login", replace: true });
      return;
    }
    if (currentUserId && pathname.startsWith("/auth")) {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [currentUserId, navigate, pathname, sessionReady]);

  const getGroupName = (entry: EntryRow) =>
    groupById[categoryById[entry.category_id]?.group_id ?? ""]?.name ?? "-";

  const getCategoryName = (categoryId: string) => categoryById[categoryId]?.name ?? "-";

  const createGroup = () =>
    void runAdminAction(async () => {
      if (!currentWorkspaceId) return;
      const name = groupName.trim();
      if (!name) return;
      const code = (groupCode.trim() || slugify(name)).toUpperCase();
      const { error } = await supabase!.from("category_groups").insert({ workspace_id: currentWorkspaceId, name, code, sort_order: groups.length + 1 });
      if (error) throw error;
      setGroupName("");
      setGroupCode("");
    }, "create-group");

  const deleteGroup = (groupId: string) =>
    void runAdminAction(async () => {
      if (!currentWorkspaceId) return;
      const { error } = await supabase!.from("category_groups").delete().eq("workspace_id", currentWorkspaceId).eq("id", groupId);
      if (error) throw error;
    }, `delete-group-${groupId}`);

  const createCategory = () =>
    void runAdminAction(async () => {
      if (!currentWorkspaceId) return;
      const name = categoryName.trim();
      if (!name || !categoryGroupId) return;
      const code = categoryCode.trim() || slugify(name);
      const { error } = await supabase!
        .from("categories")
        .insert({
          workspace_id: currentWorkspaceId,
          name,
          code,
          group_id: categoryGroupId,
          default_type: categoryType,
          default_is_recurring: categoryRecurring
        });
      if (error) throw error;
      setCategoryName("");
      setCategoryCode("");
      setCategoryRecurring(false);
    }, "create-category");

  const deleteCategory = (categoryIdToDelete: string) =>
    void runAdminAction(async () => {
      if (!currentWorkspaceId) return;
      const { error } = await supabase!.from("categories").delete().eq("workspace_id", currentWorkspaceId).eq("id", categoryIdToDelete);
      if (error) throw error;
    }, `delete-category-${categoryIdToDelete}`);

  const createInvite = () =>
    void runAdminAction(async () => {
      if (!currentWorkspaceId) return;
      const email = inviteEmail.trim().toLowerCase();
      if (!email) return;
      const { error } = await supabase!
        .from("user_invites")
        .upsert({ workspace_id: currentWorkspaceId, email, role: inviteRole }, { onConflict: "workspace_id,email" });
      if (error) throw error;
      setInviteEmail("");
    }, "create-invite");

  const updateUserRole = (userId: string, nextRole: string) =>
    void runAdminAction(async () => {
      if (!currentWorkspaceId) return;
      const { error } = await supabase!
        .from("workspace_members")
        .update({ role: nextRole })
        .eq("workspace_id", currentWorkspaceId)
        .eq("user_id", userId);
      if (error) throw error;
    }, `update-role-${userId}`);

  const toggleUserActive = (userId: string, currentActive: boolean) =>
    void runAdminAction(async () => {
      if (!currentWorkspaceId) return;
      const { error } = await supabase!
        .from("workspace_members")
        .update({ active: !currentActive })
        .eq("workspace_id", currentWorkspaceId)
        .eq("user_id", userId);
      if (error) throw error;
    }, `toggle-user-${userId}`);

  if (!isSupabaseConfigured) {
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <LoadingCard label="Configure o Supabase no .env para iniciar." />
        </section>
      </div>
    );
  }
  if (!sessionReady) {
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <LoadingCard label="Verificando sessão..." />
        </section>
      </div>
    );
  }
  if (!currentUserId) {
    return (
      <Suspense
        fallback={
          <div className="auth-shell">
            <section className="auth-card">
              <LoadingCard label="Preparando autenticação..." />
            </section>
          </div>
        }
      >
        <AuthScreen />
      </Suspense>
    );
  }

  return (
    <div className="shell">
      <Sidebar
        page={page}
        currentEmail={currentEmail}
        role={role}
        onChangePage={(nextPage) =>
          void navigate({
            to: nextPage === "dashboard" ? "/dashboard" : nextPage === "entries" ? "/entries" : "/settings"
          })
        }
        onOpenSettingsHub={() => {
          void navigate({ to: "/settings" });
        }}
      />

      <div className="main-area">
        <MainHeader
          showFinancialChrome={showFinancialChrome}
          pageTitle={pageTitle}
          selectedMonth={selectedMonth}
          monthStrip={monthStrip}
          onSelectMonth={setSelectedMonth}
          onPrevMonth={() => setSelectedMonth(monthStartIso(addMonths(parseISO(selectedMonth), -1)))}
          onNextMonth={() => setSelectedMonth(monthStartIso(addMonths(parseISO(selectedMonth), 1)))}
        />

        {showFinancialChrome ? <KpiSummary totals={computedTotals} formatBRL={formatBRL} /> : null}
        {message ? <p className="feedback">{message}</p> : null}

        {page === "dashboard" ? (
          <Suspense fallback={<LoadingCard label="Carregando dashboard..." />}>
            <DashboardPage
              trendMode={trendMode}
              trendWindow={trendWindow}
              onChangeTrendMode={setTrendMode}
              onChangeTrendWindow={setTrendWindow}
              trendRows={trendRows}
              trendMaxValue={trendMaxValue}
              trendResultMaxAbs={trendResultMaxAbs}
              monthlyStatusTrend={monthlyStatusTrend}
              topExpenseCategories={topExpenseCategories}
              boardRows={boardRows}
              formatBRL={formatBRL}
            />
          </Suspense>
        ) : null}

        {page === "entries" ? (
          <Suspense fallback={<LoadingCard label="Carregando lançamentos..." />}>
            <EntriesPage
              statusFilter={statusFilter}
              onChangeStatusFilter={setStatusFilter}
              entryViewMode={entryViewMode}
              onChangeEntryViewMode={setEntryViewMode}
              visibleEntries={visibleEntries}
              boardRows={boardRows}
              categories={categories}
              entryForm={entryForm}
              editingEntryId={editingEntryId}
              isAdmin={isAdmin}
              formatBRL={formatBRL}
              getGroupName={getGroupName}
              getCategoryName={getCategoryName}
              onEditEntry={editEntry}
            onToggleEntryStatus={(entry) =>
              void runAdminAction(async () => {
                if (!currentWorkspaceId) return;
                const next = entry.status === "realizado" ? "previsto" : "realizado";
                const { error } = await supabase!
                  .from("entries")
                  .update({ status: next, realized_at: next === "realizado" ? format(new Date(), "yyyy-MM-dd") : null })
                  .eq("workspace_id", currentWorkspaceId)
                  .eq("id", entry.id);
                if (error) throw error;
              }, `toggle-entry-${entry.id}`)
            }
            onDeleteEntry={(entry) =>
              void runAdminAction(async () => {
                if (!currentWorkspaceId) return;
                const { error } = await supabase!.from("entries").delete().eq("workspace_id", currentWorkspaceId).eq("id", entry.id);
                if (error) throw error;
              }, `delete-entry-${entry.id}`)
            }
              onSubmitEntry={submitEntry}
              entrySubmitting={entrySubmitting}
              actionLoadingKey={actionLoadingKey}
              onCancelEdit={() => {
                setEditingEntryId(null);
                setEntryForm(defaultEntryForm);
              }}
              onEntryFormChange={setEntryForm}
            />
          </Suspense>
        ) : null}

        {page === "settings" ? (
          <Suspense fallback={<LoadingCard label="Carregando configurações..." />}>
            <SettingsPage
              settingsView={settingsView}
              isAdmin={isAdmin}
              groups={groups}
              categories={categories}
              users={users}
              invites={invites}
              groupById={groupById}
              groupName={groupName}
              groupCode={groupCode}
              categoryName={categoryName}
              categoryCode={categoryCode}
              categoryGroupId={categoryGroupId}
              categoryType={categoryType}
              categoryRecurring={categoryRecurring}
              inviteEmail={inviteEmail}
              inviteRole={inviteRole}
              onChangeSettingsView={(view) =>
                void navigate({
                  to:
                    view === "hub"
                      ? "/settings"
                      : view === "groups"
                        ? "/settings/groups"
                        : view === "categories"
                          ? "/settings/categories"
                          : "/settings/users"
                })
              }
              onChangeGroupName={setGroupName}
              onChangeGroupCode={setGroupCode}
              onChangeCategoryName={setCategoryName}
              onChangeCategoryCode={setCategoryCode}
              onChangeCategoryGroupId={setCategoryGroupId}
              onChangeCategoryType={setCategoryType}
              onChangeCategoryRecurring={setCategoryRecurring}
              onChangeInviteEmail={setInviteEmail}
              onChangeInviteRole={setInviteRole}
              onCreateGroup={createGroup}
              onDeleteGroup={deleteGroup}
              onCreateCategory={createCategory}
              onDeleteCategory={deleteCategory}
              onCreateInvite={createInvite}
              onChangeUserRole={updateUserRole}
              onToggleUserActive={toggleUserActive}
              actionLoadingKey={actionLoadingKey}
            />
          </Suspense>
        ) : null}

        {loading ? (
          <p className="loading-note loading-inline">
            <Spinner label="Atualizando dados..." compact />
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default App;







