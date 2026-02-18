export type TransactionType = "income" | "expense" | "investment" | "transfer";
export type TransactionStatus = "planned" | "settled" | "cancelled";
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export type FiscalPeriodRow = {
  id: string;
  period_start: string;
  period_end: string;
  closed_at: string | null;
};

export type CategoryGroupRow = {
  id: string;
  workspace_id: string | null;
  code: string;
  name: string;
  sort_order: number;
  deleted_at: string | null;
  created_by: string | null;
};

export type CategoryRow = {
  id: string;
  workspace_id: string | null;
  group_id: string;
  code: string;
  name: string;
  default_type: TransactionType;
  default_is_recurring: boolean;
  deleted_at: string | null;
  created_by: string | null;
};

export type TransactionRow = {
  id: string;
  period_id: string;
  category_id: string;
  description: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  is_recurring: boolean;
  planned_date: string | null;
  settled_at: string | null;
  is_credit_card: boolean;
  credit_card_bill_date: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
};

export type PeriodTotals = {
  period_id: string;
  period_start: string;
  income_total: number;
  expense_total: number;
  recurring_expense: number;
  investment_total: number;
  net_result: number;
};

export type PeriodTotalsByStatus = {
  period_id: string;
  period_start: string;
  status: TransactionStatus | null;
  income_total: number;
  expense_total: number;
  investment_total: number;
};

export type TransactionForm = {
  description: string;
  amount: string;
  type: TransactionType;
  status: TransactionStatus;
  categoryId: string;
  isRecurring: boolean;
  plannedDate: string;
  settledAt: string;
  notes: string;
  isCreditCard: boolean;
  creditCardBillDate: string;
};

export type UserProfileRow = {
  id: string;
  email: string | null;
  role: string;
  active: boolean;
  created_at: string;
};

export type WorkspaceInviteRow = {
  id: string;
  email: string;
  role: WorkspaceRole;
  created_at: string;
  accepted_at: string | null;
};
