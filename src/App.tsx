import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  format,
  isAfter,
  lastDayOfMonth,
  parseISO,
  setDate
} from "date-fns";
import {
  BadgeDollarSign,
  CalendarDays,
  CircleDollarSign,
  Coins,
  Plus,
  RefreshCw,
  Trash2
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type {
  CategoryGroupRow,
  CategoryRow,
  EntryRow,
  EntryStatus,
  EntryType,
  MonthRow,
  MonthlyTotals
} from "./types";

type EntryForm = {
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

const initialEntryForm: EntryForm = {
  description: "",
  amount: "",
  type: "despesa",
  status: "previsto",
  categoryId: "",
  isRecurring: false,
  plannedDate: "",
  realizedAt: "",
  notes: ""
};

function monthStartIso(date: Date) {
  return format(date, "yyyy-MM-01");
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function App() {
  const [selectedMonth, setSelectedMonth] = useState(monthStartIso(new Date()));
  const [monthRow, setMonthRow] = useState<MonthRow | null>(null);
  const [groups, setGroups] = useState<CategoryGroupRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [totals, setTotals] = useState<MonthlyTotals | null>(null);
  const [entryForm, setEntryForm] = useState<EntryForm>(initialEntryForm);
  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [categoryGroupId, setCategoryGroupId] = useState("");
  const [categoryType, setCategoryType] = useState<EntryType>("despesa");
  const [categoryRecurring, setCategoryRecurring] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"todos" | EntryStatus>("todos");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const computedTotals = useMemo<MonthlyTotals>(() => {
    if (totals) return totals;
    const receitaTotal = entries
      .filter((e) => e.status !== "cancelado" && e.type === "receita")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const despesaTotal = entries
      .filter((e) => e.status !== "cancelado" && e.type === "despesa")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const despesaRecorrente = entries
      .filter((e) => e.status !== "cancelado" && e.type === "despesa" && e.is_recurring)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const investimentoTotal = entries
      .filter((e) => e.status !== "cancelado" && e.type === "investimento")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    return {
      month_id: monthRow?.id ?? "",
      month_start: selectedMonth,
      receita_total: receitaTotal,
      despesa_total: despesaTotal,
      despesa_recorrente: despesaRecorrente,
      investimento_total: investimentoTotal,
      resultado_mes: receitaTotal - despesaTotal - investimentoTotal
    };
  }, [entries, monthRow?.id, selectedMonth, totals]);

  const visibleEntries = useMemo(() => {
    if (statusFilter === "todos") return entries;
    return entries.filter((item) => item.status === statusFilter);
  }, [entries, statusFilter]);

  const groupById = useMemo(
    () =>
      groups.reduce<Record<string, CategoryGroupRow>>((acc, group) => {
        acc[group.id] = group;
        return acc;
      }, {}),
    [groups]
  );

  const ensureMonth = useCallback(async (monthIso: string) => {
    const { data: existing, error: existingError } = await supabase!
      .from("months")
      .select("id, month_start")
      .eq("month_start", monthIso)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return existing as MonthRow;

    const { data: inserted, error: insertError } = await supabase!
      .from("months")
      .insert({ month_start: monthIso })
      .select("id, month_start")
      .single();
    if (insertError) throw insertError;
    return inserted as MonthRow;
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setMessage("");
    try {
      const month = await ensureMonth(selectedMonth);
      setMonthRow(month);

      const [groupsRes, categoriesRes, entriesRes, totalsRes] = await Promise.all([
        supabase
          .from("category_groups")
          .select("id, code, name, sort_order")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("categories")
          .select("id, group_id, code, name, default_type, default_is_recurring")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("entries")
          .select(
            "id, month_id, category_id, description, amount, type, status, is_recurring, planned_date, realized_at, notes, created_at, categories(name, group_id)"
          )
          .eq("month_id", month.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("v_monthly_totals")
          .select(
            "month_id, month_start, receita_total, despesa_total, despesa_recorrente, investimento_total, resultado_mes"
          )
          .eq("month_start", selectedMonth)
          .maybeSingle()
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (entriesRes.error) throw entriesRes.error;
      if (totalsRes.error) throw totalsRes.error;

      const parsedEntries = (entriesRes.data ?? []).map((item) => ({
        ...item,
        amount: Number(item.amount),
        category: Array.isArray(item.categories) ? item.categories[0] : item.categories
      })) as EntryRow[];

      setGroups(groupsRes.data as CategoryGroupRow[]);
      setCategories(categoriesRes.data as CategoryRow[]);
      setEntries(parsedEntries);
      setTotals((totalsRes.data as MonthlyTotals | null) ?? null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha ao carregar dados.";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [ensureMonth, selectedMonth]);

  const handleCreateGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const name = groupName.trim();
    const code = (groupCode.trim() || slugify(name)).toUpperCase();
    if (!name) return;
    setMessage("");
    const { error } = await supabase
      .from("category_groups")
      .insert({ name, code, sort_order: groups.length + 1 });
    if (error) {
      setMessage(error.message);
      return;
    }
    setGroupName("");
    setGroupCode("");
    await loadData();
  };

  const handleCreateCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const name = categoryName.trim();
    const code = categoryCode.trim() || slugify(name);
    if (!name || !categoryGroupId) return;
    setMessage("");
    const { error } = await supabase.from("categories").insert({
      group_id: categoryGroupId,
      name,
      code,
      default_type: categoryType,
      default_is_recurring: categoryRecurring
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setCategoryName("");
    setCategoryCode("");
    setCategoryRecurring(false);
    await loadData();
  };

  const handleCreateEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !monthRow) return;
    const parsedAmount = Number(entryForm.amount.replace(",", "."));
    if (!entryForm.description.trim() || !entryForm.categoryId || Number.isNaN(parsedAmount)) return;

    setMessage("");
    const payload = {
      month_id: monthRow.id,
      category_id: entryForm.categoryId,
      description: entryForm.description.trim(),
      amount: parsedAmount,
      type: entryForm.type,
      status: entryForm.status,
      is_recurring: entryForm.isRecurring,
      planned_date: entryForm.plannedDate || null,
      realized_at:
        entryForm.status === "realizado"
          ? entryForm.realizedAt || format(new Date(), "yyyy-MM-dd")
          : null,
      notes: entryForm.notes.trim() || null
    };

    const { error } = await supabase.from("entries").insert(payload);
    if (error) {
      setMessage(error.message);
      return;
    }
    setEntryForm(initialEntryForm);
    await loadData();
  };

  const handleToggleStatus = async (entry: EntryRow) => {
    if (!supabase) return;
    const nextStatus: EntryStatus = entry.status === "realizado" ? "previsto" : "realizado";
    const { error } = await supabase
      .from("entries")
      .update({
        status: nextStatus,
        realized_at: nextStatus === "realizado" ? format(new Date(), "yyyy-MM-dd") : null
      })
      .eq("id", entry.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    await loadData();
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!supabase) return;
    const { error } = await supabase.from("entries").delete().eq("id", entryId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await loadData();
  };

  const handleProjectNextMonth = async () => {
    if (!supabase || !monthRow) return;
    setMessage("");
    const targetMonth = monthStartIso(addMonths(parseISO(selectedMonth), 1));
    try {
      const target = await ensureMonth(targetMonth);
      const { data: rules, error: ruleError } = await supabase
        .from("recurrence_rules")
        .select(
          "id, category_id, description, amount, type, day_of_month, start_month, end_month, active"
        )
        .eq("active", true);
      if (ruleError) throw ruleError;

      const targetDate = parseISO(targetMonth);
      const validRules =
        rules?.filter((rule) => {
          const start = parseISO(rule.start_month);
          if (isAfter(start, targetDate)) return false;
          if (!rule.end_month) return true;
          const end = parseISO(rule.end_month);
          return !isAfter(targetDate, end);
        }) ?? [];

      if (!validRules.length) {
        setMessage("Nenhuma recorrência ativa para projetar.");
        return;
      }

      const { data: existingEntries, error: existingError } = await supabase
        .from("entries")
        .select("category_id, description")
        .eq("month_id", target.id)
        .eq("status", "previsto");
      if (existingError) throw existingError;
      const existingKey = new Set(
        (existingEntries ?? []).map((entry) => `${entry.category_id}::${entry.description}`)
      );

      const rowsToInsert = validRules
        .filter((rule) => !existingKey.has(`${rule.category_id}::${rule.description}`))
        .map((rule) => {
          const monthDate = parseISO(targetMonth);
          const day = Math.min(rule.day_of_month, lastDayOfMonth(monthDate).getDate());
          return {
            month_id: target.id,
            category_id: rule.category_id,
            description: rule.description,
            amount: Number(rule.amount),
            type: rule.type as EntryType,
            status: "previsto" as EntryStatus,
            is_recurring: true,
            planned_date: format(setDate(monthDate, day), "yyyy-MM-dd")
          };
        });

      if (!rowsToInsert.length) {
        setMessage("Próximo mês já está projetado com essas recorrências.");
        return;
      }

      const { error: insertError } = await supabase.from("entries").insert(rowsToInsert);
      if (insertError) throw insertError;
      setMessage(
        `${rowsToInsert.length} lançamentos recorrentes projetados para ${format(parseISO(targetMonth), "MM/yyyy")}.`
      );
      await loadData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha ao projetar próximo mês.";
      setMessage(msg);
    }
  };

  const monthLabel = format(parseISO(selectedMonth), "MMMM yyyy");

  useEffect(() => {
    if (!supabase) return;
    void loadData();
  }, [loadData]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Controle Financeiro</p>
          <h1>Personal Finances Hub</h1>
        </div>
        <div className="month-picker">
          <label htmlFor="month">Competência</label>
          <input
            id="month"
            type="month"
            value={selectedMonth.slice(0, 7)}
            onChange={(event) => {
              setSelectedMonth(`${event.target.value}-01`);
            }}
          />
          <button type="button" className="ghost-button" onClick={loadData} disabled={loading}>
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>
      </header>

      {!isSupabaseConfigured ? (
        <section className="panel error-panel">
          <h2>Configure o Supabase</h2>
          <p>
            Crie o arquivo <code>.env.local</code> com <code>VITE_SUPABASE_URL</code> e{" "}
            <code>VITE_SUPABASE_ANON_KEY</code>. Depois execute <code>npm run dev</code>.
          </p>
        </section>
      ) : null}

      <section className="kpis">
        <article className="kpi-card">
          <div className="kpi-icon income">
            <CircleDollarSign size={20} />
          </div>
          <div>
            <span>Receitas</span>
            <strong>{formatBRL(computedTotals.receita_total)}</strong>
          </div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon expense">
            <BadgeDollarSign size={20} />
          </div>
          <div>
            <span>Despesas</span>
            <strong>{formatBRL(computedTotals.despesa_total)}</strong>
          </div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon invest">
            <Coins size={20} />
          </div>
          <div>
            <span>Investimentos</span>
            <strong>{formatBRL(computedTotals.investimento_total)}</strong>
          </div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon result">
            <CalendarDays size={20} />
          </div>
          <div>
            <span>Resultado ({monthLabel})</span>
            <strong
              className={computedTotals.resultado_mes >= 0 ? "value-positive" : "value-negative"}
            >
              {formatBRL(computedTotals.resultado_mes)}
            </strong>
          </div>
        </article>
      </section>

      {message ? <p className="feedback">{message}</p> : null}

      <main className="layout-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Lançamentos</h2>
            <div className="inline-controls">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "todos" | EntryStatus)}
              >
                <option value="todos">Todos</option>
                <option value="previsto">Previstos</option>
                <option value="realizado">Realizados</option>
                <option value="cancelado">Cancelados</option>
              </select>
              <button type="button" className="ghost-button" onClick={handleProjectNextMonth}>
                Projetar próximo mês
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Grupo</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Valor</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((entry) => {
                  const groupName = entry.category?.group_id
                    ? groupById[entry.category.group_id]?.name
                    : "-";
                  return (
                    <tr key={entry.id}>
                      <td>
                        <p>{entry.description}</p>
                        {entry.notes ? <small>{entry.notes}</small> : null}
                      </td>
                      <td>{groupName || "-"}</td>
                      <td>
                        <span className={`pill ${entry.type}`}>{entry.type}</span>
                      </td>
                      <td>
                        <span className={`pill status ${entry.status}`}>{entry.status}</span>
                      </td>
                      <td
                        className={
                          entry.type === "receita" ? "value-positive amount" : "value-negative amount"
                        }
                      >
                        {formatBRL(Number(entry.amount))}
                      </td>
                      <td className="actions">
                        {entry.status !== "cancelado" ? (
                          <button type="button" onClick={() => handleToggleStatus(entry)}>
                            {entry.status === "realizado" ? "Marcar previsto" : "Marcar realizado"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="danger"
                          onClick={() => handleDeleteEntry(entry.id)}
                          aria-label="Excluir lançamento"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!visibleEntries.length ? (
              <div className="empty-state">Sem lançamentos para esse filtro na competência atual.</div>
            ) : null}
          </div>
        </section>

        <aside className="side-panels">
          <section className="panel">
            <div className="panel-header">
              <h2>Novo Lançamento</h2>
              <Plus size={16} />
            </div>
            <form onSubmit={handleCreateEntry} className="form-grid">
              <input
                placeholder="Descrição"
                value={entryForm.description}
                onChange={(event) =>
                  setEntryForm((prev) => ({ ...prev, description: event.target.value }))
                }
                required
              />
              <div className="two-col">
                <input
                  placeholder="Valor"
                  inputMode="decimal"
                  value={entryForm.amount}
                  onChange={(event) =>
                    setEntryForm((prev) => ({ ...prev, amount: event.target.value }))
                  }
                  required
                />
                <select
                  value={entryForm.type}
                  onChange={(event) =>
                    setEntryForm((prev) => ({ ...prev, type: event.target.value as EntryType }))
                  }
                >
                  <option value="receita">receita</option>
                  <option value="despesa">despesa</option>
                  <option value="investimento">investimento</option>
                </select>
              </div>
              <select
                value={entryForm.categoryId}
                onChange={(event) =>
                  setEntryForm((prev) => ({ ...prev, categoryId: event.target.value }))
                }
                required
              >
                <option value="">Selecione a categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <div className="two-col">
                <select
                  value={entryForm.status}
                  onChange={(event) =>
                    setEntryForm((prev) => ({
                      ...prev,
                      status: event.target.value as EntryStatus
                    }))
                  }
                >
                  <option value="previsto">previsto</option>
                  <option value="realizado">realizado</option>
                  <option value="cancelado">cancelado</option>
                </select>
                <input
                  type="date"
                  value={entryForm.status === "realizado" ? entryForm.realizedAt : entryForm.plannedDate}
                  onChange={(event) =>
                    setEntryForm((prev) =>
                      prev.status === "realizado"
                        ? { ...prev, realizedAt: event.target.value }
                        : { ...prev, plannedDate: event.target.value }
                    )
                  }
                />
              </div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={entryForm.isRecurring}
                  onChange={(event) =>
                    setEntryForm((prev) => ({ ...prev, isRecurring: event.target.checked }))
                  }
                />
                Recorrente
              </label>
              <textarea
                placeholder="Notas (opcional)"
                value={entryForm.notes}
                onChange={(event) => setEntryForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
              <button type="submit" className="primary-button">
                Salvar lançamento
              </button>
            </form>
          </section>

          <section className="panel">
            <h2>Cadastro de Grupo</h2>
            <form onSubmit={handleCreateGroup} className="form-grid compact">
              <input
                placeholder="Nome do grupo (ex: CARTÃO)"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                required
              />
              <input
                placeholder="Código (opcional)"
                value={groupCode}
                onChange={(event) => setGroupCode(event.target.value)}
              />
              <button type="submit" className="ghost-button">
                Criar grupo
              </button>
            </form>
          </section>

          <section className="panel">
            <h2>Cadastro de Categoria</h2>
            <form onSubmit={handleCreateCategory} className="form-grid compact">
              <input
                placeholder="Nome da categoria"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                required
              />
              <input
                placeholder="Código (opcional)"
                value={categoryCode}
                onChange={(event) => setCategoryCode(event.target.value)}
              />
              <select
                value={categoryGroupId}
                onChange={(event) => setCategoryGroupId(event.target.value)}
                required
              >
                <option value="">Selecione o grupo</option>
                {groups.map((group) => (
                  <option value={group.id} key={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <div className="two-col">
                <select
                  value={categoryType}
                  onChange={(event) => setCategoryType(event.target.value as EntryType)}
                >
                  <option value="receita">receita</option>
                  <option value="despesa">despesa</option>
                  <option value="investimento">investimento</option>
                </select>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={categoryRecurring}
                    onChange={(event) => setCategoryRecurring(event.target.checked)}
                  />
                  Recorrente
                </label>
              </div>
              <button type="submit" className="ghost-button">
                Criar categoria
              </button>
            </form>
          </section>
        </aside>
      </main>
    </div>
  );
}

export default App;
