import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { useAuth } from "../contexts/AuthContext";
import { slugify } from "../utils/formatting";
import { normalizeSearch } from "../utils/search";
import { suggestCategoryId } from "../utils/categorySuggestion";
import {
  inferImportFormatFromFileName,
  isLikelyCardStatement,
  isCardBillPayment,
  isCardCreditEvent,
} from "../utils/importHelpers";
import {
  buildDedupeKey,
  parseImportFile,
  type ImportFormat,
  type ParsedImportRow,
} from "../features/entries/importParser";
import type {
  CategoryGroupRow,
  CategoryRow,
  FiscalPeriodRow,
  TransactionRow,
  TransactionType,
} from "../types";

export type ImportPreviewRow = ParsedImportRow & {
  dedupeKey: string;
  isDuplicate: boolean;
  categoryId: string;
  errorReason: string | null;
};

export function useImport(
  period: FiscalPeriodRow | undefined,
  transactions: TransactionRow[],
  categories: CategoryRow[],
  groups: CategoryGroupRow[],
  onCategoriesChanged: () => void
) {
  const { workspaceId, canWrite } = useWorkspace();
  const { userId } = useAuth();
  const qc = useQueryClient();

  const [importFormat, setImportFormat] = useState<ImportFormat>("csv");
  const [importFileName, setImportFileName] = useState("");
  const [importPreviewRows, setImportPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [importParsing, setImportParsing] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importModalFeedback, setImportModalFeedback] = useState("");
  const [importQuickCategoryName, setImportQuickCategoryName] = useState("");
  const [importQuickCategoryType, setImportQuickCategoryType] = useState<TransactionType>("expense");
  const [importQuickCategorySubmitting, setImportQuickCategorySubmitting] = useState(false);

  const clearPreview = useCallback(() => {
    setImportFileName("");
    setImportPreviewRows([]);
    setImportModalFeedback("");
  }, []);

  const buildExistingDedupeSet = useCallback(() => {
    const keys = new Set<string>();
    for (const t of transactions) {
      const date = t.settled_at ?? t.planned_date ?? null;
      keys.add(buildDedupeKey({ description: t.description, amount: Number(t.amount), type: t.type, occurrenceDate: date }));
    }
    return keys;
  }, [transactions]);

  const ensureFallbackCategory = useCallback(
    async (type: TransactionType = "expense"): Promise<string> => {
      if (!supabase || !workspaceId || !canWrite) return "";
      const active = categories.filter((cat) => cat.deleted_at === null);
      const existing = active.find((cat) => normalizeSearch(cat.name) === "outros" && cat.default_type === type);
      if (existing) return existing.id;

      let groupId = groups[0]?.id ?? "";
      if (!groupId) {
        const { data: createdGroup, error: groupError } = await supabase
          .from("category_groups")
          .insert({ workspace_id: workspaceId, name: "Geral", code: "GERAL", sort_order: 1 })
          .select("id")
          .single();
        if (groupError) throw groupError;
        groupId = createdGroup.id;
      }

      const { data: createdCategory, error: categoryError } = await supabase
        .from("categories")
        .insert({
          workspace_id: workspaceId,
          name: "Outros",
          code: `outros_${type}`,
          group_id: groupId,
          default_type: type,
          default_is_recurring: false,
        })
        .select("id")
        .single();
      if (categoryError) throw categoryError;
      onCategoriesChanged();
      return createdCategory.id as string;
    },
    [categories, groups, canWrite, onCategoriesChanged, workspaceId]
  );

  const previewFile = useCallback(
    async (file: File | null) => {
      if (!file) { clearPreview(); return; }
      if (!period || !canWrite) return;
      if (period.closed_at) return;
      const detectedFormat = inferImportFormatFromFileName(file.name);
      if (!detectedFormat) { clearPreview(); return; }

      setImportParsing(true);
      setImportModalFeedback("");
      try {
        setImportFormat(detectedFormat);
        const rawText = await file.text();
        const parsed = parseImportFile(detectedFormat, rawText);
        const cardMode = isLikelyCardStatement(file.name);
        const seenKeys = buildExistingDedupeSet();
        const fallbackByType: Partial<Record<TransactionType, string>> = {};

        const preview: ImportPreviewRow[] = parsed.map((row) => {
          const normalizedType: TransactionType = cardMode
            ? isCardCreditEvent(row.description) ? "income" : "expense"
            : row.type;
          const billPayment = cardMode && isCardBillPayment(row.description);
          const dedupeKey = buildDedupeKey({
            description: row.description,
            amount: row.amount,
            type: normalizedType,
            occurrenceDate: row.occurrenceDate,
          });
          const duplicate = seenKeys.has(dedupeKey);
          if (!duplicate) seenKeys.add(dedupeKey);
          const errorReason = billPayment
            ? "Pagamento de fatura detectado e ignorado para evitar duplicidade."
            : row.description.trim() ? null : "Descricao obrigatoria";
          const categoryId = suggestCategoryId(categories, row.description, normalizedType, row.categoryHint);
          return { ...row, type: normalizedType, dedupeKey, isDuplicate: duplicate, categoryId, errorReason };
        });

        for (const row of preview) {
          if (!row.categoryId && !row.errorReason && !row.isDuplicate) {
            if (!fallbackByType[row.type]) {
              fallbackByType[row.type] = await ensureFallbackCategory(row.type);
            }
            row.categoryId = fallbackByType[row.type] ?? "";
          }
        }

        setImportFileName(file.name);
        setImportPreviewRows(preview);
      } catch (error) {
        setImportModalFeedback(error instanceof Error ? error.message : "Falha ao processar arquivo.");
      } finally {
        setImportParsing(false);
      }
    },
    [buildExistingDedupeSet, categories, clearPreview, ensureFallbackCategory, canWrite, period]
  );

  const changeRowCategory = useCallback((rowIndex: number, dedupeKey: string, categoryId: string) => {
    setImportPreviewRows((current) =>
      current.map((row) => (row.rowIndex === rowIndex && row.dedupeKey === dedupeKey ? { ...row, categoryId } : row))
    );
  }, []);

  const createQuickCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!supabase || !workspaceId || !canWrite) return;
      const name = importQuickCategoryName.trim();
      if (!name) { setImportModalFeedback("Informe o nome da nova categoria."); return; }
      setImportQuickCategorySubmitting(true);
      setImportModalFeedback("");
      try {
        let groupId = groups[0]?.id ?? "";
        const code = slugify(name);
        if (!groupId) {
          const { data: createdGroup, error: groupError } = await supabase
            .from("category_groups")
            .insert({ workspace_id: workspaceId, name: "Geral", code: "GERAL", sort_order: 1 })
            .select("id")
            .single();
          if (groupError) throw groupError;
          groupId = createdGroup.id;
        }
        const { data, error } = await supabase
          .from("categories")
          .insert({
            workspace_id: workspaceId,
            name,
            code,
            group_id: groupId,
            default_type: importQuickCategoryType,
            default_is_recurring: false,
          })
          .select("id")
          .single();
        if (error) throw error;
        onCategoriesChanged();
        setImportQuickCategoryName("");
        setImportPreviewRows((current) =>
          current.map((row) => (row.type === importQuickCategoryType && !row.categoryId ? { ...row, categoryId: data.id } : row))
        );
        setImportModalFeedback(`Categoria "${name}" criada com sucesso.`);
      } catch (error) {
        setImportModalFeedback(error instanceof Error ? error.message : "Falha ao criar categoria.");
      } finally {
        setImportQuickCategorySubmitting(false);
      }
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!supabase || !workspaceId || !userId || !period || !canWrite) return;
      if (period.closed_at) { setImportModalFeedback("Competencia fechada."); return; }
      const validRows = importPreviewRows.filter((row) => !row.isDuplicate && !row.errorReason && !!row.categoryId);
      if (!validRows.length) { setImportModalFeedback("Nenhuma linha valida para importar."); return; }

      setImportSubmitting(true);
      setImportModalFeedback("");
      try {
        const summary = {
          total_rows: importPreviewRows.length,
          valid_rows: validRows.length,
          duplicate_rows: importPreviewRows.filter((row) => row.isDuplicate).length,
          error_rows: importPreviewRows.filter((row) => !!row.errorReason).length,
        };
        const { data: job, error: jobError } = await supabase
          .from("import_jobs")
          .insert({
            workspace_id: workspaceId,
            period_id: period.id,
            created_by: userId,
            source_format: importFormat,
            file_name: importFileName || "upload",
            status: "processing",
            ...summary,
          })
          .select("id")
          .single();
        if (jobError) throw jobError;

        const rowsPayload = importPreviewRows.map((row) => ({
          workspace_id: workspaceId,
          job_id: job.id,
          period_id: period.id,
          category_id: row.categoryId || null,
          row_index: row.rowIndex,
          description: row.description,
          amount: row.amount,
          type: row.type,
          occurrence_date: row.occurrenceDate,
          dedupe_key: row.dedupeKey,
          is_duplicate: row.isDuplicate,
          is_error: !!row.errorReason,
          error_reason: row.errorReason,
          raw_payload: row.rawPayload,
        }));
        const { error: rowsError } = await supabase.from("import_job_rows").insert(rowsPayload);
        if (rowsError) throw rowsError;

        const entriesPayload = validRows.map((row) => ({
          workspace_id: workspaceId,
          period_id: period.id,
          category_id: row.categoryId,
          description: row.description,
          amount: row.amount,
          type: row.type,
          status: "planned",
          is_recurring: false,
          planned_date: row.occurrenceDate,
          notes: `Importado via ${importFormat.toUpperCase()}`,
        }));
        const { data: created, error: entriesError } = await supabase
          .from("transactions")
          .insert(entriesPayload)
          .select("id");
        if (entriesError) throw entriesError;

        await supabase
          .from("import_jobs")
          .update({ status: "completed", imported_rows: created?.length ?? entriesPayload.length, completed_at: new Date().toISOString() })
          .eq("id", job.id);

        clearPreview();
        qc.invalidateQueries();
        setImportModalFeedback(`Importacao concluida: ${entriesPayload.length} lancamentos adicionados.`);
      } catch (error) {
        setImportModalFeedback(error instanceof Error ? error.message : "Falha ao confirmar importacao.");
      } finally {
        setImportSubmitting(false);
      }
    },
  });

  return {
    importFormat,
    importFileName,
    importPreviewRows,
    importParsing,
    importSubmitting,
    importModalOpen,
    importModalFeedback,
    importQuickCategoryName,
    importQuickCategoryType,
    importQuickCategorySubmitting,
    openModal: () => { setImportModalFeedback(""); setImportModalOpen(true); },
    closeModal: () => { setImportModalFeedback(""); setImportModalOpen(false); },
    previewFile,
    changeRowCategory,
    clearPreview,
    setImportQuickCategoryName,
    setImportQuickCategoryType,
    createQuickCategory: () => createQuickCategoryMutation.mutate(),
    confirmImport: () => confirmMutation.mutate(),
  };
}
