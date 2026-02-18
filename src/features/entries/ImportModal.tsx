import { ChangeEvent, useEffect, useRef, useState } from "react";
import { X, Plus, Minus, Upload } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Spinner } from "../../components/LoadingState";
import { CategoryCombobox } from "../../components/CategoryCombobox";
import type { ImportRowStatus } from "../../hooks/useImport";
import type { CategoryGroupRow, CategoryRow, TransactionType } from "../../types";

type ImportHookReturn = {
  importFormat: string;
  importFileName: string;
  importPreviewRows: Array<{
    rowIndex: number;
    description: string;
    amount: number;
    type: TransactionType;
    occurrenceDate: string | null;
    dedupeKey: string;
    isDuplicate: boolean;
    categoryId: string;
    errorReason: string | null;
    status: ImportRowStatus;
  }>;
  importParsing: boolean;
  importSubmitting: boolean;
  importModalFeedback: string;
  importQuickCategoryName: string;
  importQuickCategoryType: TransactionType;
  importQuickCategorySubmitting: boolean;
  importTotal: number;
  importReady: number;
  importDuplicates: number;
  importErrors: number;
  importMissingCategory: number;
  importCancelled: number;
  importCompleted: boolean;
  importSummary: { imported: number; duplicates: number; errors: number; cancelled: number };
  closeModal: () => void;
  previewFile: (file: File | null) => void;
  changeRowCategory: (rowIndex: number, dedupeKey: string, categoryId: string) => void;
  changeRowStatus: (rowIndex: number, dedupeKey: string, newStatus: ImportRowStatus) => void;
  clearPreview: () => void;
  resetImport: () => void;
  setImportQuickCategoryName: (v: string) => void;
  setImportQuickCategoryType: (v: TransactionType) => void;
  createQuickCategory: () => void;
  confirmImport: () => void;
};

type ImportModalProps = {
  imp: ImportHookReturn;
  categories: CategoryRow[];
  groups: CategoryGroupRow[];
  canWrite: boolean;
  monthClosed: boolean;
  formatBRL: (value: number) => string;
};

