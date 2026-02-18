import { format, parseISO } from "date-fns";
import type { TrendMode } from "../app/types";
import type { TransactionRow } from "../../types";

type BoardGroup = {
  groupId: string;
  groupName: string;
  total: number;
  rows: TransactionRow[];
};

type TrendRow = {
  period_start: string;
  income_total: number;
  expense_total: number;
  net_result: number;
};

type MonthlyStatusRow = {
  periodStart: string;
  monthLabel: string;
  planned: number;
  settled: number;
};

type ExpenseCategory = {
  categoryId: string;
  name: string;
  total: number;
};

type DashboardPageProps = {
  trendMode: TrendMode;
  trendWindow: 6 | 12 | 24;
  onChangeTrendMode: (mode: TrendMode) => void;
  onChangeTrendWindow: (window: 6 | 12 | 24) => void;
  trendRows: TrendRow[];
  trendMaxValue: number;
  trendResultMaxAbs: number;
  monthlyStatusTrend: { rows: MonthlyStatusRow[]; maxAbs: number };
  topExpenseCategories: { rows: ExpenseCategory[]; max: number };
  boardRows: BoardGroup[];
  formatBRL: (value: number) => string;
};

export function DashboardPage({
  trendMode,
  trendWindow,
  onChangeTrendMode,
  onChangeTrendWindow,
  trendRows,
  trendMaxValue,
  trendResultMaxAbs,
  monthlyStatusTrend,
  topExpenseCategories,
  boardRows,
  formatBRL
}: DashboardPageProps) {
  return (
    <main className="dashboard-layout-grid">
      <section className="panel dashboard-panel">
        <div className="panel-header">
          <h3>Serie mensal {trendMode === "income_vs_expense" ? "(receitas x despesas)" : "(resultado do mes)"}</h3>
          <div className="inline-controls">
            <button className={trendMode === "income_vs_expense" ? "toggle active" : "toggle"} onClick={() => onChangeTrendMode("income_vs_expense")} title="Mostrar receitas e despesas mensais">R x D</button>
            <button className={trendMode === "net_result" ? "toggle active" : "toggle"} onClick={() => onChangeTrendMode("net_result")} title="Mostrar resultado mensal">Resultado</button>
            <button className={trendWindow === 6 ? "toggle active" : "toggle"} onClick={() => onChangeTrendWindow(6)} title="Ultimos 6 meses">6M</button>
            <button className={trendWindow === 12 ? "toggle active" : "toggle"} onClick={() => onChangeTrendWindow(12)} title="Ultimos 12 meses">12M</button>
            <button className={trendWindow === 24 ? "toggle active" : "toggle"} onClick={() => onChangeTrendWindow(24)} title="Ultimos 24 meses">24M</button>
          </div>
        </div>

        <div className="trend-chart">
          {trendRows.map((row) => {
            const incomeHeight = (row.income_total / trendMaxValue) * 100;
            const expenseHeight = (row.expense_total / trendMaxValue) * 100;
            const resultHeight = (Math.abs(row.net_result) / trendResultMaxAbs) * 100;
            return (
              <article key={row.period_start} className="trend-col">
                {trendMode === "income_vs_expense" ? (
                  <div className="trend-bars">
                    <span className="trend-bar income" style={{ height: `${incomeHeight}%` }} />
                    <span className="trend-bar expense" style={{ height: `${expenseHeight}%` }} />
                  </div>
                ) : (
                  <div className="trend-bars single">
                    <span
                      className={`trend-bar net-result ${row.net_result >= 0 ? "pos" : "neg"}`}
                      style={{ height: `${resultHeight}%` }}
                    />
                  </div>
                )}
                <small>{format(parseISO(row.period_start), "MMM/yy")}</small>
                <small className={row.net_result >= 0 ? "positive" : "negative"}>{formatBRL(row.net_result)}</small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel dashboard-panel">
        <h3>Previsto x Realizado (resultado mensal)</h3>
        <div className="comparison-chart">
          {monthlyStatusTrend.rows.map((row) => {
            const plannedWidth = (Math.abs(row.planned) / monthlyStatusTrend.maxAbs) * 100;
            const settledWidth = (Math.abs(row.settled) / monthlyStatusTrend.maxAbs) * 100;
            return (
              <article key={row.periodStart} className="comparison-row">
                <small>{row.monthLabel}</small>
                <div className="comparison-bars">
                  <div className="comparison-line">
                    <span className="comparison-label">Previsto</span>
                    <span className={`comparison-fill planned ${row.planned >= 0 ? "pos" : "neg"}`} style={{ width: `${plannedWidth}%` }} />
                    <span className={row.planned >= 0 ? "positive" : "negative"}>{formatBRL(row.planned)}</span>
                  </div>
                  <div className="comparison-line">
                    <span className="comparison-label">Realizado</span>
                    <span className={`comparison-fill settled ${row.settled >= 0 ? "pos" : "neg"}`} style={{ width: `${settledWidth}%` }} />
                    <span className={row.settled >= 0 ? "positive" : "negative"}>{formatBRL(row.settled)}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel dashboard-panel">
        <h3>Top despesas por categoria no mes</h3>
        <div className="expense-bars">
          {topExpenseCategories.rows.map((item) => (
            <article key={item.categoryId} className="expense-bar-row">
              <header>
                <span>{item.name}</span>
                <strong>{formatBRL(item.total)}</strong>
              </header>
              <div className="expense-bar-track">
                <span className="expense-bar-fill" style={{ width: `${(item.total / topExpenseCategories.max) * 100}%` }} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel dashboard-panel">
        <h3>Resumo por grupo</h3>
        <div className="dashboard-grid">
          {boardRows.map((group) => (
            <article key={group.groupId} className="group-card">
              <h4>{group.groupName}</h4>
              <strong>{formatBRL(group.total)}</strong>
              <p>{group.rows.length} itens</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
