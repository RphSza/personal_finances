export const queryKeys = {
  fiscalPeriod: (workspaceId: string, month: string) =>
    ["fiscal-period", workspaceId, month] as const,
  transactions: (workspaceId: string, periodId: string) =>
    ["transactions", workspaceId, periodId] as const,
  categoryGroups: (workspaceId: string) =>
    ["category-groups", workspaceId] as const,
  categories: (workspaceId: string) =>
    ["categories", workspaceId] as const,
  periodTotals: (workspaceId: string, month: string) =>
    ["period-totals", workspaceId, month] as const,
  trend: (workspaceId: string, month: string, window: number) =>
    ["trend", workspaceId, month, window] as const,
  trendByStatus: (workspaceId: string, month: string, window: number) =>
    ["trend-by-status", workspaceId, month, window] as const,
  workspaceUsers: (workspaceId: string) =>
    ["workspace-users", workspaceId] as const,
  workspaceInvites: (workspaceId: string) =>
    ["workspace-invites", workspaceId] as const,
};
