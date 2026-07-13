"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { useAuth } from "@/components/AuthProvider";
import CountBarChart from "@/components/dashboard/CountBarChart";
import {
  computeAdminOverviewStats,
  filterInterviewsByDateRange,
  formatAdminOverviewCost,
  type AdminOverviewData,
} from "@/lib/admin-overview-stats";
import { adminFetch, readAdminError } from "@/lib/admin-api";
import { formatCostUsd } from "@/lib/ai-usage";
import {
  filterRecordsByDateRange,
  formatDisplayDate,
  getMonthStartKey,
  getTodayKey,
  getWeekStartKey,
  shiftDateKey,
} from "@/lib/dashboard-stats";
import { userLevelBadgeClass, userLevelLabel } from "@/lib/user-level";

type RangePreset = "week" | "month" | "30d" | "period";

const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "30d", label: "Last 30d" },
  { id: "period", label: "Period" },
];

function getPresetRange(preset: RangePreset): { from: string; to: string } {
  const today = getTodayKey();

  switch (preset) {
    case "week":
      return { from: getWeekStartKey(), to: today };
    case "month":
      return { from: getMonthStartKey(), to: today };
    case "30d":
      return { from: shiftDateKey(today, -29), to: today };
    case "period":
      return { from: getMonthStartKey(), to: today };
  }
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white/80 p-5 shadow-sm dark:border-slate-600/60 dark:bg-slate-900/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
        {value}
      </p>
      {detail ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
      ) : null}
    </div>
  );
}

