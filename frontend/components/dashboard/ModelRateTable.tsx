import type { ModelRateEntry } from "@/lib/dashboard-stats";

interface ModelRateTableProps {
  title?: string;
  subtitle?: string;
  entries: ModelRateEntry[];
  compact?: boolean;
  maxRows?: number;
}

export default function ModelRateTable({
  title = "Interview rate by model",
  subtitle,
  entries,
  compact = false,
  maxRows = 6,
}: ModelRateTableProps) {
  const visible = compact ? entries.slice(0, maxRows) : entries;

  return (
    <div className={compact ? "chart-panel-compact" : "chart-panel"}>
      <div className={compact ? "mb-2" : "mb-4"}>
        <h3 className={`section-title ${compact ? "text-sm" : "text-base"}`}>{title}</h3>
        {subtitle && !compact && <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{subtitle}</p>}
      </div>

      {entries.length === 0 ? (
        <p
          className={`rounded-lg border border-dashed border-slate-200 dark:border-slate-600/60 bg-slate-50/80 dark:bg-slate-800/90 text-center text-slate-500 dark:text-slate-300 ${
            compact ? "px-3 py-6 text-xs" : "px-4 py-10 text-sm"
          }`}
        >
          No model data for this period.
        </p>
      ) : (
        <div className={`overflow-x-auto ${compact ? "max-h-44 overflow-y-auto" : ""}`}>
          <table className="w-full min-w-[20rem] text-left text-sm">
            <thead className={compact ? "sticky top-0 bg-white dark:bg-slate-800" : ""}>
              <tr className="border-b border-slate-200 dark:border-slate-600/60 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                <th className="pb-1.5 pr-2">Model</th>
                <th className="pb-1.5 pr-2 text-right">Bids</th>
                <th className="pb-1.5 pr-2 text-right">Intv.</th>
                <th className="pb-1.5">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((entry) => (
                <tr key={entry.model}>
                  <td className={`pr-2 ${compact ? "py-1" : "py-2.5"}`}>
                    <span className="block max-w-[10rem] truncate text-xs font-medium text-slate-800 dark:text-slate-100" title={entry.model}>
                      {entry.model}
                    </span>
                  </td>
                  <td className={`pr-2 text-right text-xs tabular-nums ${compact ? "py-1" : "py-2.5"}`}>
                    {entry.bidCount}
                  </td>
                  <td className={`pr-2 text-right text-xs tabular-nums ${compact ? "py-1" : "py-2.5"}`}>
                    {entry.interviewBidCount}
                  </td>
                  <td className={compact ? "py-1" : "py-2.5"}>
                    <div className="flex min-w-[6rem] items-center gap-1.5">
                      <div className="chart-bar-track min-w-[3rem] flex-1">
                        <div
                          className="chart-bar-fill bg-gradient-to-r from-blue-500 to-cyan-500"
                          style={{
                            width: `${Math.max(entry.interviewRate > 0 ? 6 : 0, entry.interviewRate)}%`,
                          }}
                        />
                      </div>
                      <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums">
                        {entry.interviewRate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
