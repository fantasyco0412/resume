import type { BidSuccessStats } from "@/lib/dashboard-stats";
import { useId } from "react";

interface SuccessRatePanelProps {
  title?: string;
  subtitle?: string;
  stats: BidSuccessStats;
  compact?: boolean;
}

function RateRing({ rate, label, compact }: { rate: number; label: string; compact?: boolean }) {
  const gradientId = useId();
  const radius = compact ? 44 : 52;
  const size = compact ? "h-24 w-24" : "h-32 w-32";
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, rate));
  const dash = (clamped / 100) * circumference;
  const viewBox = compact ? "0 0 100 100" : "0 0 128 128";
  const center = compact ? 50 : 64;

  return (
    <div className={`relative mx-auto shrink-0 ${size}`}>
      <svg viewBox={viewBox} className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          className="stroke-slate-200 dark:stroke-slate-600"
          strokeWidth={compact ? 10 : 12}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={compact ? 10 : 12}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`font-display font-semibold tabular-nums text-slate-900 dark:text-slate-50 ${
            compact ? "text-xl" : "text-2xl"
          }`}
        >
          {rate}%
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">
          {label}
        </span>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  accent,
  compact,
}: {
  label: string;
  value: number;
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border ${
        accent
          ? "border-blue-200 bg-blue-50/80 dark:border-blue-900/35 dark:bg-blue-950/25"
          : "border-slate-200 bg-slate-50/70 dark:border-slate-600/50 dark:bg-slate-800/80"
      } ${compact ? "px-2 py-1.5" : "px-3 py-2.5"}`}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">{label}</p>
      <p
        className={`font-display font-semibold tabular-nums ${
          compact ? "text-base" : "mt-0.5 text-xl"
        } ${accent ? "text-blue-700" : "text-slate-900 dark:text-slate-50"}`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export default function SuccessRatePanel({
  title = "Interview rate",
  subtitle,
  stats,
  compact = false,
}: SuccessRatePanelProps) {
  return (
    <div className={compact ? "chart-panel-compact h-full" : "chart-panel h-full"}>
      <div className={compact ? "mb-2" : "mb-4"}>
        <h3 className={`section-title ${compact ? "text-sm" : "text-base"}`}>{title}</h3>
        {subtitle && (
          <p className={`text-slate-500 dark:text-slate-300 ${compact ? "mt-0.5 text-[11px]" : "mt-1 text-sm"}`}>
            {subtitle}
          </p>
        )}
      </div>

      {stats.bidCount === 0 ? (
        <p
          className={`rounded-lg border border-dashed border-slate-200 dark:border-slate-600/60 bg-slate-50/80 dark:bg-slate-800/90 text-center text-slate-500 dark:text-slate-300 ${
            compact ? "px-3 py-6 text-xs" : "px-4 py-10 text-sm"
          }`}
        >
          No bids to measure yet.
        </p>
      ) : (
        <div className={`flex items-center ${compact ? "gap-3" : "flex-col gap-5 sm:flex-row sm:items-center"}`}>
          <RateRing rate={stats.interviewRate} label="interview" compact={compact} />
          <div className={`w-full flex-1 ${compact ? "space-y-1.5" : "space-y-3"}`}>
            <div className="grid grid-cols-3 gap-1.5">
              <MetricTile label="Bids" value={stats.bidCount} compact={compact} />
              <MetricTile label="Interview" value={stats.interviewBidCount} accent compact={compact} />
              <MetricTile
                label="Applied"
                value={stats.bidCount - stats.interviewBidCount}
                compact={compact}
              />
            </div>
            {!compact && (
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-300">
                {stats.interviewBidCount} of {stats.bidCount} bids reached interview stage.
                Interview stage means an interview info was added or status moved past Applied.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
