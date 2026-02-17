import { BadgeDollarSign, CalendarRange, CircleDollarSign, Coins } from "lucide-react";
import type { MonthlyTotals } from "../../types";

type KpiSummaryProps = {
  totals: MonthlyTotals;
  formatBRL: (value: number) => string;
};

export function KpiSummary({ totals, formatBRL }: KpiSummaryProps) {
  return (
    <section className="kpis">
      <article className="kpi-card">
        <div className="kpi-icon income"><CircleDollarSign size={18} /></div>
        <div><span>Receitas</span><strong>{formatBRL(totals.receita_total)}</strong></div>
      </article>
      <article className="kpi-card">
        <div className="kpi-icon expense"><BadgeDollarSign size={18} /></div>
        <div><span>Despesas</span><strong>{formatBRL(totals.despesa_total)}</strong></div>
      </article>
      <article className="kpi-card">
        <div className="kpi-icon invest"><Coins size={18} /></div>
        <div><span>Investimentos</span><strong>{formatBRL(totals.investimento_total)}</strong></div>
      </article>
      <article className="kpi-card">
        <div className="kpi-icon result"><CalendarRange size={18} /></div>
        <div>
          <span>Resultado</span>
          <strong className={totals.resultado_mes >= 0 ? "positive" : "negative"}>{formatBRL(totals.resultado_mes)}</strong>
        </div>
      </article>
    </section>
  );
}
