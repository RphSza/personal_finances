import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, Check, CreditCard, GripHorizontal, List, Pencil, Plus, RotateCcw, Sheet, Trash2, Undo2, X } from "lucide-react";
import { useColumnConfig } from "../../hooks/useColumnConfig";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Spinner } from "../../components/LoadingState";
import { useImport } from "../../hooks/useImport";
import { useBulkActions } from "../../hooks/useBulkActions";
import {
  defaultTransactionForm,
  useSaveTransaction,
  useToggleTransactionStatus,
  useDeleteTransaction,
} from "../../hooks/useTransactions";
import { ImportModal } from "./ImportModal";
import { MoveToPeriodModal } from "./MoveToPeriodModal";
import { CategoryCombobox } from "../../components/CategoryCombobox";
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
  const [typeFilter, setTypeFilter] = useState<"todos" | TransactionType>("todos");
  const [entryForm, setEntryForm] = useState<TransactionForm>(defaultTransactionForm);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);

  const monthClosed = !!period?.closed_at;
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const tableRef = useRef<HTMLTableSectionElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const saveTransaction = useSaveTransaction();
  const toggleStatus = useToggleTransactionStatus();
  const deleteTransaction = useDeleteTransaction();

  const imp = useImport(period, transactions, categories, groups, () =>
    qc.invalidateQueries()
  );
  const bulk = useBulkActions();
  const cols = useColumnConfig();

  const prevModalOpen = useRef(false);
  useEffect(() => {
    if (prevModalOpen.current && !imp.importModalOpen) {
      importButtonRef.current?.focus();
    }
    prevModalOpen.current = imp.importModalOpen;
  }, [imp.importModalOpen]);

  const visibleEntries = useMemo(() => {
    let base = statusFilter === "todos" ? transactions : transactions.filter((t) => t.status === statusFilter);
    if (typeFilter !== "todos") base = base.filter((t) => t.type === typeFilter);
    return [...base].sort((a, b) => {
      // 1. By date (planned_date or settled_at) descending (most recent first)
      const dateA = a.planned_date ?? a.settled_at ?? "";
      const dateB = b.planned_date ?? b.settled_at ?? "";
      const dc = dateB.localeCompare(dateA);
      if (dc !== 0) return dc;
      // 2. By group name alphabetically
      const ga = getGroupName(a);
      const gb = getGroupName(b);
      const gc = ga.localeCompare(gb);
      if (gc !== 0) return gc;
      // 3. By value ascending
      return Number(a.amount) - Number(b.amount);
    });
  }, [transactions, statusFilter, typeFilter, getGroupName]);

  const filteredBoardRows = useMemo(
    () => {
      if (statusFilter === "todos" && typeFilter === "todos") return boardRows;
      const filtered = transactions.filter((t) =>
        (statusFilter === "todos" || t.status === statusFilter) &&
        (typeFilter === "todos" || t.type === typeFilter)
      );
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
    [boardRows, categoryById, groupById, statusFilter, typeFilter, transactions]
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
    setFormOpen(true);
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
      isCreditCard: entry.is_credit_card,
      creditCardBillDate: entry.credit_card_bill_date ?? "",
    });
    requestAnimationFrame(() => {
      const row = tableRef.current?.querySelector(`[data-entry-id="${entry.id}"]`) as HTMLElement | null;
      row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
    setDeletingIds((prev) => new Set(prev).add(entry.id));
    // Wait for the CSS animation to finish before actually deleting
    await new Promise((r) => setTimeout(r, 400));
    setActionLoadingKey(`delete-entry-${entry.id}`);
    try { await deleteTransaction.mutateAsync(entry.id); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha."); }
    finally {
      setActionLoadingKey(null);
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(entry.id); return next; });
    }
  };

  const entrySubmitting = saveTransaction.isPending;

  const openForm = useCallback(() => {
    setFormOpen(true);
    setDragPos(null);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingEntryId(null);
    setEntryForm(defaultTransactionForm);
    setDragPos(null);
  }, []);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const rect = modalRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
    };
    const onMove = (ev: PointerEvent) => {
      if (!dragState.current) return;
      const dx = ev.clientX - dragState.current.startX;
      const dy = ev.clientY - dragState.current.startY;
      setDragPos({ x: dragState.current.origX + dx, y: dragState.current.origY + dy });
    };
    const onUp = () => {
      dragState.current = null;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }, []);

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
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "todos" | TransactionType)}>
              <option value="todos">Todos os tipos</option>
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
              <option value="investment">Investimento</option>
              <option value="transfer">Transferencia</option>
            </select>
            <button title="Visualizar como lista" className={entryViewMode === "list" ? "toggle active" : "toggle"} onClick={() => setEntryViewMode("list")}>
              <List size={14} />
            </button>
            <button title="Visualizar como quadro" className={entryViewMode === "board" ? "toggle active" : "toggle"} onClick={() => setEntryViewMode("board")}>
              <Sheet size={14} />
            </button>
            <button title="Criar novo lancamento" className="primary-button compact" onClick={openForm} disabled={!canWrite || monthClosed}>
              <Plus size={14} /> Novo
            </button>
            <button
              ref={importButtonRef}
              title="Importar arquivo CSV ou OFX"
              className="ghost-button compact"
              onClick={imp.openModal}
              disabled={!canWrite || monthClosed}
            >
              Importar
            </button>
          </div>
        </div>

        {bulk.selectedIds.size > 0 ? (
          <div className="bulk-toolbar">
            <span>{bulk.selectedIds.size} selecionado{bulk.selectedIds.size > 1 ? "s" : ""}</span>
            <button
              title="Marcar como realizado"
              className="ghost-button compact"
              onClick={() => bulk.bulkUpdateStatus([...bulk.selectedIds], "settled")}
              disabled={bulk.isBulkBusy || monthClosed}
            >
              <Check size={14} /> Realizar
            </button>
            <button
              title="Reverter para previsto"
              className="ghost-button compact"
              onClick={() => bulk.bulkUpdateStatus([...bulk.selectedIds], "planned")}
              disabled={bulk.isBulkBusy || monthClosed}
            >
              <Undo2 size={14} /> Prever
            </button>
            <button
              title="Mover para outro mes"
              className="ghost-button compact"
              onClick={() => setMoveModalOpen(true)}
              disabled={bulk.isBulkBusy || monthClosed}
            >
              <ArrowRightLeft size={14} /> Mover
            </button>
            <button
              title="Excluir selecionados"
              className="ghost-button compact danger-text"
              onClick={() => { if (confirm(`Excluir ${bulk.selectedIds.size} lancamento(s)?`)) bulk.bulkDelete([...bulk.selectedIds]); }}
              disabled={bulk.isBulkBusy || monthClosed}
            >
              <Trash2 size={14} /> Excluir
            </button>
            <button className="ghost-button compact" onClick={bulk.clearSelection} disabled={bulk.isBulkBusy}>
              <X size={14} /> Limpar
            </button>
          </div>
        ) : null}

        {entryViewMode === "list" ? (
          <div className="table-wrap">
            <div className="table-toolbar-right">
              <button title="Restaurar colunas ao padrao" className="ghost-button compact" onClick={cols.resetColumns}>
                <RotateCcw size={14} /> Resetar colunas
              </button>
            </div>
            <table>
              <colgroup>
                {cols.columnOrder.map((key) => (
                  <col key={key} style={{ width: cols.columnWidths[key] }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {cols.columnOrder.map((key) => {
                    const def = cols.columnDefs.find((d) => d.key === key);
                    if (!def) return null;
                    if (key === "select") {
                      return (
                        <th key={key} style={{ width: cols.columnWidths[key] }}>
                          <input
                            type="checkbox"
                            checked={visibleEntries.length > 0 && visibleEntries.every((e) => bulk.selectedIds.has(e.id))}
                            onChange={() => bulk.toggleAll(visibleEntries.map((e) => e.id))}
                            title="Selecionar todos"
                          />
                        </th>
                      );
                    }
                    return (
                      <th
                        key={key}
                        style={{ width: cols.columnWidths[key], position: "relative" }}
                        draggable
                        onDragStart={() => cols.onReorderStart(key)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => cols.onReorderDrop(key)}
                      >
                        {def.label}
                        <div
                          className="col-resize-handle"
                          onPointerDown={(e) => cols.onResizeStart(key, e)}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody ref={tableRef}>
                {visibleEntries.map((entry) => {
                  const isToggling = actionLoadingKey === `toggle-entry-${entry.id}`;
                  const isDeleting = actionLoadingKey === `delete-entry-${entry.id}`;
                  return (
                  <tr key={entry.id} data-entry-id={entry.id} className={[editingEntryId === entry.id && "editing", deletingIds.has(entry.id) && "deleting"].filter(Boolean).join(" ") || undefined}>
                    {cols.columnOrder.map((key) => {
                      switch (key) {
                        case "select":
                          return (
                            <td key={key}>
                              <input type="checkbox" checked={bulk.selectedIds.has(entry.id)} onChange={() => bulk.toggleOne(entry.id)} />
                            </td>
                          );
                        case "date":
                          return <td key={key} className="date-col">{entry.planned_date ? format(parseISO(entry.planned_date), "dd/MM") : entry.settled_at ? format(parseISO(entry.settled_at), "dd/MM") : "-"}</td>;
                        case "description":
                          return (
                            <td key={key} className="cell-truncate">
                              {entry.description}
                              {entry.is_credit_card && entry.credit_card_bill_date ? (
                                <span className="pill credit-card" style={{ marginLeft: 6 }}>
                                  <CreditCard size={14} />
                                  pago em {format(parseISO(entry.credit_card_bill_date), "dd/MM")}
                                </span>
                              ) : null}
                            </td>
                          );
                        case "group":
                          return <td key={key} className="cell-truncate">{getGroupName(entry)}</td>;
                        case "category":
                          return <td key={key} className="cell-truncate">{getCategoryName(entry.category_id)}</td>;
                        case "type":
                          return <td key={key}><span className={`pill ${entry.type}`}>{entry.type === "transfer" ? "transferencia" : entry.type}</span></td>;
                        case "status":
                          return <td key={key}><span className={`pill status ${entry.status}`}>{entry.status}</span></td>;
                        case "amount":
                          return <td key={key} className="amount">{formatBRL(Number(entry.amount))}</td>;
                        case "actions":
                          return (
                            <td key={key} className="actions">
                              <button title="Editar lancamento" onClick={() => editEntry(entry)} disabled={!canWrite || monthClosed || entrySubmitting}><Pencil size={14} /></button>
                              <button
                                title={entry.status === "settled" ? "Reverter para previsto" : "Marcar como realizado"}
                                onClick={() => void onToggleEntryStatus(entry)}
                                className={isToggling ? "is-busy" : undefined}
                                disabled={!canWrite || monthClosed || entry.status === "cancelled" || isToggling}
                              >
                                {entry.status === "settled" ? <Undo2 size={14} /> : <Check size={14} />}
                              </button>
                              <button
                                title="Mover para outro mes"
                                onClick={() => { bulk.clearSelection(); bulk.toggleOne(entry.id); setMoveModalOpen(true); }}
                                disabled={!canWrite || monthClosed}
                              >
                                <ArrowRightLeft size={14} />
                              </button>
                              <button
                                title="Excluir lancamento"
                                className={`danger${isDeleting ? " is-busy" : ""}`}
                                onClick={() => void onDeleteEntry(entry)}
                                disabled={!canWrite || monthClosed || isDeleting}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                  );
                })}
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
                      <span>
                        {entry.description}
                        {entry.is_credit_card && entry.credit_card_bill_date ? (
                          <span className="pill credit-card" style={{ marginLeft: 6 }}>
                            <CreditCard size={14} />
                            pago em {format(parseISO(entry.credit_card_bill_date), "dd/MM")}
                          </span>
                        ) : null}
                      </span>
                      <strong>{formatBRL(Number(entry.amount))}</strong>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      {formOpen ? (
        <div
          ref={modalRef}
          className="entry-form-modal panel"
          style={dragPos ? { position: "fixed", left: dragPos.x, top: dragPos.y, right: "auto", bottom: "auto" } : undefined}
        >
          <div className="entry-form-modal-header" onPointerDown={onDragStart}>
            <GripHorizontal size={14} className="drag-handle" />
            <h3>{editingEntryId ? "Editar lancamento" : "Novo lancamento"}</h3>
            <button type="button" className="icon-button" onClick={closeForm} aria-label="Fechar"><X size={14} /></button>
          </div>
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
                onChange={(e) => setEntryForm({ ...entryForm, type: e.target.value as TransactionType, isCreditCard: e.target.value !== "expense" ? false : entryForm.isCreditCard })}
                disabled={!canWrite || monthClosed || entrySubmitting}
              >
                <option value="income">income</option>
                <option value="expense">expense</option>
                <option value="investment">investment</option>
                <option value="transfer">transferencia</option>
              </select>
            </div>
            <CategoryCombobox
              categories={categories}
              groups={groups}
              value={entryForm.categoryId}
              onChange={(id) => {
                const cat = categoryById[id];
                setEntryForm({
                  ...entryForm,
                  categoryId: id,
                  type: cat?.default_type ?? entryForm.type,
                });
              }}
              transactionType={entryForm.type}
              disabled={!canWrite || monthClosed || entrySubmitting}
            />
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
            {entryForm.type === "expense" ? (
              <>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={entryForm.isCreditCard}
                    onChange={(e) => setEntryForm({ ...entryForm, isCreditCard: e.target.checked, creditCardBillDate: e.target.checked ? entryForm.creditCardBillDate : "" })}
                    disabled={!canWrite || monthClosed || entrySubmitting}
                  />
                  Lancamento de cartao de credito
                </label>
                {entryForm.isCreditCard ? (
                  <input
                    type="date"
                    placeholder="Data de pagamento da fatura"
                    value={entryForm.creditCardBillDate}
                    onChange={(e) => setEntryForm({ ...entryForm, creditCardBillDate: e.target.value })}
                    required={entryForm.status === "settled"}
                    disabled={!canWrite || monthClosed || entrySubmitting}
                  />
                ) : null}
              </>
            ) : null}
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
                  Cancelar edicao
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}

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

      {moveModalOpen ? (
        <MoveToPeriodModal
          count={bulk.selectedIds.size}
          currentMonth={selectedMonth}
          isBusy={bulk.isBulkBusy}
          onConfirm={(targetPeriodId) => {
            bulk.bulkMove([...bulk.selectedIds], targetPeriodId);
            setMoveModalOpen(false);
          }}
          onClose={() => setMoveModalOpen(false)}
        />
      ) : null}
    </main>
  );
}
