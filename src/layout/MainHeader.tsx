type MonthStripItem = { value: string; label: string };

type MainHeaderProps = {
  showFinancialChrome: boolean;
  pageTitle: string;
  selectedMonth: string;
  monthStrip: MonthStripItem[];
  onSelectMonth: (month: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

export function MainHeader({
  showFinancialChrome,
  pageTitle,
  selectedMonth,
  monthStrip,
  onSelectMonth,
  onPrevMonth,
  onNextMonth
}: MainHeaderProps) {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">{showFinancialChrome ? "Controle financeiro" : "Administração do sistema"}</p>
          <h2>{pageTitle}</h2>
        </div>

        <div className="topbar-side">
          {showFinancialChrome ? (
            <div className="month-controller">
              <button onClick={onPrevMonth}>{"<"}</button>
              <input
                type="month"
                value={selectedMonth.slice(0, 7)}
                onChange={(e) => onSelectMonth(`${e.target.value}-01`)}
              />
              <button onClick={onNextMonth}>{">"}</button>
            </div>
          ) : null}
        </div>
      </header>

      {showFinancialChrome ? (
        <div className="month-strip">
          {monthStrip.map((month) => (
            <button
              key={month.value}
              className={month.value === selectedMonth ? "month-pill active" : "month-pill"}
              onClick={() => onSelectMonth(month.value)}
            >
              {month.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
