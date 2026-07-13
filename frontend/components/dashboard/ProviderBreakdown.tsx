import type { CountEntry } from "@/lib/dashboard-stats";
import { AI_PROVIDER_ORDER, providerColor, providerLabel } from "@/lib/dashboard-stats";

interface ProviderBreakdownProps {
  entries: CountEntry[];
  compact?: boolean;
  hideZero?: boolean;
  minimal?: boolean;
}

function DonutChart({ entries, total }: { entries: CountEntry[]; total: number }) {
  if (total === 0) {
    return (
      <svg viewBox="0 0 120 120" className="mx-auto h-28 w-28" aria-hidden="true">
        <circle cx="60" cy="60" r="46" fill="none" stroke="#e2e8f0" strokeWidth="14" />
      </svg>
    );
  }

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-28 w-28" aria-hidden="true">
      <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="14" />
      {entries.map((entry) => {
        const fraction = entry.count / total;
        const dash = fraction * circumference;
        const circle = (
          <circle
            key={entry.label}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="14"
            strokeLinecap="round"
            className={providerColor(entry.label).ring}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 60 60)"
          />
        );
        offset += dash;
        return circle;
      })}
      <text
        x="60"
        y="56"
        textAnchor="middle"
        className="fill-slate-900 text-[18px] font-semibold"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {total}
      </text>
      <text x="60" y="72" textAnchor="middle" className="fill-slate-500 text-[9px]">
        bids
      </text>
    </svg>
  );
}

export default function ProviderBreakdown({
  entries,
  compact = false,
  hideZero = false,
  minimal = false,
}: ProviderBreakdownProps) {
  const byLabel = new Map(entries.map((entry) => [entry.label.toLowerCase(), entry.count]));
  const ordered = AI_PROVIDER_ORDER.map((provider) => ({
    label: provider,
    count: byLabel.get(provider) ?? 0,
  }));
  const extras = entries.filter(
    (entry) => !AI_PROVIDER_ORDER.includes(entry.label.toLowerCase() as (typeof AI_PROVIDER_ORDER)[number])
  );
  let allEntries = [...ordered, ...extras.map((e) => ({ label: e.label, count: e.count }))];
  if (hideZero) {
    allEntries = allEntries.filter((entry) => entry.count > 0);
  }
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {allEntries.map((entry) => {
          const colors = providerColor(entry.label);
          return (
            <div
              key={entry.label}
              className={`inline-flex items-center gap-1.5 border border-white/70 shadow-sm backdrop-blur-sm ${
                minimal ? "rounded-lg px-2 py-1" : "rounded-xl px-3 py-2"
              } ${colors.bg}`}
            >
              <span
                className={`font-semibold capitalize ${colors.text} ${
                  minimal ? "text-[11px]" : "text-xs"
                }`}
              >
                {providerLabel(entry.label)}
              </span>
              <span
                className={`font-display font-semibold tabular-nums text-slate-900 dark:text-slate-50 ${
                  minimal ? "text-sm" : "text-lg"
                }`}
              >
                {entry.count}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="chart-panel">
      <DonutChart entries={allEntries.filter((e) => e.count > 0)} total={total} />
      <div className="mt-4 space-y-2">
        {allEntries.map((entry) => {
          const colors = providerColor(entry.label);
          return (
            <div key={entry.label} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colors.bar}`} />
                <span className={`truncate capitalize ${colors.text}`}>
                  {providerLabel(entry.label)}
                </span>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {entry.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
