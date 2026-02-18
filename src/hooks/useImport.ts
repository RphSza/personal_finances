import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ensurePeriodForDate } from "./useTransactions";
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
  isBankStatementBillPayment,
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

export type ImportRowStatus = 'ok' | 'duplicada' | 'erro' | 'sem_categoria' | 'cancelada';

export type ImportPreviewRow = ParsedImportRow & {
  dedupeKey: string;
  isDuplicate: boolean;
  categoryId: string;
  errorReason: string | null;
  status: ImportRowStatus;
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
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importModalFeedback, setImportModalFeedback] = useState("");
  const [importQuickCategoryName, setImportQuickCategoryName] = useState("");
  const [importQuickCategoryType, setImportQuickCategoryType] = useState<TransactionType>("expense");
  const [importQuickCategorySubmitting, setImportQuickCategorySubmitting] = useState(false);
  const [importCompleted, setImportCompleted] = useState(false);
  const [importSummary, setImportSummary] = useState({ imported: 0, duplicates: 0, errors: 0, cancelled: 0 });
  const [cardBillDate, setCardBillDate] = useState("");

  const isCardStatement = isLikelyCardStatement(importFileName);

  const clearPreview = useCallback(() => {
    setImportFileName("");
    setImportPreviewRows([]);
    setImportModalFeedback("");
    setCardBillDate("");
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
          .from("groups")
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

        const periodStart = period.period_start;
        const periodEnd = period.period_end;

        const preview: ImportPreviewRow[] = parsed.map((row) => {
          // In card mode: credit events become income, rest expense
          // In bank mode: detect bill payments and suggest transfer
          const bankBillPayment = !cardMode && isBankStatementBillPayment(row.description);
          const normalizedType: TransactionType = cardMode
            ? isCardCreditEvent(row.description) ? "income" : "expense"
            : bankBillPayment ? "transfer" : row.type;
          const billPayment = cardMode && isCardBillPayment(row.description);
          const dedupeKey = buildDedupeKey({
            description: row.description,
            amount: row.amount,
            type: normalizedType,
            occurrenceDate: row.occurrenceDate,
          });
          const duplicate = seenKeys.has(dedupeKey);
          if (!duplicate) seenKeys.add(dedupeKey);
          const outOfPeriod = row.occurrenceDate
            ? row.occurrenceDate < periodStart || row.occurrenceDate > periodEnd
            : false;
          const errorReason = billPayment
            ? "Pagamento de fatura detectado e ignorado para evitar duplicidade."
            : !row.description.trim()
              ? "Descricao obrigatoria"
              : outOfPeriod
                ? `Data ${row.occurrenceDate} fora da competencia (${periodStart.slice(0, 7)})`
                : bankBillPayment
                  ? "Detectado como pagamento de fatura de cartao. Marcar como transferencia evita contagem dupla."
                  : null;
          const categoryId = suggestCategoryId(categories, row.description, normalizedType, row.categoryHint);
          const matchedCat = categoryId ? categories.find((c) => c.id === categoryId) : undefined;
          const finalType: TransactionType = bankBillPayment ? "transfer" : (matchedCat ? matchedCat.default_type : normalizedType);
          // Bank bill payments get status 'ok' (not 'erro') so user can import them as transfer
          const status: ImportRowStatus = (errorReason && !bankBillPayment)
            ? 'erro'
            : duplicate
              ? 'duplicada'
              : !categoryId
                ? 'sem_categoria'
                : 'ok';
          return { ...row, type: finalType, dedupeKey, isDuplicate: duplicate, categoryId, errorReason, status };
        });

        for (const row of preview) {
          if (!row.categoryId && !row.errorReason && !row.isDuplicate) {
            if (!fallbackByType[row.type]) {
              fallbackByType[row.type] = await ensureFallbackCategory(row.type);
            }
            row.categoryId = fallbackByType[row.type] ?? "";
          }
        }

        if (preview.length === 0) {
          setImportModalFeedback("Arquivo vazio ou sem dados validos.");
          setImportParsing(false);
          return;
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

  const changeRowStatus = useCallback((rowIndex: number, dedupeKey: string, newStatus: ImportRowStatus) => {
    setImportPreviewRows((current) =>
      current.map((row) => {
        if (row.rowIndex !== rowIndex || row.dedupeKey !== dedupeKey) return row;
        if (row.status === 'erro') return row;
        return { ...row, status: newStatus };
      })
    );
  }, []);

  const changeRowCategory = useCallback((rowIndex: number, dedupeKey: string, categoryId: string) => {
    setImportPreviewRows((current) =>
      current.map((row) => {
        if (row.rowIndex !== rowIndex || row.dedupeKey !== dedupeKey) return row;
        const matchedCat = categoryId ? categories.find((c) => c.id === categoryId) : undefined;
        const newType = matchedCat ? matchedCat.default_type : row.type;
        const newStatus = row.status === 'sem_categoria' && categoryId ? 'ok' : row.status;
        return { ...row, categoryId, type: newType, status: newStatus };
      })
    );
  }, [categories]);

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
            .from("groups")
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
          current.map((row) => {
            if (row.type !== importQuickCategoryType || row.categoryId) return row;
            const newStatus = row.status === 'sem_categoria' ? 'ok' : row.status;
            return { ...row, categoryId: data.id, status: newStatus };
          })
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

      // T020: Validate card bill date for card statements
      if (isCardStatement && !cardBillDate) {
        setImportModalFeedback("Informe a data de pagamento da fatura.");
        return;
      }

      const validRows = importPreviewRows.filter((row) => row.status === 'ok' && !!row.categoryId);
      if (!validRows.length) { setImportModalFeedback("Nenhuma linha valida para importar."); return; }

      setImportModalFeedback("");
      const t0 = performance.now();

      // T017: Resolve period for card bill date
      let targetPeriodId = period.id;
      if (cardBillDate) {
        const resolved = await ensurePeriodForDate(workspaceId, cardBillDate);
        if (resolved.closed) {
          const monthLabel = format(parseISO(cardBillDate), "MMMM 'de' yyyy");
          setImportModalFeedback(`O periodo de ${monthLabel} esta fechado. Reabra-o antes de importar.`);
          return;
        }
        targetPeriodId = resolved.periodId;
      }

      // Step 1: create import job
      const summary = {
        total_rows: importPreviewRows.length,
        valid_rows: validRows.length,
        duplicate_rows: importPreviewRows.filter((row) => row.status === 'duplicada').length,
        error_rows: importPreviewRows.filter((row) => row.status === 'erro').length,
      };
      const { data: job, error: jobError } = await supabase
        .from("import_jobs")
        .insert({
          workspace_id: workspaceId,
          period_id: targetPeriodId,
          created_by: userId,
          source_format: importFormat,
          file_name: importFileName || "upload",
          status: "processing",
          ...summary,
        })
        .select("id")
        .single();
      if (jobError) throw jobError;
      console.log("[import] step-1 import_jobs done (%dms)", Math.round(performance.now() - t0));

      // Step 2: insert import_job_rows (audit trail)
      const t2 = performance.now();
      const rowsPayload = importPreviewRows.map((row) => ({
        workspace_id: workspaceId,
        job_id: job.id,
        period_id: targetPeriodId,
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
      const { error: rowsError } = await supabase
        .from("import_job_rows")
        .insert(rowsPayload);
      if (rowsError) throw rowsError;
      console.log("[import] step-2 import_job_rows done (%dms)", Math.round(performance.now() - t2));

      // Step 3: insert transactions
      const t3 = performance.now();
      const isCard = !!cardBillDate;
      const entriesPayload = validRows.map((row) => ({
        workspace_id: workspaceId,
        period_id: targetPeriodId,
        category_id: row.categoryId,
        description: row.description,
        amount: row.amount,
        type: row.type,
        status: isCard ? "settled" : "planned",
        is_recurring: false,
        planned_date: row.occurrenceDate,
        settled_at: isCard ? cardBillDate : null,
        is_credit_card: isCard,
        credit_card_bill_date: isCard ? cardBillDate : null,
        notes: `Importado via ${importFormat.toUpperCase()}`,
      }));
      const { error: entriesError } = await supabase
        .from("transactions")
        .insert(entriesPayload);
      if (entriesError) throw entriesError;
      console.log("[import] step-3 transactions done (%dms)", Math.round(performance.now() - t3));

      // Step 4: mark job completed
      const t4 = performance.now();
      await supabase
        .from("import_jobs")
        .update({ status: "completed", imported_rows: entriesPayload.length, completed_at: new Date().toISOString() })
        .eq("id", job.id);
      console.log("[import] step-4 update_job done (%dms)", Math.round(performance.now() - t4));

      console.log("[import] complete — total %dms, imported %d rows", Math.round(performance.now() - t0), entriesPayload.length);
      setImportSummary({
        imported: entriesPayload.length,
        duplicates: importPreviewRows.filter((r) => r.status === 'duplicada').length,
        errors: importPreviewRows.filter((r) => r.status === 'erro').length,
        cancelled: importPreviewRows.filter((r) => r.status === 'cancelada').length,
      });
      setImportCompleted(true);
      qc.invalidateQueries();
      setImportModalFeedback("");
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "Falha ao confirmar importacao.";
      console.error("[import] failed:", error);
      setImportModalFeedback(msg);
    },
  });

  const importTotal = importPreviewRows.length;
  const importReady = importPreviewRows.filter((r) => r.status === 'ok' && !!r.categoryId).length;
  const importDuplicates = importPreviewRows.filter((r) => r.status === 'duplicada').length;
  const importErrors = importPreviewRows.filter((r) => r.status === 'erro').length;
  const importMissingCategory = importPreviewRows.filter((r) => r.status === 'sem_categoria').length;
  const importCancelled = importPreviewRows.filter((r) => r.status === 'cancelada').length;

  const resetImport = useCallback(() => {
    setImportCompleted(false);
    setImportSummary({ imported: 0, duplicates: 0, errors: 0, cancelled: 0 });
    clearPreview();
  }, [clearPreview]);

  return {
    importFormat,
    importFileName,
    importPreviewRows,
    importParsing,
    importSubmitting: confirmMutation.isPending,
    importModalOpen,
    importModalFeedback,
    importQuickCategoryName,
    importQuickCategoryType,
    importQuickCategorySubmitting,
    importCompleted,
    importSummary,
    importTotal,
    importReady,
    importDuplicates,
    importErrors,
    importMissingCategory,
    importCancelled,
    cardBillDate,
    setCardBillDate,
    isCardStatement,
    openModal: () => { setImportModalFeedback(""); setImportCompleted(false); setImportModalOpen(true); },
    closeModal: () => { setImportModalFeedback(""); setImportModalOpen(false); },
    previewFile,
    changeRowCategory,
    changeRowStatus,
    clearPreview,
    resetImport,
    setImportQuickCategoryName,
    setImportQuickCategoryType,
    createQuickCategory: () => createQuickCategoryMutation.mutate(),
    confirmImport: () => { if (!confirmMutation.isPending) confirmMutation.mutate(); },
  };
}
