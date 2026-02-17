export type EntryType = "receita" | "despesa" | "investimento";
export type EntryStatus = "previsto" | "realizado" | "cancelado";
export type UserRole = "owner" | "admin" | "viewer";

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
  default_is_recurring: boolean;
  active: boolean;
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

export type MonthlyTotalsByStatus = {
  month_id: string;
  month_start: string;
  status: EntryStatus | null;
  receita_total: number;
  despesa_total: number;
  investimento_total: number;
};

export type EntryForm = {
  description: string;
  amount: string;
  type: EntryType;
  status: EntryStatus;
  categoryId: string;
  isRecurring: boolean;
  plannedDate: string;
  realizedAt: string;
  notes: string;
};

export type UserProfileRow = {
  id: string;
  email: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
};

export type UserInviteRow = {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  accepted_at: string | null;
};