export default function AdminOverviewPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [activePreset, setActivePreset] = useState<RangePreset>("month");
  const [rangeStart, setRangeStart] = useState(getMonthStartKey);
  const [rangeEnd, setRangeEnd] = useState(getTodayKey);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);
    setForbidden(false);

    try {
      const response = await adminFetch("/api/admin/overview");

      if (response.status === 403) {
        setForbidden(true);
        setData(null);
        return;
      }

      if (!response.ok) {
        throw new Error(await readAdminError(response));
      }

      setData((await response.json()) as AdminOverviewData);
    } catch (loadError) {
      console.error("Failed to load admin overview:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load overview");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading && user?.id) {
      void loadData();
    }
  }, [authLoading, user?.id, loadData]);

  const stats = useMemo(() => {
    if (!data) return null;
    const filteredRecords = filterRecordsByDateRange(data.records, rangeStart, rangeEnd);
    const filteredInterviews = filterInterviewsByDateRange(
      data.interviews,
      rangeStart,
      rangeEnd
    );
    return computeAdminOverviewStats(filteredRecords, filteredInterviews, data.users);
  }, [data, rangeStart, rangeEnd]);

  useEffect(() => {
    setExpandedUserId(null);
  }, [rangeStart, rangeEnd]);

  const applyPreset = (preset: RangePreset) => {
    const { from, to } = getPresetRange(preset);
    setActivePreset(preset);
    setRangeStart(from);
    setRangeEnd(to);
  };

  const handleRangeStartChange = (value: string) => {
    setActivePreset("period");
    setRangeStart(value);
    if (rangeEnd && value > rangeEnd) setRangeEnd(value);
  };

  const handleRangeEndChange = (value: string) => {
    setActivePreset("period");
    setRangeEnd(value);
    if (rangeStart && value < rangeStart) setRangeStart(value);
  };

  const rangeLabel =
    rangeStart && rangeEnd
      ? `${formatDisplayDate(rangeStart)} – ${formatDisplayDate(rangeEnd)}`
      : "Select dates";

  if (authLoading || !user) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="glass-panel p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Access denied</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Admin overview is limited to accounts in{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">ADMIN_EMAILS</code>.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Could not load overview</h2>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        <button type="button" onClick={() => void loadData()} className="btn-soft mt-4 text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const costParts = [
    stats.aiCostBreakdown.extractUsd > 0
      ? `analyse ${formatCostUsd(stats.aiCostBreakdown.extractUsd)}`
      : null,
    stats.aiCostBreakdown.generationUsd > 0
      ? `resume ${formatCostUsd(stats.aiCostBreakdown.generationUsd)}`
      : null,
    stats.aiCostBreakdown.atsUsd > 0 ? `ATS ${formatCostUsd(stats.aiCostBreakdown.atsUsd)}` : null,
    stats.aiCostBreakdown.answersUsd > 0
      ? `answers ${formatCostUsd(stats.aiCostBreakdown.answersUsd)}`
      : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Overview</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            All users — total bids, AI spend, and breakdowns by user, model, and jobsite.
          </p>
        </div>
        <button type="button" onClick={() => void loadData()} className="btn-soft text-sm">
          Refresh
        </button>
      </div>

      <div className="glass-panel space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500 dark:text-slate-300">{rangeLabel}</p>
          <div className="flex flex-wrap gap-1">
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={
                  activePreset === preset.id ? "range-preset range-preset-active" : "range-preset"
                }
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor="admin-overview-from" className="filter-label">
              From
            </label>
            <input
              id="admin-overview-from"
              type="date"
              value={rangeStart}
              max={rangeEnd || undefined}
              onChange={(event) => handleRangeStartChange(event.target.value)}
              className="filter-control"
            />
          </div>
          <div>
            <label htmlFor="admin-overview-to" className="filter-label">
              To
            </label>
            <input
              id="admin-overview-to"
              type="date"
              value={rangeEnd}
              min={rangeStart || undefined}
              max={getTodayKey()}
              onChange={(event) => handleRangeEndChange(event.target.value)}
              className="filter-control"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total bids" value={String(stats.totalBids)} />
        <StatCard label="Total interviews" value={String(stats.totalInterviews)} />
        <StatCard
          label="Total AI cost"
          value={formatAdminOverviewCost(stats.totalAiCostUsd)}
          detail={costParts.length > 0 ? costParts.join(" · ") : undefined}
        />
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-slate-600/60">
          <h3 className="section-title text-base">Bids by user</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Click a row to see bids by model and jobsite for that user.
          </p>
        </div>
        {stats.bidsByUser.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-300">
            No bids or interviews in this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600/60">
              <thead className="bg-slate-50/90 dark:bg-slate-800/90">
                <tr>
                  <th className="w-10 px-2 py-3" aria-hidden />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Level
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Bids
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Interviews
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    AI cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-600/40 dark:bg-slate-900/20">
                {stats.bidsByUser.map((entry) => {
                  const isExpanded = expandedUserId === entry.userId;

                  return (
                    <Fragment key={entry.userId}>
                      <tr
                        className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                        onClick={() =>
                          setExpandedUserId(isExpanded ? null : entry.userId)
                        }
                      >
                        <td className="px-2 py-3 text-center">
                          <span
                            className={`inline-block text-slate-400 transition-transform dark:text-slate-500 ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                            aria-hidden
                          >
                            ▸
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Link
                            href={`/admin/users/${entry.userId}`}
                            onClick={(event) => event.stopPropagation()}
                            className="font-medium text-blue-700 hover:underline dark:text-blue-300"
                          >
                            {entry.label}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                          {entry.email || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${userLevelBadgeClass(entry.level)}`}
                          >
                            {userLevelLabel(entry.level)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-900 dark:text-slate-50">
                          {entry.bidCount}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-900 dark:text-slate-50">
                          {entry.interviewCount}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700 dark:text-slate-200">
                          {entry.aiCostUsd > 0 ? formatCostUsd(entry.aiCostUsd) : "—"}
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="bg-slate-50/60 dark:bg-slate-800/40">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid gap-4 lg:grid-cols-2">
                              <CountBarChart
                                title="Bids by model"
                                entries={entry.bidsByModel}
                                emptyMessage="No model data for this user."
                                maxItems={8}
                                compact
                              />
                              <CountBarChart
                                title="Bids by jobsite"
                                entries={entry.bidsByJobsite}
                                emptyMessage="No jobsite data for this user."
                                maxItems={8}
                                compact
                              />
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CountBarChart
          title="Bids by model"
          entries={stats.bidsByModel}
          emptyMessage="No model data in this period."
          maxItems={12}
        />
        <CountBarChart
          title="Bids by jobsite"
          entries={stats.bidsByJobsite}
          emptyMessage="No jobsite data in this period."
          maxItems={12}
        />
      </div>
    </div>
  );
}
