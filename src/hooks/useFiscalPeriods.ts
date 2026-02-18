import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { queryKeys } from "../lib/queryKeys";
import { useWorkspace } from "../contexts/WorkspaceContext";
import type { FiscalPeriodRow } from "../types";

export function useFiscalPeriod(selectedMonth: string) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: queryKeys.fiscalPeriod(workspaceId!, selectedMonth),
    enabled: !!supabase && !!workspaceId,
    queryFn: async (): Promise<FiscalPeriodRow> => {
      const { data, error } = await supabase!
        .from("fiscal_periods")
        .select("id, period_start, period_end, closed_at")
        .eq("workspace_id", workspaceId!)
        .eq("period_start", selectedMonth)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as FiscalPeriodRow;

      const { data: inserted, error: insertError } = await supabase!
        .from("fiscal_periods")
        .insert({ workspace_id: workspaceId!, period_start: selectedMonth })
        .select("id, period_start, period_end, closed_at")
        .single();
      if (insertError) throw insertError;
      return inserted as FiscalPeriodRow;
    },
  });
}
