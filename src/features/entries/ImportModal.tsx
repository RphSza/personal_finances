import { ChangeEvent } from "react";
import { X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Spinner } from "../../components/LoadingState";
import type { CategoryRow, TransactionType } from "../../types";

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
  }>;
  importParsing: boolean;
  importSubmitting: boolean;
  importModalFeedback: string;
  importQuickCategoryName: string;
  importQuickCategoryType: TransactionType;
  importQuickCategorySubmitting: boolean;
  closeModal: () => void;
  previewFile: (file: File | null) => void;
  changeRowCategory: (rowIndex: number, dedupeKey: string, categoryId: string) => void;
  clearPreview: () => void;
  setImportQuickCategoryName: (v: string) => void;
  setImportQuickCategoryType: (v: TransactionType) => void;
  createQuickCategory: () => void;
  confirmImport: () => void;
};

type ImportModalProps = {
  imp: ImportHookReturn;
  categories: CategoryRow[];
  canWrite: boolean;
  monthClosed: boolean;
  formatBRL: (value: number) => string;
};

export function ImportModal({ imp, categories, canWrite, monthClosed, formatBRL }: ImportModalProps) {
  const importTotal = imp.importPreviewRows.length;
  const importDuplicate = imp.importPreviewRows.filter((r) => r.isDuplicate).length;
  const importError = imp.importPreviewRows.filter((r) => !!r.errorReason).length;
  const importMissingCategory = imp.importPreviewRows.filter((r) => !r.isDuplicate && !r.errorReason && !r.categoryId).length;
  const importReady = imp.importPreviewRows.filter((r) => !r.isDuplicate && !r.errorReason && !!r.categoryId).length;
  const dedupeRate = importTotal > 0 ? Math.round((importDuplicate / importTotal) * 10000) / 100 : 0;

  const formatDateBr = (value: string | null) => {
    if (!value) return "-";
    try { return format(parseISO(value), "dd/MM/yyyy"); }
    catch { return value; }
  };

  const categoryOptionsByType = (type: TransactionType) => {
    const typed = categories.filter((cat) => cat.deleted_at === null && cat.default_type === type);
    return typed.length ? typed : categories.filter((cat) => cat.deleted_at === null);
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={imp.closeModal}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h3>Importador v1 (CSV/OFX)</h3>
          <button type="button" className="icon-button" onClick={imp.closeModal}>
            <X size={16} />
          </button>
        </header>

        <div className="form-grid">
          <div className="modal-format-chip">Formato detectado: <strong>{imp.importFormat.toUpperCase()}</strong></div>

          <input
            type="file"
            accept=".csv,.ofx"
            onChange={(e: ChangeEvent<HTMLInputElement>) => imp.previewFile(e.target.files?.[0] ?? null)}
            disabled={!canWrite || monthClosed || imp.importParsing || imp.importSubmitting}
          />

          {imp.importFileName ? <small>Arquivo: {imp.importFileName}</small> : null}
          {imp.importModalFeedback ? <p className="feedback">{imp.importModalFeedback}</p> : null}

          {importTotal > 0 ? (
            <div className="import-stats">
              <span>Total: <strong>{importTotal}</strong></span>
              <span>Prontas: <strong>{importReady}</strong></span>
              <span>Duplicadas: <strong>{importDuplicate}</strong> ({dedupeRate}%)</span>
              <span>Com erro: <strong>{importError}</strong></span>
              <span>Sem categoria: <strong>{importMissingCategory}</strong></span>
            </div>
          ) : null}

          <div className="quick-category-box">
            <strong>Criar categoria rapida</strong>
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
                onClick={imp.createQuickCategory}
                disabled={imp.importQuickCategorySubmitting || imp.importSubmitting || !imp.importQuickCategoryName.trim()}
              >
                {imp.importQuickCategorySubmitting ? <Spinner label="Criando..." compact /> : "Criar"}
              </button>
            </div>
          </div>

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
                  {imp.importPreviewRows.slice(0, 80).map((row) => {
                    const rowCategories = categoryOptionsByType(row.type);
                    const status = row.errorReason
                      ? "erro"
                      : row.isDuplicate
                        ? "duplicada"
                        : row.categoryId
                          ? "ok"
                          : "sem categoria";
                    return (
                      <tr key={`${row.rowIndex}-${row.dedupeKey}`}>
                        <td>{row.rowIndex}</td>
                        <td title={row.errorReason ?? ""}>{row.description}</td>
                        <td>{formatDateBr(row.occurrenceDate)}</td>
                        <td><span className={`pill ${row.type}`}>{row.type}</span></td>
                        <td>
                          <select
                            value={row.categoryId}
                            onChange={(e) => imp.changeRowCategory(row.rowIndex, row.dedupeKey, e.target.value)}
                            disabled={!!row.errorReason || imp.importSubmitting}
                          >
                            <option value="">Outros / sem categoria</option>
                            {rowCategories.map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="amount">{formatBRL(row.amount)}</td>
                        <td>
                          {status === "erro" ? (
                            <span className="pill status cancelled">erro</span>
                          ) : status === "duplicada" ? (
                            <span className="pill status planned">duplicada</span>
                          ) : status === "sem categoria" ? (
                            <span className="pill status cancelled">sem categoria</span>
                          ) : (
                            <span className="pill status settled">ok</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {imp.importPreviewRows.length > 80 ? <small>Mostrando 80 de {imp.importPreviewRows.length} linhas.</small> : null}
            </div>
          ) : null}

          <div className="inline-controls">
            <button
              type="button"
              className={`primary-button ${imp.importSubmitting ? "is-loading" : ""}`}
              onClick={imp.confirmImport}
              disabled={!canWrite || monthClosed || importReady <= 0 || imp.importSubmitting || imp.importParsing}
            >
              {imp.importSubmitting ? <Spinner label="Importando..." compact /> : "Confirmar importacao"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={imp.clearPreview}
              disabled={imp.importSubmitting || imp.importParsing || imp.importPreviewRows.length === 0}
            >
              Limpar preview
            </button>
            <button type="button" className="ghost-button" onClick={imp.closeModal}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
