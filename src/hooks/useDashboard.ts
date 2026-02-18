import { useQuery } from "@tanstack/react-query";
import { addMonths, parseISO } from "date-fns";
import { supabase } from "../lib/supabase";
import { queryKeys } from "../lib/queryKeys";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { monthStartIso } from "../utils/formatting";
import type { PeriodTotals, PeriodTotalsByStatus } from "../types";

export function usePeriodTotals(selectedMonth: string) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: queryKeys.periodTotals(workspaceId!, selectedMonth),
    enabled: !!supabase && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("v_period_totals")
        .select("workspace_id, period_id, period_start, income_total, expense_total, recurring_expense, investment_total, net_result")
        .eq("workspace_id", workspaceId!)
        .eq("period_start", selectedMonth)
        .maybeSingle();
      if (error) throw error;
      return data as PeriodTotals | null;
    },
  });
}

export function useTrend(selectedMonth: string, trendWindow: number) {
  const { workspaceId } = useWorkspace();
  const trendStart = monthStartIso(addMonths(parseISO(selectedMonth), -(trendWindow - 1)));

  return useQuery({
    queryKey: queryKeys.trend(workspaceId!, selectedMonth, trendWindow),
    enabled: !!supabase && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("v_period_totals")
        .select("workspace_id, period_id, period_start, income_total, expense_total, recurring_expense, investment_total, net_result")
        .eq("workspace_id", workspaceId!)
        .gte("period_start", trendStart)
        .lte("period_start", selectedMonth)
        .order("period_start", { ascending: true });
      if (error) throw error;
      return ((data as PeriodTotals[]) ?? []).map((row) => ({
        ...row,
        income_total: Number(row.income_total),
        expense_total: Number(row.expense_total),
        recurring_expense: Number(row.recurring_expense),
        investment_total: Number(row.investment_total),
        net_result: Number(row.net_result),
      }));
    },
  });
}

export function useTrendByStatus(selectedMonth: string, trendWindow: number) {
  const { workspaceId } = useWorkspace();
  const trendStart = monthStartIso(addMonths(parseISO(selectedMonth), -(trendWindow - 1)));

  return useQuery({
    queryKey: queryKeys.trendByStatus(workspaceId!, selectedMonth, trendWindow),
    enabled: !!supabase && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("v_period_totals_by_status")
        .select("workspace_id, period_id, period_start, status, income_total, expense_total, investment_total")
        .eq("workspace_id", workspaceId!)
        .gte("period_start", trendStart)
        .lte("period_start", selectedMonth)
        .order("period_start", { ascending: true });
      if (error) throw error;
      return ((data as PeriodTotalsByStatus[]) ?? []).map((row) => ({
        ...row,
        income_total: Number(row.income_total),
        expense_total: Number(row.expense_total),
        investment_total: Number(row.investment_total),
      }));
    },
  });
}
