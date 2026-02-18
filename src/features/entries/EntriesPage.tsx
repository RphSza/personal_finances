import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { List, Pencil, Sheet, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Spinner } from "../../components/LoadingState";
import { useImport } from "../../hooks/useImport";
import {
  defaultTransactionForm,
  useSaveTransaction,
  useToggleTransactionStatus,
  useDeleteTransaction,
} from "../../hooks/useTransactions";
import { ImportModal } from "./ImportModal";
import type {
  TransactionStatus,
  TransactionType,
  TransactionForm,
  TransactionRow,
  CategoryRow,
  CategoryGroupRow,
  FiscalPeriodRow,
} from "../../types";
import type { EntryViewMode } from "../app/types";

type BoardGroup = {
  groupId: string;
  groupName: string;
  total: number;
  rows: TransactionRow[];
};

type EntriesPageProps = {
  period: FiscalPeriodRow | undefined;
  transactions: TransactionRow[];
  categories: CategoryRow[];
  groups: CategoryGroupRow[];
  categoryById: Record<string, CategoryRow>;
  groupById: Record<string, CategoryGroupRow>;
  boardRows: BoardGroup[];
  canWrite: boolean;
  selectedMonth: string;
  formatBRL: (value: number) => string;
  getGroupName: (entry: TransactionRow) => string;
  getCategoryName: (categoryId: string) => string;
  setMessage: (msg: string) => void;
};

