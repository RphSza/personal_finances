export type EntryType = "receita" | "despesa" | "investimento";
export type EntryStatus = "previsto" | "realizado" | "cancelado";

export type MonthRow = {
  id: string;
  month_start: string;
};

export type CategoryGroupRow = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
};

export type CategoryRow = {
  id: string;
  group_id: string;
  code: string;
  name: string;
  default_type: EntryType;
};

export type EntryRow = {
  id: string;
  month_id: string;
  category_id: string;
  description: string;
  amount: number;
  type: EntryType;
  status: EntryStatus;
  is_recurring: boolean;
  planned_date: string | null;
  realized_at: string | null;
  notes: string | null;
  created_at: string;
  category?: {
    name: string;
    group_id: string;
  };
};

export type MonthlyTotals = {
  month_id: string;
  month_start: string;
  receita_total: number;
  despesa_total: number;
  despesa_recorrente: number;
  investimento_total: number;
  resultado_mes: number;
};
