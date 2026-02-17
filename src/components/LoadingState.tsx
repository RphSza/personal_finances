type LoadingStateProps = {
  label?: string;
  compact?: boolean;
};

export function Spinner({ label = "Carregando...", compact = false }: LoadingStateProps) {
  return (
    <span className={compact ? "spinner spinner-compact" : "spinner"} role="status" aria-live="polite">
      <span className="spinner-ring" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function LoadingCard({ label = "Carregando dados..." }: { label?: string }) {
  return (
    <div className="loading-card" role="status" aria-live="polite">
      <span className="spinner-ring" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}
