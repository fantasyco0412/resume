import type { InterviewCallTypePoint } from "@/lib/dashboard-stats";

interface InterviewCallTypeChartProps {
  points: InterviewCallTypePoint[];
  compact?: boolean;
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function formatBreakdown(point: InterviewCallTypePoint): string {
  const segments: string[] = [];

  if (point.progressing > 0) {
    segments.push(`progressing: ${point.progressing} · ${pct(point.progressing, point.total)}%`);
  }
  if (point.failed > 0) {
    segments.push(`failed: ${point.failed} · ${pct(point.failed, point.total)}%`);
  }
  if (point.succeed > 0) {
    segments.push(`succeed: ${point.succeed} · ${pct(point.succeed, point.total)}%`);
  }

  return segments.join(", ");
}

export default function InterviewCallTypeChart({
  points,
  compact = false,
}: InterviewCallTypeChartProps) {
  const maxTotal = points.reduce((max, point) => Math.max(max, point.total), 0);

  if (points.length === 0) {
    return (
      <div className={compact ? "chart-panel-compact" : "chart-panel"}>
        <p className={`mb-2 font-semibold text-slate-900 dark:text-slate-50 ${compact ? "text-sm" : "text-base"}`}>
          Interviews by step
        </p>
        <p className="rounded-lg border border-dashed border-slate-200 dark:border-slate-600/60 bg-slate-50/80 dark:bg-slate-800/90 px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-300">
          No interviews in this date range yet. Add call types when saving interview info.
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? "chart-panel-compact" : "chart-panel"}>
      <div className={compact ? "mb-2" : "mb-3"}>
        <p className={`font-semibold text-slate-900 dark:text-slate-50 ${compact ? "text-sm" : "text-base"}`}>
          Interviews by step
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-300">
          Rejected: earlier succeed, last failed. Open: all progressing. Offer/accepted: all
          succeed.
        </p>
      </div>

      <div className={`mb-2 flex flex-wrap gap-3 text-[10px] text-slate-500 dark:text-slate-300 ${compact ? "" : "text-xs"}`}>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Succeed
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Progressing
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-400" />
          Failed
        </span>
      </div>

      <div className={compact ? "space-y-2" : "space-y-3"}>
        {points.map((point) => {
          const width = maxTotal > 0 ? Math.max(6, (point.total / maxTotal) * 100) : 0;
          const breakdown = formatBreakdown(point);

          return (
            <div key={point.callType}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className={`min-w-[5.5rem] font-medium text-slate-800 dark:text-slate-100 ${compact ? "text-xs" : "text-sm"}`}>
                  {point.label}
                </span>
                <span className={`min-w-0 flex-1 text-right tabular-nums text-slate-700 dark:text-slate-200 ${compact ? "text-[11px]" : "text-xs"}`}>
                  <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-50">
                    total {point.total}
                  </span>
                  {breakdown && (
                    <span className="block text-slate-600 dark:text-slate-300 sm:inline sm:before:content-['_']">
                      ({breakdown})
                    </span>
                  )}
                </span>
              </div>

              <div className="chart-bar-track flex overflow-hidden">
                <div className="flex h-full" style={{ width: `${width}%` }}>
                  {point.succeed > 0 && (
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${(point.succeed / point.total) * 100}%` }}
                      title={`${point.succeed} succeed`}
                    />
                  )}
                  {point.progressing > 0 && (
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${(point.progressing / point.total) * 100}%` }}
                      title={`${point.progressing} progressing`}
                    />
                  )}
                  {point.failed > 0 && (
                    <div
                      className="h-full bg-red-400"
                      style={{ width: `${(point.failed / point.total) * 100}%` }}
                      title={`${point.failed} failed`}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
