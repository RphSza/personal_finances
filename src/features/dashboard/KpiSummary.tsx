import { BadgeDollarSign, CalendarRange, CircleDollarSign, Coins } from "lucide-react";
import type { PeriodTotals } from "../../types";

type KpiSummaryProps = {
  totals: PeriodTotals;
  formatBRL: (value: number) => string;
};

export function KpiSummary({ totals, formatBRL }: KpiSummaryProps) {
  return (
    <section className="kpis">
      <article className="kpi-card">
        <div className="kpi-icon income"><CircleDollarSign size={18} /></div>
        <div><span>Receitas</span><strong>{formatBRL(totals.income_total)}</strong></div>
      </article>
      <article className="kpi-card">
        <div className="kpi-icon expense"><BadgeDollarSign size={18} /></div>
        <div><span>Despesas</span><strong>{formatBRL(totals.expense_total)}</strong></div>
      </article>
      <article className="kpi-card">
        <div className="kpi-icon invest"><Coins size={18} /></div>
        <div><span>Investimentos</span><strong>{formatBRL(totals.investment_total)}</strong></div>
      </article>
      <article className="kpi-card">
        <div className="kpi-icon result"><CalendarRange size={18} /></div>
        <div>
          <span>Resultado</span>
          <strong className={totals.net_result >= 0 ? "positive" : "negative"}>{formatBRL(totals.net_result)}</strong>
        </div>
      </article>
    </section>
  );
}
