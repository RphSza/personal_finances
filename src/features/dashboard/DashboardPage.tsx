import { format, parseISO } from "date-fns";
import type { TrendMode } from "../app/types";
import type { EntryRow } from "../../types";

type BoardGroup = {
  groupId: string;
  groupName: string;
  total: number;
  rows: EntryRow[];
};

type TrendRow = {
  month_start: string;
  receita_total: number;
  despesa_total: number;
  resultado_mes: number;
};

type MonthlyStatusRow = {
  monthStart: string;
  monthLabel: string;
  previsto: number;
  realizado: number;
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
          <h3>Série mensal {trendMode === "rxd" ? "(receitas x despesas)" : "(resultado do mês)"}</h3>
          <div className="inline-controls">
            <button className={trendMode === "rxd" ? "toggle active" : "toggle"} onClick={() => onChangeTrendMode("rxd")} title="Mostrar receitas e despesas mensais">R x D</button>
            <button className={trendMode === "resultado" ? "toggle active" : "toggle"} onClick={() => onChangeTrendMode("resultado")} title="Mostrar resultado mensal">Resultado</button>
            <button className={trendWindow === 6 ? "toggle active" : "toggle"} onClick={() => onChangeTrendWindow(6)} title="Últimos 6 meses">6M</button>
            <button className={trendWindow === 12 ? "toggle active" : "toggle"} onClick={() => onChangeTrendWindow(12)} title="Últimos 12 meses">12M</button>
            <button className={trendWindow === 24 ? "toggle active" : "toggle"} onClick={() => onChangeTrendWindow(24)} title="Últimos 24 meses">24M</button>
          </div>
        </div>

        <div className="trend-chart">
          {trendRows.map((row) => {
            const receitaHeight = (row.receita_total / trendMaxValue) * 100;
            const despesaHeight = (row.despesa_total / trendMaxValue) * 100;
            const resultHeight = (Math.abs(row.resultado_mes) / trendResultMaxAbs) * 100;
            return (
              <article key={row.month_start} className="trend-col">
                {trendMode === "rxd" ? (
                  <div className="trend-bars">
                    <span className="trend-bar receita" style={{ height: `${receitaHeight}%` }} />
                    <span className="trend-bar despesa" style={{ height: `${despesaHeight}%` }} />
                  </div>
                ) : (
                  <div className="trend-bars single">
                    <span
                      className={`trend-bar resultado ${row.resultado_mes >= 0 ? "pos" : "neg"}`}
                      style={{ height: `${resultHeight}%` }}
                    />
                  </div>
                )}
                <small>{format(parseISO(row.month_start), "MMM/yy")}</small>
                <small className={row.resultado_mes >= 0 ? "positive" : "negative"}>{formatBRL(row.resultado_mes)}</small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel dashboard-panel">
        <h3>Previsto x Realizado (resultado mensal)</h3>
        <div className="comparison-chart">
          {monthlyStatusTrend.rows.map((row) => {
            const previstoWidth = (Math.abs(row.previsto) / monthlyStatusTrend.maxAbs) * 100;
            const realizadoWidth = (Math.abs(row.realizado) / monthlyStatusTrend.maxAbs) * 100;
            return (
              <article key={row.monthStart} className="comparison-row">
                <small>{row.monthLabel}</small>
                <div className="comparison-bars">
                  <div className="comparison-line">
                    <span className="comparison-label">Previsto</span>
                    <span className={`comparison-fill previsto ${row.previsto >= 0 ? "pos" : "neg"}`} style={{ width: `${previstoWidth}%` }} />
                    <span className={row.previsto >= 0 ? "positive" : "negative"}>{formatBRL(row.previsto)}</span>
                  </div>
                  <div className="comparison-line">
                    <span className="comparison-label">Realizado</span>
                    <span className={`comparison-fill realizado ${row.realizado >= 0 ? "pos" : "neg"}`} style={{ width: `${realizadoWidth}%` }} />
                    <span className={row.realizado >= 0 ? "positive" : "negative"}>{formatBRL(row.realizado)}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel dashboard-panel">
        <h3>Top despesas por categoria no mês</h3>
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
