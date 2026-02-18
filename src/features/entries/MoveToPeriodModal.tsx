import { useState } from "react";
import { format, addMonths, parseISO } from "date-fns";
import { X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { Spinner } from "../../components/LoadingState";
import type { FiscalPeriodRow } from "../../types";

type MoveToPeriodModalProps = {
  count: number;
  currentMonth: string;
  onConfirm: (targetPeriodId: string) => void;
  onClose: () => void;
  isBusy: boolean;
};

export function MoveToPeriodModal({ count, currentMonth, onConfirm, onClose, isBusy }: MoveToPeriodModalProps) {
  const { workspaceId } = useWorkspace();
  const [targetMonth, setTargetMonth] = useState(() => {
    const prev = addMonths(parseISO(currentMonth), -1);
    return format(prev, "yyyy-MM-dd");
  });
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState(false);

  const months = Array.from({ length: 13 }, (_, i) => {
    const d = addMonths(parseISO(currentMonth), i - 6);
    const value = format(d, "yyyy-MM-01");
    const label = format(d, "MMM/yyyy");
    return { value, label };
  }).filter((m) => m.value !== currentMonth);

  const handleConfirm = async () => {
    if (!supabase || !workspaceId || !targetMonth) return;
    setError("");
    setResolving(true);
    try {
      const periodStart = format(parseISO(targetMonth), "yyyy-MM-01");
      const { data, error: fetchError } = await supabase
        .from("fiscal_periods")
        .select("id, period_start, period_end, closed_at")
        .eq("workspace_id", workspaceId)
        .eq("period_start", periodStart)
        .maybeSingle();
      if (fetchError) throw fetchError;

      let period: FiscalPeriodRow;
      if (data) {
        period = data as FiscalPeriodRow;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("fiscal_periods")
          .insert({ workspace_id: workspaceId, period_start: periodStart })
          .select("id, period_start, period_end, closed_at")
          .single();
        if (insertError) throw insertError;
        period = inserted as FiscalPeriodRow;
      }

      if (period.closed_at) {
        setError("A competencia de destino esta fechada.");
        setResolving(false);
        return;
      }

      onConfirm(period.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao buscar competencia.");
    } finally {
      setResolving(false);
    }
  };

  const busy = isBusy || resolving;

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3>Mover {count} lancamento{count > 1 ? "s" : ""}</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={14} /></button>
        </div>

        <div className="form-grid">
          <label className="input-label">
            Competencia de destino
            <select
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              disabled={busy}
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>

          {error ? <p className="feedback">{error}</p> : null}

          <div className="inline-controls">
            <button
              className={`primary-button${busy ? " is-loading" : ""}`}
              onClick={() => void handleConfirm()}
              disabled={busy}
            >
              {busy ? <Spinner label="Movendo..." compact /> : "Confirmar"}
            </button>
            <button className="ghost-button" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
