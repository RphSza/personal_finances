import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { addMonths, format, parseISO } from "date-fns";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "../contexts/AuthContext";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { useFiscalPeriod } from "../hooks/useFiscalPeriods";
import { useTransactions, useSyncRecurrences } from "../hooks/useTransactions";
import { useCategoryGroups, useCategories } from "../hooks/useCategories";
import { usePeriodTotals, useTrend, useTrendByStatus } from "../hooks/useDashboard";
import { LoadingCard, Spinner } from "../components/LoadingState";
import { KpiSummary } from "../features/dashboard/KpiSummary";
import { Sidebar } from "./Sidebar";
import { MainHeader } from "./MainHeader";
import { formatBRL, monthStartIso } from "../utils/formatting";
import type { AppPage, SettingsView, TrendMode } from "../features/app/types";
import type { PeriodTotals, TransactionRow } from "../types";

const DashboardPage = lazy(() =>
  import("../features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const EntriesPage = lazy(() =>
  import("../features/entries/EntriesPage").then((m) => ({ default: m.EntriesPage }))
);
const SettingsPage = lazy(() =>
  import("../features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);

export function AppShell() {
  const { email, isGlobalAdmin } = useAuth();
  const { role, isAdmin, canWrite, ready } = useWorkspace();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const [selectedMonth, setSelectedMonth] = useState(monthStartIso(new Date()));
  const [trendWindow, setTrendWindow] = useState<6 | 12 | 24>(12);
  const [trendMode, setTrendMode] = useState<TrendMode>("income_vs_expense");
  const [message, setMessage] = useState("");

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

  const showFinancialChrome = page !== "settings";
  const pageTitle =
    page === "dashboard"
      ? "Dashboard"
      : page === "entries"
        ? "Lancamentos"
        : settingsView === "hub"
          ? "Configuracoes"
          : settingsView === "groups"
            ? "Configuracoes - Grupos"
            : settingsView === "categories"
              ? "Configuracoes - Categorias"
              : "Configuracoes - Usuarios";

  // Data queries
  const { data: period } = useFiscalPeriod(selectedMonth);
  const { data: transactions = [] } = useTransactions(period);
  const { data: groups = [] } = useCategoryGroups();
  const { data: categories = [] } = useCategories();
  const { data: totals } = usePeriodTotals(selectedMonth);
  const { data: trendRows = [] } = useTrend(selectedMonth, trendWindow);
  const { data: trendStatusRows = [] } = useTrendByStatus(selectedMonth, trendWindow);

  // Sync recurrences when period changes
  const syncRecurrences = useSyncRecurrences();
  useEffect(() => {
    if (period && canWrite) syncRecurrences.mutate(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period?.id, canWrite]);

  // Derived data
  const categoryById = useMemo(
    () => categories.reduce<Record<string, (typeof categories)[0]>>((acc, cat) => ((acc[cat.id] = cat), acc), {}),
    [categories]
  );
  const groupById = useMemo(
    () => groups.reduce<Record<string, (typeof groups)[0]>>((acc, g) => ((acc[g.id] = g), acc), {}),
    [groups]
  );

  const computedTotals = useMemo<PeriodTotals>(() => {
    if (totals) return totals;
    const incomeTotal = transactions
      .filter((t) => t.status !== "cancelled" && t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expenseTotal = transactions
      .filter((t) => t.status !== "cancelled" && t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const investmentTotal = transactions
      .filter((t) => t.status !== "cancelled" && t.type === "investment")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const recurringExpense = transactions
      .filter((t) => t.status !== "cancelled" && t.type === "expense" && t.is_recurring)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return {
      period_id: period?.id ?? "",
      period_start: selectedMonth,
      income_total: incomeTotal,
      expense_total: expenseTotal,
      recurring_expense: recurringExpense,
      investment_total: investmentTotal,
      net_result: incomeTotal - expenseTotal - investmentTotal,
    };
  }, [transactions, period?.id, selectedMonth, totals]);

  const boardRows = useMemo(() => {
    const byGroup: Record<string, TransactionRow[]> = {};
    for (const t of transactions) {
      const gid = categoryById[t.category_id]?.group_id ?? "unassigned";
      (byGroup[gid] ??= []).push(t);
    }
    return Object.entries(byGroup).map(([groupId, rows]) => ({
      groupId,
      groupName: groupById[groupId]?.name ?? "Sem grupo",
      total: rows.reduce((sum, r) => sum + Number(r.amount), 0),
      rows,
    }));
  }, [categoryById, groupById, transactions]);

  const topExpenseCategories = useMemo(() => {
    const map = new Map<string, number>();
    transactions
      .filter((t) => t.type === "expense" && t.status !== "cancelled")
      .forEach((t) => map.set(t.category_id, (map.get(t.category_id) ?? 0) + Number(t.amount)));
    const rows = [...map.entries()]
      .map(([categoryId, total]) => ({ categoryId, name: categoryById[categoryId]?.name ?? "Sem categoria", total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
    const max = Math.max(...rows.map((r) => r.total), 1);
    return { rows, max };
  }, [transactions, categoryById]);

  const monthStrip = useMemo(() => {
    const base = parseISO(selectedMonth);
    return Array.from({ length: 13 }, (_, i) => {
      const d = addMonths(base, i - 6);
      return { value: monthStartIso(d), label: format(d, "MMM/yy") };
    });
  }, [selectedMonth]);

  const trendMaxValue = useMemo(
    () => Math.max(...trendRows.flatMap((r) => [r.income_total, r.expense_total]), 1),
    [trendRows]
  );
  const trendResultMaxAbs = useMemo(
    () => Math.max(...trendRows.map((r) => Math.abs(r.net_result)), 1),
    [trendRows]
  );

  const monthlyStatusTrend = useMemo(() => {
    const monthMap = new Map<string, { planned: number; settled: number; monthLabel: string }>();
    for (const row of trendRows) {
      monthMap.set(row.period_start, { planned: 0, settled: 0, monthLabel: format(parseISO(row.period_start), "MMM/yy") });
    }
    for (const row of trendStatusRows) {
      const month = monthMap.get(row.period_start);
      if (!month || !row.status) continue;
      const result = Number(row.income_total) - Number(row.expense_total) - Number(row.investment_total);
      if (row.status === "planned") month.planned += result;
      if (row.status === "settled") month.settled += result;
    }
    const rows = [...monthMap.entries()].map(([periodStart, values]) => ({ periodStart, ...values }));
    const maxAbs = Math.max(...rows.map((r) => Math.max(Math.abs(r.planned), Math.abs(r.settled))), 1);
    return { rows, maxAbs };
  }, [trendRows, trendStatusRows]);

  const getGroupName = (entry: TransactionRow) =>
    groupById[categoryById[entry.category_id]?.group_id ?? ""]?.name ?? "-";
  const getCategoryName = (categoryId: string) => categoryById[categoryId]?.name ?? "-";

  if (!ready) return <LoadingCard label="Conectando ao workspace..." />;

  return (
    <div className="shell">
      <Sidebar
        page={page}
        currentEmail={email}
        role={role}
        onChangePage={(next) =>
          void navigate({ to: next === "dashboard" ? "/dashboard" : next === "entries" ? "/entries" : "/settings" })
        }
        onOpenSettingsHub={() => void navigate({ to: "/settings" })}
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
          <Suspense fallback={<LoadingCard label="Carregando lancamentos..." />}>
            <EntriesPage
              period={period}
              transactions={transactions}
              categories={categories}
              groups={groups}
              categoryById={categoryById}
              groupById={groupById}
              boardRows={boardRows}
              canWrite={canWrite}
              selectedMonth={selectedMonth}
              formatBRL={formatBRL}
              getGroupName={getGroupName}
              getCategoryName={getCategoryName}
              setMessage={setMessage}
            />
          </Suspense>
        ) : null}

        {page === "settings" ? (
          <Suspense fallback={<LoadingCard label="Carregando configuracoes..." />}>
            <SettingsPage
              settingsView={settingsView}
              isAdmin={isAdmin}
              isGlobalAdmin={isGlobalAdmin}
              groups={groups}
              categories={categories}
              groupById={groupById}
              onChangeSettingsView={(view) =>
                void navigate({
                  to:
                    view === "hub" ? "/settings"
                      : view === "groups" ? "/settings/groups"
                        : view === "categories" ? "/settings/categories"
                          : "/settings/users",
                })
              }
            />
          </Suspense>
        ) : null}

        {syncRecurrences.isPending ? (
          <p className="loading-note loading-inline">
            <Spinner label="Atualizando dados..." compact />
          </p>
        ) : null}
      </div>
    </div>
  );
}
