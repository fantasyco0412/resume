import JobsitePills from "@/components/dashboard/JobsitePills";
import ProviderBreakdown from "@/components/dashboard/ProviderBreakdown";
import type { CountEntry } from "@/lib/dashboard-stats";

interface TodayBidsPanelProps {
  total: number;
  dateLabel: string;
  providerEntries: CountEntry[];
  jobsiteEntries: CountEntry[];
}

export default function TodayBidsPanel({
  total,
  dateLabel,
  providerEntries,
  jobsiteEntries,
}: TodayBidsPanelProps) {
  const hasBreakdown = total > 0;

  return (
    <section className="today-panel">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-blue-300/25 to-cyan-300/15 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-8 left-1/3 h-24 w-24 rounded-full bg-cyan-200/20 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-wrap items-center gap-4 lg:gap-5">
        <div className="flex items-center gap-3.5">
          <div className="today-count-badge">
            <span className="font-display text-3xl font-bold tabular-nums leading-none tracking-tight">
              {total}
            </span>
            <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-blue-100/95">
              applications
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <p className="label-kicker text-blue-600/90">Today</p>
              {hasBreakdown && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Live
                </span>
              )}
            </div>
            <p className="mt-0.5 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">{dateLabel}</p>
            {!hasBreakdown && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">No applications yet today.</p>
            )}
          </div>
        </div>

        {hasBreakdown && (
          <>
            <div className="hidden h-12 w-px shrink-0 bg-gradient-to-b from-transparent via-slate-200 to-transparent sm:block" />

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span className="today-breakdown-label">AI provider</span>
                <ProviderBreakdown entries={providerEntries} compact hideZero minimal />
              </div>

              {jobsiteEntries.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span className="today-breakdown-label">Jobsite</span>
                  <JobsitePills entries={jobsiteEntries} minimal />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
