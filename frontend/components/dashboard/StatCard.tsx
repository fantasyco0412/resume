interface StatCardProps {
  label: string;
  value: number;
  hint?: string;
  accent?: boolean;
}

export default function StatCard({ label, value, hint, accent = false }: StatCardProps) {
  return (
    <div className={accent ? "stat-card-accent" : "stat-card"}>
      {accent && (
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 blur-2xl"
          aria-hidden="true"
        />
      )}
      <p className={`label-kicker ${accent ? "text-blue-100" : ""}`}>{label}</p>
      <p
        className={`mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl ${
          accent ? "text-white" : "text-slate-900 dark:text-slate-50"
        }`}
      >
        {value.toLocaleString()}
      </p>
      {hint && (
        <p className={`mt-1.5 text-sm ${accent ? "text-blue-100/90" : "text-slate-500 dark:text-slate-300"}`}>
          {hint}
        </p>
      )}
    </div>
  );
}
