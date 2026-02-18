import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../contexts/WorkspaceContext";
import type { TransactionStatus } from "../types";

export function useBulkActions() {
  const { workspaceId, canWrite } = useWorkspace();
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((visibleIds: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = visibleIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(visibleIds);
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, newStatus }: { ids: string[]; newStatus: TransactionStatus }) => {
      if (!supabase || !workspaceId || !canWrite || !ids.length) return;
      const settledAt = newStatus === "settled" ? format(new Date(), "yyyy-MM-dd") : null;
      const { error } = await supabase
        .from("transactions")
        .update({ status: newStatus, settled_at: settledAt })
        .eq("workspace_id", workspaceId)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      clearSelection();
      qc.invalidateQueries();
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!supabase || !workspaceId || !canWrite || !ids.length) return;
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("workspace_id", workspaceId)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      clearSelection();
      qc.invalidateQueries();
    },
  });

  const bulkMoveMutation = useMutation({
    mutationFn: async ({ ids, targetPeriodId }: { ids: string[]; targetPeriodId: string }) => {
      if (!supabase || !workspaceId || !canWrite || !ids.length) return;
      const { error } = await supabase
        .from("transactions")
        .update({ period_id: targetPeriodId })
        .eq("workspace_id", workspaceId)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      clearSelection();
      qc.invalidateQueries();
    },
  });

  return {
    selectedIds,
    toggleOne,
    toggleAll,
    clearSelection,
    bulkUpdateStatus: (ids: string[], newStatus: TransactionStatus) =>
      bulkUpdateStatusMutation.mutate({ ids, newStatus }),
    bulkDelete: (ids: string[]) => bulkDeleteMutation.mutate(ids),
    bulkMove: (ids: string[], targetPeriodId: string) =>
      bulkMoveMutation.mutate({ ids, targetPeriodId }),
    isBulkBusy:
      bulkUpdateStatusMutation.isPending ||
      bulkDeleteMutation.isPending ||
      bulkMoveMutation.isPending,
  };
}
