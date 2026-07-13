"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import CountBarChart from "@/components/dashboard/CountBarChart";
import DailyBidChart from "@/components/dashboard/DailyBidChart";
import DailyInterviewChart from "@/components/dashboard/DailyInterviewChart";
import InterviewCallTypeChart from "@/components/dashboard/InterviewCallTypeChart";
import JobsiteRateTable from "@/components/dashboard/JobsiteRateTable";
import ModelRateTable from "@/components/dashboard/ModelRateTable";
import SuccessRatePanel from "@/components/dashboard/SuccessRatePanel";
import TodayBidsPanel from "@/components/dashboard/TodayBidsPanel";
import {
  buildInterviewsByResume,
  computeBidSuccessStats,
  computeDailyBidCounts,
  computeDailyInterviewStats,
  computeInterviewCallTypeStats,
  computeJobsiteSuccessStats,
  computeModelSuccessStats,
  countByField,
  countByJobSite,
  countByProvider,
  filterRecordsByDateRange,
  formatDisplayDate,
  getLocalDateKey,
  getMonthStartKey,
  getTodayKey,
  isToday,
  shiftDateKey,
} from "@/lib/dashboard-stats";
import { listInterviews } from "@/lib/supabase/services/interviews";
import { listResumes } from "@/lib/supabase/services/resumes";
import type { InterviewRecord, ResumeRecord } from "@/lib/supabase/database.types";

type RangePreset = "7d" | "30d" | "month" | "all";

const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "month", label: "Month" },
  { id: "all", label: "All" },
];