export function ImportModal({ imp, categories, groups, canWrite, monthClosed, formatBRL }: ImportModalProps) {
  const dedupeRate = imp.importTotal > 0 ? Math.round((imp.importDuplicates / imp.importTotal) * 10000) / 100 : 0;
  const [quickCategoryOpen, setQuickCategoryOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const dropDisabled = !canWrite || monthClosed || imp.importParsing || imp.importSubmitting;

  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length) focusable[0].focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        imp.closeModal();
        return;
      }
      if (e.key !== "Tab") return;
      const list = el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]):not([hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [imp.closeModal]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (dropDisabled) return;
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "ofx") {
      return;
    }
    imp.previewFile(file);
  };

  const formatDateBr = (value: string | null) => {
    if (!value) return "-";
    try { return format(parseISO(value), "dd/MM/yyyy"); }
    catch { return value; }
  };


  return (
    <div className="modal-backdrop" role="presentation" onClick={imp.closeModal}>
      <div ref={modalRef} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="import-modal-title" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h3 id="import-modal-title">Importador CSV/OFX</h3>
          <button type="button" className="icon-button" onClick={imp.closeModal}>
            <X size={16} />
          </button>
        </header>

        <div className="form-grid">
          {imp.importCompleted ? (
            <div className="import-summary">
              <h4>Importacao concluida</h4>
              <div className="import-stats">
                <span>Importados: <strong>{imp.importSummary.imported}</strong></span>
                <span>Duplicadas ignoradas: <strong>{imp.importSummary.duplicates}</strong></span>
                <span>Erros ignorados: <strong>{imp.importSummary.errors}</strong></span>
                <span>Canceladas: <strong>{imp.importSummary.cancelled}</strong></span>
              </div>
              <div className="inline-controls">
                <button type="button" className="primary-button" onClick={imp.resetImport}>
                  Importar outro arquivo
                </button>
                <button type="button" className="ghost-button" onClick={imp.closeModal}>
                  Voltar
                </button>
              </div>
            </div>
          ) : (
            <>
              {imp.importFileName ? (
                <div className="modal-format-chip">Formato detectado: <strong>{imp.importFormat.toUpperCase()}</strong></div>
              ) : null}

              <div
                className={`drop-zone ${isDragging ? "drag-over" : ""} ${dropDisabled ? "disabled" : ""}`}
                onDragOver={(e) => { e.preventDefault(); if (!dropDisabled) setIsDragging(true); }}
                onDragEnter={(e) => { e.preventDefault(); if (!dropDisabled) setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <Upload size={32} />
                <span>Arraste seu arquivo CSV ou OFX aqui</span>
                <button type="button" className="ghost-button" onClick={() => fileInputRef.current?.click()} disabled={dropDisabled}>
                  Procurar arquivo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.ofx"
                  hidden
                  onChange={(e: ChangeEvent<HTMLInputElement>) => imp.previewFile(e.target.files?.[0] ?? null)}
                  disabled={dropDisabled}
                />
              </div>

              {imp.importFileName ? <small>Arquivo: {imp.importFileName}</small> : null}
              <div aria-live="polite">
                {imp.importModalFeedback ? <p className="feedback">{imp.importModalFeedback}</p> : null}
              </div>

              {imp.importTotal > 0 ? (
                <div className="import-stats">
                  <span>Total: <strong>{imp.importTotal}</strong></span>
                  <span>Prontas: <strong>{imp.importReady}</strong></span>
                  <span>Duplicadas: <strong>{imp.importDuplicates}</strong> ({dedupeRate}%)</span>
                  <span>Com erro: <strong>{imp.importErrors}</strong></span>
                  {imp.importMissingCategory > 0 ? <span>Sem categoria: <strong>{imp.importMissingCategory}</strong></span> : null}
                  {imp.importCancelled > 0 ? <span>Canceladas: <strong>{imp.importCancelled}</strong></span> : null}
                </div>
              ) : null}

              {imp.importTotal > 0 ? (
                <div className="quick-category-box">
                  <button
                    type="button"
                    className="quick-category-toggle"
                    onClick={() => setQuickCategoryOpen((v) => !v)}
                  >
                    {quickCategoryOpen ? <Minus size={16} /> : <Plus size={16} />}
                    <strong>Criar categoria rapida</strong>
                  </button>
                  {quickCategoryOpen ? (
                    <div className="quick-category-grid">
                      <input
                        placeholder="Nome da categoria"
                        value={imp.importQuickCategoryName}
                        onChange={(e) => imp.setImportQuickCategoryName(e.target.value)}
                        disabled={imp.importQuickCategorySubmitting || imp.importSubmitting}
                      />
                      <select
                        value={imp.importQuickCategoryType}
                        onChange={(e) => imp.setImportQuickCategoryType(e.target.value as TransactionType)}
                        disabled={imp.importQuickCategorySubmitting || imp.importSubmitting}
                      >
                        <option value="income">income</option>
                        <option value="expense">expense</option>
                        <option value="investment">investment</option>
                      </select>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          imp.createQuickCategory();
                          setQuickCategoryOpen(false);
                        }}
                        disabled={imp.importQuickCategorySubmitting || imp.importSubmitting || !imp.importQuickCategoryName.trim()}
                      >
                        {imp.importQuickCategorySubmitting ? <Spinner label="Criando..." compact /> : "Criar"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {imp.importPreviewRows.length > 0 ? (
                <div className="import-preview-table table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Descricao</th>
                        <th>Data</th>
                        <th>Tipo</th>
                        <th>Categoria</th>
                        <th>Valor</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {imp.importPreviewRows.slice(0, 80).map((row) => (
                          <tr key={`${row.rowIndex}-${row.dedupeKey}`} data-status={row.status}>
                            <td>{row.rowIndex}</td>
                            <td title={row.errorReason ?? ""}>{row.description}</td>
                            <td>{formatDateBr(row.occurrenceDate)}</td>
                            <td><span className={`pill ${row.type}`}>{row.type}</span></td>
                            <td>
                              <CategoryCombobox
                                categories={categories}
                                groups={groups}
                                value={row.categoryId}
                                onChange={(id) => imp.changeRowCategory(row.rowIndex, row.dedupeKey, id)}
                                transactionType={row.type}
                                disabled={row.status === 'erro' || imp.importSubmitting}
                              />
                            </td>
                            <td className="amount">{formatBRL(row.amount)}</td>
                            <td>
                              {row.status === 'erro' || row.status === 'sem_categoria' ? (
                                <span className={`pill status ${row.status === 'erro' ? 'cancelled' : 'planned'}`}>
                                  {row.status === 'erro' ? 'erro' : 'sem categoria'}
                                </span>
                              ) : (
                                <select
                                  value={row.status}
                                  onChange={(e) => imp.changeRowStatus(row.rowIndex, row.dedupeKey, e.target.value as ImportRowStatus)}
                                  disabled={imp.importSubmitting}
                                >
                                  <option value="ok">ok</option>
                                  <option value="duplicada">duplicada</option>
                                  <option value="cancelada">cancelada</option>
                                </select>
                              )}
                            </td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                  {imp.importPreviewRows.length > 80 ? <small>Mostrando 80 de {imp.importPreviewRows.length} linhas.</small> : null}
                </div>
              ) : null}

              <div className="inline-controls">
                {imp.importTotal > 0 ? (
                  <>
                    <button
                      type="button"
                      className={`primary-button ${imp.importSubmitting ? "is-loading" : ""}`}
                      onClick={imp.confirmImport}
                      disabled={!canWrite || monthClosed || imp.importReady <= 0 || imp.importSubmitting || imp.importParsing}
                    >
                      {imp.importSubmitting ? <Spinner label="Importando..." compact /> : `Importar (${imp.importReady})`}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={imp.clearPreview}
                      disabled={imp.importSubmitting || imp.importParsing}
                    >
                      Limpar preview
                    </button>
                  </>
                ) : null}
                <button type="button" className="ghost-button" onClick={imp.closeModal}>
                  Voltar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
