import type { CountEntry } from "@/lib/dashboard-stats";
import { providerBarHex, providerLabel, providerTextHex } from "@/lib/dashboard-stats";

interface CountBarChartProps {
  title: string;
  subtitle?: string;
  entries: CountEntry[];
  emptyMessage?: string;
  colorByProvider?: boolean;
  maxItems?: number;
  compact?: boolean;
}

export default function CountBarChart({
  title,
  subtitle,
  entries,
  emptyMessage = "No data for this period.",
  colorByProvider = false,
  maxItems = 8,
  compact = false,
}: CountBarChartProps) {
  const visible = entries.slice(0, maxItems);
  const maxCount = visible.reduce((max, entry) => Math.max(max, entry.count), 0);
  const hasAnyCount = maxCount > 0;

  return (
    <div className={compact ? "chart-panel-compact h-full" : "chart-panel h-full"}>
      <div className={compact ? "mb-2" : "mb-4"}>
        <h3 className={`section-title ${compact ? "text-sm" : "text-base"}`}>{title}</h3>
        {subtitle && !compact && <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{subtitle}</p>}
      </div>

      {visible.length === 0 ? (
        <p
          className={`rounded-lg border border-dashed border-slate-200 dark:border-slate-600/60 bg-slate-50/80 dark:bg-slate-800/90 text-center text-slate-500 dark:text-slate-300 ${
            compact ? "px-3 py-6 text-xs" : "px-4 py-10 text-sm"
          }`}
        >
          {emptyMessage}
        </p>
      ) : (
        <div className={compact ? "space-y-1.5" : "space-y-3"}>
          {visible.map((entry) => {
            const hasCount = entry.count > 0;
            const width =
              hasCount && maxCount > 0
                ? Math.max(6, (entry.count / maxCount) * 100)
                : 0;
            const label = colorByProvider ? providerLabel(entry.label) : entry.label;
            const barColor = colorByProvider ? providerBarHex(entry.label) : undefined;
            const labelColor = colorByProvider
              ? hasCount
                ? providerTextHex(entry.label)
                : "#94a3b8"
              : undefined;

            return (
              <div key={entry.label}>
                <div
                  className={`mb-0.5 flex items-center justify-between gap-2 ${
                    compact ? "text-xs" : "text-sm"
                  }`}
                >
                  <span
                    className={`min-w-0 truncate font-medium ${
                      colorByProvider ? "" : "text-slate-700 dark:text-slate-200"
                    }`}
                    style={labelColor ? { color: labelColor } : undefined}
                    title={label}
                  >
                    {label}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                    {entry.count}
                  </span>
                </div>
                <div className="chart-bar-track">
                  {hasCount && (
                    <div
                      className={`chart-bar-fill h-full rounded-full ${
                        colorByProvider ? "" : "bg-gradient-to-r from-blue-500 to-cyan-500"
                      }`}
                      style={{
                        width: `${width}%`,
                        ...(barColor ? { backgroundColor: barColor } : {}),
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasAnyCount && visible.length > 0 && (
        <p className="mt-2 text-center text-[11px] text-slate-400">No bids in range.</p>
      )}
    </div>
  );
}