function getPresetRange(preset: RangePreset, records: ResumeRecord[]): { from: string; to: string } {
  const today = getTodayKey();

  switch (preset) {
    case "7d":
      return { from: shiftDateKey(today, -6), to: today };
    case "30d":
      return { from: shiftDateKey(today, -29), to: today };
    case "month":
      return { from: getMonthStartKey(), to: today };
    case "all": {
      if (records.length === 0) return { from: "", to: today };
      const earliest = records.reduce((min, record) => {
        const key = getLocalDateKey(record.created_at);
        return key < min ? key : min;
      }, getLocalDateKey(records[0].created_at));
      return { from: earliest, to: today };
    }
  }
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<ResumeRecord[]>([]);
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeStart, setRangeStart] = useState(getMonthStartKey);
  const [rangeEnd, setRangeEnd] = useState(getTodayKey);
  const [activePreset, setActivePreset] = useState<RangePreset>("month");

  useEffect(() => {
    if (!authLoading && user?.id) {
      void loadRecords();
    }
  }, [authLoading, user?.id]);

  const loadRecords = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [resumeRows, interviewRows] = await Promise.all([
        listResumes(user.id),
        listInterviews(user.id),
      ]);
      setRecords(resumeRows);
      setInterviews(interviewRows);
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const interviewsByResume = useMemo(
    () => buildInterviewsByResume(interviews),
    [interviews]
  );

  const todayRecords = useMemo(
    () => records.filter((record) => isToday(record.created_at)),
    [records]
  );

  const todayTotal = todayRecords.length;
  const todayByProvider = useMemo(() => countByField(todayRecords, "ai_type"), [todayRecords]);
  const todayByJobsite = useMemo(() => countByJobSite(todayRecords), [todayRecords]);

  const rangeRecords = useMemo(
    () => filterRecordsByDateRange(records, rangeStart, rangeEnd),
    [records, rangeStart, rangeEnd]
  );

  const rangeTotal = rangeRecords.length;
  const rangeByProvider = useMemo(
    () => countByProvider(rangeRecords, { includeZero: true }),
    [rangeRecords]
  );
  const rangeByModel = useMemo(() => countByField(rangeRecords, "model"), [rangeRecords]);
  const rangeByJobsite = useMemo(() => countByJobSite(rangeRecords), [rangeRecords]);
  const rangeSuccess = useMemo(
    () => computeBidSuccessStats(rangeRecords, interviewsByResume),
    [rangeRecords, interviewsByResume]
  );
  const rangeModelRates = useMemo(
    () => computeModelSuccessStats(rangeRecords, interviewsByResume),
    [rangeRecords, interviewsByResume]
  );
  const rangeJobsiteRates = useMemo(
    () => computeJobsiteSuccessStats(rangeRecords, interviewsByResume),
    [rangeRecords, interviewsByResume]
  );
  const dailyBidPoints = useMemo(
    () => computeDailyBidCounts(rangeRecords, rangeStart, rangeEnd),
    [rangeRecords, rangeStart, rangeEnd]
  );
  const dailyInterviewPoints = useMemo(
    () => computeDailyInterviewStats(rangeRecords, interviewsByResume, rangeStart, rangeEnd),
    [rangeRecords, interviewsByResume, rangeStart, rangeEnd]
  );
  const interviewCallTypePoints = useMemo(
    () => computeInterviewCallTypeStats(rangeRecords, interviewsByResume),
    [rangeRecords, interviewsByResume]
  );

  const applyPreset = (preset: RangePreset) => {
    const { from, to } = getPresetRange(preset, records);
    setActivePreset(preset);
    setRangeStart(from);
    setRangeEnd(to);
  };

  const handleRangeStartChange = (value: string) => {
    setActivePreset("all");
    setRangeStart(value);
    if (rangeEnd && value > rangeEnd) setRangeEnd(value);
  };

  const handleRangeEndChange = (value: string) => {
    setActivePreset("all");
    setRangeEnd(value);
    if (rangeStart && value < rangeStart) setRangeStart(value);
  };

  const rangeLabel =
    rangeStart && rangeEnd
      ? `${formatDisplayDate(rangeStart)} – ${formatDisplayDate(rangeEnd)}`
      : "Select dates";

  if (authLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <main className="page-shell py-5 sm:py-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="glass-panel overflow-hidden">
          <div className="dashboard-header">
            <h2 className="dashboard-title">Statistics</h2>
            <p className="dashboard-subtitle">
              Application activity{user.email ? ` · ${user.email}` : ""}
            </p>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : (
              <>
                <TodayBidsPanel
                  total={todayTotal}
                  dateLabel={formatDisplayDate(getTodayKey())}
                  providerEntries={todayByProvider}
                  jobsiteEntries={todayByJobsite}
                />

                <section className="space-y-3 border-t border-slate-200 dark:border-slate-600/50 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="label-kicker">Analytics</p>
                      <p className="text-xs text-slate-500 dark:text-slate-300">{rangeLabel}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {RANGE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyPreset(preset.id)}
                          className={
                            activePreset === preset.id
                              ? "range-preset range-preset-active"
                              : "range-preset"
                          }
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <div>
                      <label htmlFor="dashboard-range-start" className="filter-label">
                        From
                      </label>
                      <input
                        id="dashboard-range-start"
                        type="date"
                        value={rangeStart}
                        max={rangeEnd || undefined}
                        onChange={(e) => handleRangeStartChange(e.target.value)}
                        className="filter-control"
                      />
                    </div>
                    <div>
                      <label htmlFor="dashboard-range-end" className="filter-label">
                        To
                      </label>
                      <input
                        id="dashboard-range-end"
                        type="date"
                        value={rangeEnd}
                        min={rangeStart || undefined}
                        max={getTodayKey()}
                        onChange={(e) => handleRangeEndChange(e.target.value)}
                        className="filter-control"
                      />
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-600/50 bg-white dark:bg-slate-800 px-3 py-2 text-center">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        Bids
                      </p>
                      <p className="font-display text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                        {rangeTotal}
                      </p>
                    </div>
                  </div>

                  <div className="analytics-group">
                    <div className="analytics-group-header">
                      <h3 className="analytics-group-title">Interview rate</h3>
                      <p className="analytics-group-subtitle">
                        {rangeSuccess.interviewBidCount} of {rangeSuccess.bidCount} reached interview stage
                        {rangeStart && rangeEnd ? ` · ${rangeLabel}` : ""}
                      </p>
                    </div>
                    <DailyInterviewChart compact points={dailyInterviewPoints} />
                    <InterviewCallTypeChart compact points={interviewCallTypePoints} />
                    <div className="grid gap-3 lg:grid-cols-3">
                      <SuccessRatePanel compact title="Overall" stats={rangeSuccess} />
                      <ModelRateTable compact title="By model" entries={rangeModelRates} />
                      <JobsiteRateTable compact title="By job board" entries={rangeJobsiteRates} />
                    </div>
                  </div>

                  <div className="analytics-group">
                    <div className="analytics-group-header">
                      <h3 className="analytics-group-title">Applications submitted</h3>
                      <p className="analytics-group-subtitle">
                        {rangeTotal} applications in range
                        {rangeStart && rangeEnd ? ` · ${rangeLabel}` : ""}
                      </p>
                    </div>
                    <DailyBidChart compact points={dailyBidPoints} />
                    <div className="grid gap-3 md:grid-cols-3">
                      <CountBarChart
                        compact
                        title="By jobsite"
                        entries={rangeByJobsite}
                        emptyMessage="No applications in this date range."
                        maxItems={8}
                      />
                      <CountBarChart
                        compact
                        title="By provider"
                        entries={rangeByProvider}
                        colorByProvider
                        emptyMessage="No applications in this date range."
                        maxItems={5}
                      />
                      <CountBarChart
                        compact
                        title="By model"
                        entries={rangeByModel}
                        emptyMessage="No model data in range."
                        maxItems={5}
                      />
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
