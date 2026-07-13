"use client";

import type { BidStatus, InterviewCallType } from "@/lib/supabase/database.types";
import { BID_STATUSES } from "@/lib/supabase/database.types";
import {
  INTERVIEW_STAGE_LABELS,
  type InterviewHistoryRow,
  formatInterviewHistoryDate,
  statusBadgeClass,
} from "@/lib/interview-history";

function PipelineStages({ pipeline }: { pipeline: InterviewCallType[] }) {
  if (pipeline.length === 0) {
    return <span className="text-slate-400 dark:text-slate-500">—</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-sm">
      {pipeline.map((stage, index) => (
        <span key={`${stage}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? (
            <span className="select-none text-slate-300 dark:text-slate-600" aria-hidden>
              →
            </span>
          ) : null}
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
            {INTERVIEW_STAGE_LABELS[stage]}
          </span>
        </span>
      ))}
    </span>
  );
}

interface InterviewHistoryTableProps {
  rows: InterviewHistoryRow[];
  onOpenBid?: (resumeId: string) => void;
}

export default function InterviewHistoryTable({
  rows,
  onOpenBid,
}: InterviewHistoryTableProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 dark:border-slate-600/60 bg-slate-50 dark:bg-slate-800/90 px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-300">
        No interview records yet. Add interview info from a bid in Bid history.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-600/60">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600/60">
        <thead className="bg-slate-50/90 dark:bg-slate-800/90">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Company
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Caller
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Interview stages
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-600/40 dark:bg-slate-900/20">
          {rows.map((row) => (
            <tr
              key={`${row.resumeId ?? "orphan"}-${row.latestDate}-${row.company}`}
              className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
            >
              <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                {formatInterviewHistoryDate(row.latestDate)}
              </td>
              <td className="px-4 py-3">
                {row.resumeId && onOpenBid ? (
                  <button
                    type="button"
                    onClick={() => onOpenBid(row.resumeId!)}
                    className="text-left text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
                  >
                    {row.company}
                    {row.jobTitle ? (
                      <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">
                        {row.jobTitle}
                      </span>
                    ) : null}
                  </button>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {row.company}
                    </p>
                    {row.jobTitle ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{row.jobTitle}</p>
                    ) : null}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                {row.caller || "—"}
              </td>
              <td className="px-4 py-3">
                <PipelineStages pipeline={row.pipeline} />
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(row.status)}`}
                >
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InterviewHistoryFilters({
  searchQuery,
  onSearchChange,
  filterStatus,
  onStatusChange,
  filterCaller,
  onCallerChange,
  filterDateFrom,
  onDateFromChange,
  filterDateTo,
  onDateToChange,
}: {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterStatus: BidStatus | "";
  onStatusChange: (value: BidStatus | "") => void;
  filterCaller: string;
  onCallerChange: (value: string) => void;
  filterDateFrom: string;
  onDateFromChange: (value: string) => void;
  filterDateTo: string;
  onDateToChange: (value: string) => void;
}) {
  return (
    <div className="card-soft mb-3 space-y-2 p-3">
      <div>
        <label htmlFor="interview-history-search" className="filter-label">
          Search
        </label>
        <input
          id="interview-history-search"
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Company, role, caller, stage…"
          className="filter-control"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="min-w-0">
          <label htmlFor="interview-filter-status" className="filter-label">
            Status
          </label>
          <select
            id="interview-filter-status"
            value={filterStatus}
            onChange={(e) => onStatusChange(e.target.value as BidStatus | "")}
            className="filter-select"
          >
            <option value="">All statuses</option>
            {BID_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="interview-filter-caller" className="filter-label">
            Caller
          </label>
          <input
            id="interview-filter-caller"
            type="text"
            value={filterCaller}
            onChange={(e) => onCallerChange(e.target.value)}
            placeholder="Filter by caller"
            className="filter-control"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="interview-filter-from" className="filter-label">
            From
          </label>
          <input
            id="interview-filter-from"
            type="date"
            value={filterDateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="filter-control"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="interview-filter-to" className="filter-label">
            To
          </label>
          <input
            id="interview-filter-to"
            type="date"
            value={filterDateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="filter-control"
          />
        </div>
      </div>
    </div>
  );
}
