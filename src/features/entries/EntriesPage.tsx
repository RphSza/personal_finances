import { FormEvent } from "react";
import { List, Pencil, Sheet, Trash2 } from "lucide-react";
import type { EntryStatus, EntryType, CategoryRow, EntryForm, EntryRow } from "../../types";
import type { EntryViewMode } from "../app/types";

type BoardGroup = {
  groupId: string;
  groupName: string;
  total: number;
  rows: EntryRow[];
};

type EntriesPageProps = {
  statusFilter: "todos" | EntryStatus;
  onChangeStatusFilter: (status: "todos" | EntryStatus) => void;
  entryViewMode: EntryViewMode;
  onChangeEntryViewMode: (mode: EntryViewMode) => void;
  visibleEntries: EntryRow[];
  boardRows: BoardGroup[];
  categories: CategoryRow[];
  entryForm: EntryForm;
  editingEntryId: string | null;
  isAdmin: boolean;
  formatBRL: (value: number) => string;
  getGroupName: (entry: EntryRow) => string;
  getCategoryName: (categoryId: string) => string;
  onEditEntry: (entry: EntryRow) => void;
  onToggleEntryStatus: (entry: EntryRow) => void;
  onDeleteEntry: (entry: EntryRow) => void;
  onSubmitEntry: (event: FormEvent) => Promise<void>;
  onCancelEdit: () => void;
  onEntryFormChange: (next: EntryForm) => void;
};

export function EntriesPage({
  statusFilter,
  onChangeStatusFilter,
  entryViewMode,
  onChangeEntryViewMode,
  visibleEntries,
  boardRows,
  categories,
  entryForm,
  editingEntryId,
  isAdmin,
  formatBRL,
  getGroupName,
  getCategoryName,
  onEditEntry,
  onToggleEntryStatus,
  onDeleteEntry,
  onSubmitEntry,
  onCancelEdit,
  onEntryFormChange
}: EntriesPageProps) {
  return (
    <main className="entries-layout">
      <section className="panel">
        <div className="panel-header">
          <h3>Lançamentos</h3>
          <div className="inline-controls">
            <select value={statusFilter} onChange={(e) => onChangeStatusFilter(e.target.value as "todos" | EntryStatus)}>
              <option value="todos">Todos</option>
              <option value="previsto">Previstos</option>
              <option value="realizado">Realizados</option>
              <option value="cancelado">Cancelados</option>
            </select>
            <button className={entryViewMode === "list" ? "toggle active" : "toggle"} onClick={() => onChangeEntryViewMode("list")}>
              <List size={14} />
            </button>
            <button className={entryViewMode === "board" ? "toggle active" : "toggle"} onClick={() => onChangeEntryViewMode("board")}>
              <Sheet size={14} />
            </button>
          </div>
        </div>

        {entryViewMode === "list" ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Grupo</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Valor</th>
                  <th>Ações</th>
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
                      <button onClick={() => onEditEntry(entry)} disabled={!isAdmin}><Pencil size={14} /></button>
                      <button onClick={() => onToggleEntryStatus(entry)} disabled={!isAdmin || entry.status === "cancelado"}>OK</button>
                      <button className="danger" onClick={() => onDeleteEntry(entry)} disabled={!isAdmin}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="board-grid">
            {boardRows.map((block) => (
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

      <aside className="panel">
        <h3>{editingEntryId ? "Editar lançamento" : "Novo lançamento"}</h3>
        <form onSubmit={(event) => void onSubmitEntry(event)} className="form-grid">
          <input
            placeholder="Descrição"
            value={entryForm.description}
            onChange={(e) => onEntryFormChange({ ...entryForm, description: e.target.value })}
            required
            disabled={!isAdmin}
          />

          <div className="two-col">
            <input
              placeholder="Valor"
              value={entryForm.amount}
              onChange={(e) => onEntryFormChange({ ...entryForm, amount: e.target.value })}
              required
              disabled={!isAdmin}
            />
            <select
              value={entryForm.type}
              onChange={(e) => onEntryFormChange({ ...entryForm, type: e.target.value as EntryType })}
              disabled={!isAdmin}
            >
              <option value="receita">receita</option>
              <option value="despesa">despesa</option>
              <option value="investimento">investimento</option>
            </select>
          </div>

          <select
            value={entryForm.categoryId}
            onChange={(e) => onEntryFormChange({ ...entryForm, categoryId: e.target.value })}
            required
            disabled={!isAdmin}
          >
            <option value="">Selecione a categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>

          <div className="two-col">
            <select
              value={entryForm.status}
              onChange={(e) => onEntryFormChange({ ...entryForm, status: e.target.value as EntryStatus })}
              disabled={!isAdmin}
            >
              <option value="previsto">previsto</option>
              <option value="realizado">realizado</option>
              <option value="cancelado">cancelado</option>
            </select>
            <input
              type="date"
              value={entryForm.status === "realizado" ? entryForm.realizedAt : entryForm.plannedDate}
              onChange={(e) =>
                onEntryFormChange(
                  entryForm.status === "realizado"
                    ? { ...entryForm, realizedAt: e.target.value }
                    : { ...entryForm, plannedDate: e.target.value }
                )
              }
              disabled={!isAdmin}
            />
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={entryForm.isRecurring}
              onChange={(e) => onEntryFormChange({ ...entryForm, isRecurring: e.target.checked })}
              disabled={!isAdmin}
            />
            Recorrente
          </label>

          <textarea
            placeholder="Notas"
            value={entryForm.notes}
            onChange={(e) => onEntryFormChange({ ...entryForm, notes: e.target.value })}
            disabled={!isAdmin}
          />

          <div className="inline-controls">
            <button type="submit" className="primary-button" disabled={!isAdmin}>
              {editingEntryId ? "Salvar alterações" : "Salvar lançamento"}
            </button>
            {editingEntryId ? (
              <button type="button" className="ghost-button" onClick={onCancelEdit}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </aside>
    </main>
  );
}