export function EntriesPage({
  period,
  transactions,
  categories,
  groups,
  categoryById,
  groupById,
  boardRows,
  canWrite,
  selectedMonth,
  formatBRL,
  getGroupName,
  getCategoryName,
  setMessage,
}: EntriesPageProps) {
  const qc = useQueryClient();

  const [entryViewMode, setEntryViewMode] = useState<EntryViewMode>("list");
  const [statusFilter, setStatusFilter] = useState<"todos" | TransactionStatus>("todos");
  const [entryForm, setEntryForm] = useState<TransactionForm>(defaultTransactionForm);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);

  const monthClosed = !!period?.closed_at;
  const importButtonRef = useRef<HTMLButtonElement>(null);

  const saveTransaction = useSaveTransaction();
  const toggleStatus = useToggleTransactionStatus();
  const deleteTransaction = useDeleteTransaction();

  const imp = useImport(period, transactions, categories, groups, () =>
    qc.invalidateQueries()
  );

  const prevModalOpen = useRef(false);
  useEffect(() => {
    if (prevModalOpen.current && !imp.importModalOpen) {
      importButtonRef.current?.focus();
    }
    prevModalOpen.current = imp.importModalOpen;
  }, [imp.importModalOpen]);

  const visibleEntries = useMemo(
    () => (statusFilter === "todos" ? transactions : transactions.filter((t) => t.status === statusFilter)),
    [transactions, statusFilter]
  );

  const filteredBoardRows = useMemo(
    () => {
      if (statusFilter === "todos") return boardRows;
      const filtered = transactions.filter((t) => t.status === statusFilter);
      const byGroup: Record<string, TransactionRow[]> = {};
      for (const t of filtered) {
        const gid = categoryById[t.category_id]?.group_id ?? "unassigned";
        (byGroup[gid] ??= []).push(t);
      }
      return Object.entries(byGroup).map(([groupId, rows]) => ({
        groupId,
        groupName: groupById[groupId]?.name ?? "Sem grupo",
        total: rows.reduce((sum, r) => sum + Number(r.amount), 0),
        rows,
      }));
    },
    [boardRows, categoryById, groupById, statusFilter, transactions]
  );

  const onSubmitEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!period || !canWrite || monthClosed) return;
    try {
      await saveTransaction.mutateAsync({
        form: entryForm,
        periodId: period.id,
        editingId: editingEntryId,
        selectedMonth,
      });
      setEntryForm(defaultTransactionForm);
      setEditingEntryId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar.");
    }
  };

  const editEntry = (entry: TransactionRow) => {
    setEditingEntryId(entry.id);
    setEntryForm({
      description: entry.description,
      amount: String(Number(entry.amount).toFixed(2)).replace(".", ","),
      type: entry.type,
      status: entry.status,
      categoryId: entry.category_id,
      isRecurring: entry.is_recurring,
      plannedDate: entry.planned_date ?? "",
      settledAt: entry.settled_at ?? "",
      notes: entry.notes ?? "",
    });
  };

  const onToggleEntryStatus = async (entry: TransactionRow) => {
    if (monthClosed) { setMessage("Competencia fechada."); return; }
    setActionLoadingKey(`toggle-entry-${entry.id}`);
    try { await toggleStatus.mutateAsync(entry); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha."); }
    finally { setActionLoadingKey(null); }
  };

  const onDeleteEntry = async (entry: TransactionRow) => {
    if (monthClosed) { setMessage("Competencia fechada."); return; }
    setActionLoadingKey(`delete-entry-${entry.id}`);
    try { await deleteTransaction.mutateAsync(entry.id); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha."); }
    finally { setActionLoadingKey(null); }
  };

  const entrySubmitting = saveTransaction.isPending;

  return (
    <main className="entries-layout">
      <section className="panel">
        <div className="panel-header">
          <h3>Lancamentos</h3>
          <div className="inline-controls">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "todos" | TransactionStatus)}>
              <option value="todos">Todos</option>
              <option value="planned">Previstos</option>
              <option value="settled">Realizados</option>
              <option value="cancelled">Cancelados</option>
            </select>
            <button className={entryViewMode === "list" ? "toggle active" : "toggle"} onClick={() => setEntryViewMode("list")}>
              <List size={14} />
            </button>
            <button className={entryViewMode === "board" ? "toggle active" : "toggle"} onClick={() => setEntryViewMode("board")}>
              <Sheet size={14} />
            </button>
          </div>
        </div>

        {entryViewMode === "list" ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Descricao</th>
                  <th>Grupo</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Valor</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.description}</td>
                    <td>{getGroupName(entry)}</td>
                    <td>{getCategoryName(entry.category_id)}</td>
                    <td><span className={`pill ${entry.type}`}>{entry.type}</span></td>
                    <td><span className={`pill status ${entry.status}`}>{entry.status}</span></td>
                    <td className="amount">{formatBRL(Number(entry.amount))}</td>
                    <td className="actions">
                      <button onClick={() => editEntry(entry)} disabled={!canWrite || monthClosed || entrySubmitting}><Pencil size={14} /></button>
                      <button
                        onClick={() => void onToggleEntryStatus(entry)}
                        disabled={!canWrite || monthClosed || entry.status === "cancelled" || actionLoadingKey === `toggle-entry-${entry.id}`}
                      >
                        {actionLoadingKey === `toggle-entry-${entry.id}` ? <Spinner label="..." compact /> : "OK"}
                      </button>
                      <button
                        className="danger"
                        onClick={() => void onDeleteEntry(entry)}
                        disabled={!canWrite || monthClosed || actionLoadingKey === `delete-entry-${entry.id}`}
                      >
                        {actionLoadingKey === `delete-entry-${entry.id}` ? <Spinner label="..." compact /> : <Trash2 size={14} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="board-grid">
            {filteredBoardRows.map((block) => (
              <article key={block.groupId} className="board-column">
                <header>
                  <h4>{block.groupName}</h4>
                  <strong>{formatBRL(block.total)}</strong>
                </header>
                <ul>
                  {block.rows.map((entry) => (
                    <li key={entry.id}>
                      <span>{entry.description}</span>
                      <strong>{formatBRL(Number(entry.amount))}</strong>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="panel entries-sidebar-stack">
        <section className="entries-subpanel">
          <h3>{editingEntryId ? "Editar lancamento" : "Novo lancamento"}</h3>
          <form onSubmit={(event) => void onSubmitEntry(event)} className="form-grid">
            <input
              placeholder="Descricao"
              value={entryForm.description}
              onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
              required
              disabled={!canWrite || monthClosed || entrySubmitting}
            />
            <div className="two-col">
              <input
                placeholder="Valor"
                value={entryForm.amount}
                onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
                required
                disabled={!canWrite || monthClosed || entrySubmitting}
              />
              <select
                value={entryForm.type}
                onChange={(e) => setEntryForm({ ...entryForm, type: e.target.value as TransactionType })}
                disabled={!canWrite || monthClosed || entrySubmitting}
              >
                <option value="income">income</option>
                <option value="expense">expense</option>
                <option value="investment">investment</option>
              </select>
            </div>
            <select
              value={entryForm.categoryId}
              onChange={(e) => setEntryForm({ ...entryForm, categoryId: e.target.value })}
              required
              disabled={!canWrite || monthClosed || entrySubmitting}
            >
              <option value="">Selecione a categoria</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <div className="two-col">
              <select
                value={entryForm.status}
                onChange={(e) => setEntryForm({ ...entryForm, status: e.target.value as TransactionStatus })}
                disabled={!canWrite || monthClosed || entrySubmitting}
              >
                <option value="planned">planned</option>
                <option value="settled">settled</option>
                <option value="cancelled">cancelled</option>
              </select>
              <input
                type="date"
                value={entryForm.status === "settled" ? entryForm.settledAt : entryForm.plannedDate}
                onChange={(e) =>
                  setEntryForm(
                    entryForm.status === "settled"
                      ? { ...entryForm, settledAt: e.target.value }
                      : { ...entryForm, plannedDate: e.target.value }
                  )
                }
                disabled={!canWrite || monthClosed || entrySubmitting}
              />
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={entryForm.isRecurring}
                onChange={(e) => setEntryForm({ ...entryForm, isRecurring: e.target.checked })}
                disabled={!canWrite || monthClosed || entrySubmitting}
              />
              Recorrente
            </label>
            <textarea
              placeholder="Notas"
              value={entryForm.notes}
              onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
              disabled={!canWrite || monthClosed || entrySubmitting}
            />
            <div className="inline-controls">
              <button
                type="submit"
                className={`primary-button ${entrySubmitting ? "is-loading" : ""}`}
                disabled={!canWrite || monthClosed || entrySubmitting}
              >
                {entrySubmitting ? (
                  <Spinner label={editingEntryId ? "Salvando alteracoes..." : "Salvando lancamento..."} compact />
                ) : editingEntryId ? "Salvar alteracoes" : "Salvar lancamento"}
              </button>
              {editingEntryId ? (
                <button type="button" className="ghost-button" onClick={() => { setEditingEntryId(null); setEntryForm(defaultTransactionForm); }} disabled={entrySubmitting}>
                  Cancelar
                </button>
              ) : null}
              <button
                ref={importButtonRef}
                type="button"
                className="ghost-button"
                onClick={imp.openModal}
                disabled={!canWrite || monthClosed || entrySubmitting}
              >
                Importar
              </button>
            </div>
          </form>
        </section>
      </aside>

      {imp.importModalOpen ? (
        <ImportModal
          imp={imp}
          categories={categories}
          groups={groups}
          canWrite={canWrite}
          monthClosed={monthClosed}
          formatBRL={formatBRL}
        />
      ) : null}
    </main>
  );
}
