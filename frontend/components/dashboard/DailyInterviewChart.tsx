import { formatShortDate } from "@/lib/dashboard-stats";
import type { DailyInterviewPoint } from "@/lib/dashboard-stats";

interface DailyInterviewChartProps {
  points: DailyInterviewPoint[];
  compact?: boolean;
}

export default function DailyInterviewChart({
  points,
  compact = false,
}: DailyInterviewChartProps) {
  const chartHeight = compact ? 88 : 112;
  const labelStep = points.length > 14 ? Math.ceil(points.length / 7) : points.length > 7 ? 2 : 1;

  if (points.length === 0) {
    return (
      <div className={compact ? "chart-panel-compact" : "chart-panel"}>
        <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-50">Daily interview rate</p>
        <p className="rounded-lg border border-dashed border-slate-200 dark:border-slate-600/60 bg-slate-50/80 dark:bg-slate-800/90 px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-300">
          Select a start and end date to see daily interview rates.
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? "chart-panel-compact" : "chart-panel"}>
      <p className={`mb-2 font-semibold text-slate-900 dark:text-slate-50 ${compact ? "text-sm" : "text-base"}`}>
        Daily interview rate
      </p>

      <div className="overflow-x-auto pb-1">
        <div
          className="flex min-w-full items-end gap-1 sm:gap-1.5"
          style={{ minWidth: `${Math.max(points.length * 28, 280)}px`, height: chartHeight }}
        >
          {points.map((point, index) => {
            const height =
              point.bidCount > 0
                ? Math.max(8, (point.interviewRate / 100) * (chartHeight - 4))
                : 0;

            return (
              <div
                key={point.date}
                className="group flex min-w-[24px] flex-1 flex-col items-center justify-end"
                title={
                  point.bidCount > 0
                    ? `${formatShortDate(point.date)}: ${point.interviewRate}% (${point.interviewBidCount}/${point.bidCount})`
                    : `${formatShortDate(point.date)}: no bids`
                }
              >
                {point.bidCount > 0 && (
                  <span className="mb-0.5 text-[9px] font-semibold tabular-nums text-slate-600 dark:text-slate-300 opacity-0 transition group-hover:opacity-100">
                    {point.interviewRate}%
                  </span>
                )}
                <div
                  className={`w-full max-w-[28px] rounded-t-md ${
                    point.bidCount > 0
                      ? "bg-gradient-to-t from-violet-600 to-blue-400"
                      : "bg-slate-100"
                  }`}
                  style={{
                    height: point.bidCount > 0 ? height : 4,
                  }}
                />
                {(index % labelStep === 0 || index === points.length - 1) && (
                  <span className="mt-1 text-[9px] tabular-nums text-slate-400">
                    {formatShortDate(point.date)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
