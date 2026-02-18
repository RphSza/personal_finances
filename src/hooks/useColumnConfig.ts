import { useCallback, useRef, useState } from "react";

export type ColumnDef = {
  key: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
};

const STORAGE_KEY = "pf:column-config";

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: "select", label: "", defaultWidth: 36, minWidth: 36 },
  { key: "date", label: "Data", defaultWidth: 70, minWidth: 50 },
  { key: "description", label: "Descricao", defaultWidth: 220, minWidth: 80 },
  { key: "group", label: "Grupo", defaultWidth: 140, minWidth: 60 },
  { key: "category", label: "Categoria", defaultWidth: 140, minWidth: 60 },
  { key: "type", label: "Tipo", defaultWidth: 90, minWidth: 60 },
  { key: "status", label: "Status", defaultWidth: 90, minWidth: 60 },
  { key: "amount", label: "Valor", defaultWidth: 110, minWidth: 60 },
  { key: "actions", label: "Acoes", defaultWidth: 160, minWidth: 100 },
];

type StoredConfig = {
  order: string[];
  widths: Record<string, number>;
};

function loadConfig(): StoredConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredConfig;
  } catch {
    return null;
  }
}

function saveConfig(order: string[], widths: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ order, widths }));
}

export function useColumnConfig() {
  const stored = useRef(loadConfig());

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (stored.current?.order?.length) {
      const validKeys = new Set(DEFAULT_COLUMNS.map((c) => c.key));
      const filtered = stored.current.order.filter((k) => validKeys.has(k));
      const missing = DEFAULT_COLUMNS.map((c) => c.key).filter((k) => !filtered.includes(k));
      return [...filtered, ...missing];
    }
    return DEFAULT_COLUMNS.map((c) => c.key);
  });

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    for (const col of DEFAULT_COLUMNS) defaults[col.key] = col.defaultWidth;
    if (stored.current?.widths) {
      return { ...defaults, ...stored.current.widths };
    }
    return defaults;
  });

  const columnDefs = DEFAULT_COLUMNS;

  const persist = useCallback((order: string[], widths: Record<string, number>) => {
    saveConfig(order, widths);
  }, []);

  const onResizeStart = useCallback(
    (colKey: string, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = columnWidths[colKey] ?? 100;
      const minW = DEFAULT_COLUMNS.find((c) => c.key === colKey)?.minWidth ?? 40;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const newWidth = Math.max(minW, startWidth + dx);
        setColumnWidths((prev) => {
          const next = { ...prev, [colKey]: newWidth };
          persist(columnOrder, next);
          return next;
        });
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [columnWidths, columnOrder, persist]
  );

  const dragCol = useRef<string | null>(null);

  const onReorderStart = useCallback(
    (colKey: string) => {
      dragCol.current = colKey;
    },
    []
  );

  const onReorderDrop = useCallback(
    (targetKey: string) => {
      const fromKey = dragCol.current;
      dragCol.current = null;
      if (!fromKey || fromKey === targetKey) return;
      setColumnOrder((prev) => {
        const next = [...prev];
        const fromIdx = next.indexOf(fromKey);
        const toIdx = next.indexOf(targetKey);
        if (fromIdx < 0 || toIdx < 0) return prev;
        next.splice(fromIdx, 1);
        next.splice(toIdx, 0, fromKey);
        persist(next, columnWidths);
        return next;
      });
    },
    [columnWidths, persist]
  );

  const resetColumns = useCallback(() => {
    const order = DEFAULT_COLUMNS.map((c) => c.key);
    const widths: Record<string, number> = {};
    for (const col of DEFAULT_COLUMNS) widths[col.key] = col.defaultWidth;
    setColumnOrder(order);
    setColumnWidths(widths);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    columnOrder,
    columnWidths,
    columnDefs,
    onResizeStart,
    onReorderStart,
    onReorderDrop,
    resetColumns,
  };
}
