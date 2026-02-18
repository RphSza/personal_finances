import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isAfter, lastDayOfMonth, parseISO, setDate } from "date-fns";
import { supabase } from "../lib/supabase";
import { queryKeys } from "../lib/queryKeys";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { parseMoney, toPostgrestCode } from "../utils/formatting";
import type { TransactionRow, TransactionForm, TransactionType, FiscalPeriodRow } from "../types";

const defaultForm: TransactionForm = {
  description: "",
  amount: "",
  type: "expense",
  status: "planned",
  categoryId: "",
  isRecurring: false,
  plannedDate: "",
  settledAt: "",
  notes: "",
};

export { defaultForm as defaultTransactionForm };

export function useTransactions(period: FiscalPeriodRow | undefined) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: queryKeys.transactions(workspaceId!, period?.id ?? ""),
    enabled: !!supabase && !!workspaceId && !!period?.id,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("transactions")
        .select("id, period_id, category_id, description, amount, type, status, is_recurring, planned_date, settled_at, notes, created_at, created_by")
        .eq("workspace_id", workspaceId!)
        .eq("period_id", period!.id)
        .order("created_at");
      if (error) throw error;
      return ((data as TransactionRow[]) ?? []).map((t) => ({ ...t, amount: Number(t.amount) }));
    },
  });
}

export function useSyncRecurrences() {
  const { workspaceId, isAdmin } = useWorkspace();

  return useMutation({
    mutationFn: async (period: FiscalPeriodRow) => {
      if (!supabase || !isAdmin || !workspaceId) return;
      const { data: rules, error } = await supabase
        .from("recurrences")
        .select("id, category_id, description, amount, type, day_of_month, start_month, end_month")
        .eq("workspace_id", workspaceId)
        .eq("active", true);
      if (error) throw error;

      const monthDate = parseISO(period.period_start);
      const valid = (rules ?? []).filter((rule) => {
        if (isAfter(parseISO(rule.start_month), monthDate)) return false;
        return !rule.end_month || !isAfter(monthDate, parseISO(rule.end_month));
      });
      if (!valid.length) return;

      const inserts = valid.map((rule) => ({
        workspace_id: workspaceId,
        period_id: period.id,
        category_id: rule.category_id,
        description: rule.description,
        amount: Number(rule.amount),
        type: rule.type,
        status: "planned",
        is_recurring: true,
        planned_date: format(
          setDate(monthDate, Math.min(rule.day_of_month, lastDayOfMonth(monthDate).getDate())),
          "yyyy-MM-dd"
        ),
        recurrence_materialization_key: `${rule.id}:${period.period_start}`,
      }));
      const { error: upsertError } = await supabase
        .from("transactions")
        .upsert(inserts, { onConflict: "workspace_id,recurrence_materialization_key", ignoreDuplicates: true });
      if (upsertError) {
        const code = toPostgrestCode(upsertError);
        if (code === "42703" || code === "42P10") {
          // Column doesn't exist — dedup manually before inserting
          const { data: existing } = await supabase
            .from("transactions")
            .select("description, type")
            .eq("workspace_id", workspaceId)
            .eq("period_id", period.id)
            .eq("is_recurring", true);
          const existingSet = new Set(
            (existing ?? []).map((e: { description: string; type: string }) => `${e.description}::${e.type}`)
          );
          const fallbackInserts = inserts
            .map(({ recurrence_materialization_key: _, ...row }) => row)
            .filter((row) => !existingSet.has(`${row.description}::${row.type}`));
          if (fallbackInserts.length > 0) {
            const { error: fallbackError } = await supabase.from("transactions").insert(fallbackInserts);
            if (fallbackError) throw fallbackError;
          }
        } else {
          throw upsertError;
        }
      }
    },
  });
}

export function useSaveTransaction() {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      form: TransactionForm;
      periodId: string;
      editingId: string | null;
      selectedMonth: string;
    }) => {
      const amount = parseMoney(input.form.amount);
      if (!input.form.description.trim() || !input.form.categoryId || Number.isNaN(amount)) return;
      const payload = {
        workspace_id: workspaceId!,
        period_id: input.periodId,
        category_id: input.form.categoryId,
        description: input.form.description.trim(),
        amount,
        type: input.form.type,
        status: input.form.status,
        is_recurring: input.form.isRecurring,
        planned_date: input.form.plannedDate || null,
        settled_at: input.form.status === "settled" ? input.form.settledAt || format(new Date(), "yyyy-MM-dd") : null,
        notes: input.form.notes.trim() || null,
      };
      const { error } = input.editingId
        ? await supabase!.from("transactions").update(payload).eq("id", input.editingId)
        : await supabase!.from("transactions").insert(payload);
      if (error) throw error;

      if (input.form.isRecurring) {
        await saveRecurrenceRule(workspaceId!, {
          categoryId: input.form.categoryId,
          description: input.form.description.trim(),
          amount,
          type: input.form.type,
          baseDate: input.form.plannedDate || input.form.settledAt || format(parseISO(input.selectedMonth), "yyyy-MM-dd"),
        });
      }
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

async function saveRecurrenceRule(
  workspaceId: string,
  input: { categoryId: string; description: string; amount: number; type: TransactionType; baseDate: string }
) {
  if (!supabase) return;
  const { data, error } = await supabase
    .from("recurrences")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("category_id", input.categoryId)
    .eq("description", input.description)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  const day = parseISO(input.baseDate).getDate();
  if (data?.id) {
    const { error: updateError } = await supabase
      .from("recurrences")
      .update({ amount: input.amount, type: input.type, day_of_month: day })
      .eq("id", data.id);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase.from("recurrences").insert({
      workspace_id: workspaceId,
      category_id: input.categoryId,
      description: input.description,
      amount: input.amount,
      type: input.type,
      day_of_month: day,
      frequency: "monthly",
      start_month: format(parseISO(input.baseDate), "yyyy-MM-01"),
      active: true,
    });
    if (insertError) throw insertError;
  }
}

export function useToggleTransactionStatus() {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (entry: TransactionRow) => {
      const next = entry.status === "settled" ? "planned" : "settled";
      const { error } = await supabase!
        .from("transactions")
        .update({ status: next, settled_at: next === "settled" ? format(new Date(), "yyyy-MM-dd") : null })
        .eq("workspace_id", workspaceId!)
        .eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteTransaction() {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase!
        .from("transactions")
        .delete()
        .eq("workspace_id", workspaceId!)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}
