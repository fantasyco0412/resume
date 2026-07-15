"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  BID_STATUSES,
  DEFAULT_BID_STATUS,
  INTERVIEW_CALL_TYPES,
  type BidStatus,
  type InterviewCallType,
  type InterviewRecord,
  type ResumeRecord,
} from "@/lib/supabase/database.types";
import {
  listResumes,
  updateResumeBidStatus,
  getResumeArtifacts,
} from "@/lib/supabase/services/resumes";
import {
  listInterviews,
  createInterview,
  updateInterview,
  deleteInterview,
} from "@/lib/supabase/services/interviews";
import { JOBSITES } from "@/lib/jobsites";
import { supabase } from "@/lib/supabase";
import { saveResumePdfToDownloadsFolder, saveTextToDownloadsFolder, SaveCancelledError } from "@/lib/pdf-download";
import type { UpdatedResume } from "@/lib/types/resume";
import { ToastContainer, useToast } from "@/components/Toast";
import FormattedJobDescription from "@/components/FormattedJobDescription";
import {
  jobCompanyTextClass,
  jobContextSepClass,
  jobIndustryTextClass,
  jobLocationTextClass,
  jobPostedDateTextClass,
} from "@/lib/job-display-styles";
import { prepareJobDescriptionForDisplay } from "@/lib/normalize-job-description";
import { formatJobDescriptionForCopy } from "@/lib/format-job-description-for-copy";
import { writeClipboardText } from "@/lib/clipboard";
import { formatAiCostBreakdown } from "@/lib/ai-usage";
import { atsScoreTextClass, formatAtsScoreLabel } from "@/lib/check-ats-client";
import { formatJobWorkTypeLabel } from "@/lib/prompts/job-page-extract";
import { jobWorkTypeBadgeClass } from "@/lib/job-work-type";
import { parseStoredJobTypes } from "@/lib/resume-record-metadata";
import { buildInterviewHistoryRows } from "@/lib/interview-history";
import InterviewHistoryTable, {
  InterviewHistoryFilters,
} from "@/components/history/InterviewHistoryTable";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
type HistoryTab = "bids" | "interviews";
const DEFAULT_PAGE_SIZE = 10;

import { formatProviderLabel, getSortedProviders, FALLBACK_OPENROUTER_MODELS } from "@/lib/openrouter-shared";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatListDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatInterviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function renderJobRecordHeadline(record: ResumeRecord) {
  const title = record.job_title || "Untitled role";

  return (
    <>
      <span>{title}</span>
      {record.job_company ? (
        <>
          <span className={jobContextSepClass}> · </span>
          <span className={jobCompanyTextClass}>{record.job_company}</span>
        </>
      ) : null}
      {record.industry ? (
        <>
          <span className={jobContextSepClass}> · </span>
          <span className={jobIndustryTextClass}>{record.industry}</span>
        </>
      ) : null}
      {record.job_location ? (
        <>
          <span className={jobContextSepClass}> · </span>
          <span className={jobLocationTextClass}>{record.job_location}</span>
        </>
      ) : null}
      {record.posted_date ? (
        <>
          <span className={jobContextSepClass}> · </span>
          <span className={jobPostedDateTextClass}>Posted {record.posted_date}</span>
        </>
      ) : null}
    </>
  );
}

function resolveBidStatus(status: string | null | undefined): BidStatus {
  if (!status || status === "draft") return DEFAULT_BID_STATUS;
  return BID_STATUSES.includes(status as BidStatus) ? (status as BidStatus) : DEFAULT_BID_STATUS;
}

function jobsiteLabel(id: string | null): string {
  if (!id) return "—";
  return JOBSITES.find((site) => site.id === id)?.label ?? id;
}

function formatRecordAiCost(record: ResumeRecord): string {
  return formatAiCostBreakdown({
    extractCostUsd: record.extract_cost_usd ?? undefined,
    generationCostUsd: record.generation_cost_usd ?? undefined,
    atsCostUsd: record.ats_cost_usd ?? undefined,
    answersCostUsd: record.answers_cost_usd ?? undefined,
  });
}

function recordJobTypes(record: ResumeRecord) {
  return parseStoredJobTypes(record.job_types);
}

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function isDateInRange(iso: string, from: string, to: string): boolean {
  const d = toDateOnly(iso);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function matchesSearch(
  record: ResumeRecord,
  recordInterviews: InterviewRecord[],
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    record.job_title,
    record.job_company,
    record.job_location,
    record.industry,
    record.security_clearance,
    record.job_link,
    record.ai_type,
    record.model,
    record.salary,
    record.posted_date,
    jobsiteLabel(record.job_site),
    record.bid_status,
    formatListDate(record.created_at),
    toDateOnly(record.created_at),
    formatRecordAiCost(record),
    ...recordJobTypes(record).map((type) => formatJobWorkTypeLabel(type)),
    ...recordInterviews.flatMap((row) => [
      row.caller,
      row.interviewer,
      formatInterviewDate(row.interview_date),
      toDateOnly(row.interview_date),
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

function matchesDateFilter(
  record: ResumeRecord,
  recordInterviews: InterviewRecord[],
  from: string,
  to: string
): boolean {
  if (!from && !to) return true;
  if (isDateInRange(record.created_at, from, to)) return true;
  return recordInterviews.some((row) => isDateInRange(row.interview_date, from, to));
}

function matchesTextOnInterviews(
  recordInterviews: InterviewRecord[],
  query: string,
  field: "caller" | "interviewer"
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return recordInterviews.some((row) => row[field]?.toLowerCase().includes(q));
}

function matchesModelFilter(record: ResumeRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return record.model?.toLowerCase().includes(q) ?? false;
}

function emptyInterviewForm() {
  return {
    interview_date: new Date().toISOString().slice(0, 10),
    caller: "",
    interviewer: "",
    call_type: "" as InterviewCallType | "",
    video_name: "",
    note: "",
  };
}

type InterviewFormState = ReturnType<typeof emptyInterviewForm>;

function interviewToForm(row: InterviewRecord): InterviewFormState {
  return {
    interview_date: toDateOnly(row.interview_date),
    caller: row.caller ?? "",
    interviewer: row.interviewer ?? "",
    call_type: row.call_type ?? "",
    video_name: row.video_name ?? "",
    note: row.note ?? "",
  };
}

type InterviewFormMode =
  | { kind: "add"; resumeId: string }
  | { kind: "edit"; resumeId: string; interviewId: string };

function InterviewFormFields({
  form,
  onChange,
}: {
  form: InterviewFormState;
  onChange: (patch: Partial<InterviewFormState>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Date</label>
        <input
          type="date"
          value={form.interview_date}
          onChange={(e) => onChange({ interview_date: e.target.value })}
          className="input-shell py-2"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Call type</label>
        <select
          value={form.call_type}
          onChange={(e) =>
            onChange({ call_type: e.target.value as InterviewCallType | "" })
          }
          className="input-shell py-2"
        >
          <option value="">Select type</option>
          {INTERVIEW_CALL_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Caller</label>
        <input
          type="text"
          value={form.caller}
          onChange={(e) => onChange({ caller: e.target.value })}
          className="input-shell py-2"
          placeholder="Who placed or took the call"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Interviewer</label>
        <input
          type="text"
          value={form.interviewer}
          onChange={(e) => onChange({ interviewer: e.target.value })}
          className="input-shell py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          Video / recording name
        </label>
        <input
          type="text"
          value={form.video_name}
          onChange={(e) => onChange({ video_name: e.target.value })}
          className="input-shell py-2"
          placeholder="e.g. zoom-recording-2026-06-10.mp4"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Notes</label>
        <textarea
          value={form.note}
          onChange={(e) => onChange({ note: e.target.value })}
          rows={3}
          className="input-shell py-2"
        />
      </div>
    </div>
  );
}

function IconButton({
  title,
  onClick,
  disabled = false,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#007fff]/30 bg-white text-[#007fff] shadow-sm transition hover:border-[#007fff]/50 hover:bg-[#007fff]/10 hover:text-[#0066cc] disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-400/40 dark:bg-slate-800 dark:text-blue-400 dark:hover:border-blue-400/60 dark:hover:bg-blue-500/15 dark:hover:text-blue-300"
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function CopyIcon({ className = "h-3.5 w-3.5 text-[#007fff] dark:text-blue-400" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function CheckIcon({ className = "h-3.5 w-3.5 text-[#007fff] dark:text-blue-400" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function DownloadIcon({ className = "h-3.5 w-3.5 text-[#007fff] dark:text-blue-400" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<ResumeRecord[]>([]);
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedJd, setExpandedJd] = useState("");
  const [expandedResume, setExpandedResume] = useState("");
  const [expandedResumeData, setExpandedResumeData] = useState<UpdatedResume | null>(null);
  const [jdCopied, setJdCopied] = useState(false);
  const [jdDownloadingId, setJdDownloadingId] = useState<string | null>(null);
  const [pdfDownloadingId, setPdfDownloadingId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [interviewFormMode, setInterviewFormMode] = useState<InterviewFormMode | null>(null);
  const [interviewForm, setInterviewForm] = useState(emptyInterviewForm);
  const [savingInterview, setSavingInterview] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBidStatus, setFilterBidStatus] = useState<BidStatus | "">("");
  const [filterJobSite, setFilterJobSite] = useState("");
  const [filterAiProvider, setFilterAiProvider] = useState("");
  const [filterAiModel, setFilterAiModel] = useState("");
  const [filterHasInterviews, setFilterHasInterviews] = useState<"" | "yes" | "no">("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterCaller, setFilterCaller] = useState("");
  const [filterInterviewer, setFilterInterviewer] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [historyTab, setHistoryTab] = useState<HistoryTab>("bids");
  const [interviewSearchQuery, setInterviewSearchQuery] = useState("");
  const [interviewFilterStatus, setInterviewFilterStatus] = useState<BidStatus | "">("");
  const [interviewFilterCaller, setInterviewFilterCaller] = useState("");
  const [interviewFilterDateFrom, setInterviewFilterDateFrom] = useState("");
  const [interviewFilterDateTo, setInterviewFilterDateTo] = useState("");
  const [interviewPage, setInterviewPage] = useState(1);
  const [interviewPageSize, setInterviewPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const { toasts, showToast, dismissToast } = useToast();

  const interviewsByResume = useMemo(() => {
    const map = new Map<string, InterviewRecord[]>();
    for (const row of interviews) {
      if (!row.resume_id) continue;
      const list = map.get(row.resume_id) ?? [];
      list.push(row);
      map.set(row.resume_id, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(b.interview_date).getTime() -
          new Date(a.interview_date).getTime()
      );
    }
    return map;
  }, [interviews]);

  const aiProviderOptions = useMemo(() => {
    const providers = new Set(getSortedProviders(FALLBACK_OPENROUTER_MODELS));
    for (const record of records) {
      const aiType = record.ai_type?.trim().toLowerCase();
      if (aiType) providers.add(aiType);
    }
    return Array.from(providers).sort((a, b) =>
      formatProviderLabel(a).localeCompare(formatProviderLabel(b))
    );
  }, [records]);

  const modelOptions = useMemo(() => {
    const models = new Set<string>();
    for (const record of records) {
      const model = record.model?.trim();
      if (model) models.add(model);
    }
    return Array.from(models).sort((a, b) => a.localeCompare(b));
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const recordInterviews = interviewsByResume.get(record.id) ?? [];

      if (!matchesSearch(record, recordInterviews, searchQuery)) return false;

      if (filterBidStatus && resolveBidStatus(record.bid_status) !== filterBidStatus) {
        return false;
      }

      if (filterJobSite && record.job_site !== filterJobSite) return false;

      if (filterAiProvider && record.ai_type !== filterAiProvider) return false;

      if (!matchesModelFilter(record, filterAiModel)) return false;

      const interviewCount = recordInterviews.length;
      if (filterHasInterviews === "yes" && interviewCount === 0) return false;
      if (filterHasInterviews === "no" && interviewCount > 0) return false;

      if (!matchesDateFilter(record, recordInterviews, filterDateFrom, filterDateTo)) {
        return false;
      }

      if (!matchesTextOnInterviews(recordInterviews, filterCaller, "caller")) return false;
      if (!matchesTextOnInterviews(recordInterviews, filterInterviewer, "interviewer")) {
        return false;
      }

      return true;
    });
  }, [
    records,
    searchQuery,
    filterBidStatus,
    filterJobSite,
    filterAiProvider,
    filterAiModel,
    filterHasInterviews,
    filterDateFrom,
    filterDateTo,
    filterCaller,
    filterInterviewer,
    interviewsByResume,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));

  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page, pageSize]);

  const interviewHistoryRows = useMemo(
    () => buildInterviewHistoryRows(interviews, records),
    [interviews, records]
  );

  const filteredInterviewRows = useMemo(() => {
    return interviewHistoryRows.filter((row) => {
      if (interviewFilterStatus && row.status !== interviewFilterStatus) return false;

      if (
        interviewFilterCaller.trim() &&
        !row.caller.toLowerCase().includes(interviewFilterCaller.trim().toLowerCase())
      ) {
        return false;
      }

      if (
        interviewFilterDateFrom &&
        toDateOnly(row.latestDate) < interviewFilterDateFrom
      ) {
        return false;
      }

      if (interviewFilterDateTo && toDateOnly(row.latestDate) > interviewFilterDateTo) {
        return false;
      }

      const q = interviewSearchQuery.trim().toLowerCase();
      if (!q) return true;

      const haystack = [
        row.company,
        row.jobTitle,
        row.caller,
        row.pipelineLabel,
        row.status,
        formatInterviewDate(row.latestDate),
        toDateOnly(row.latestDate),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [
    interviewHistoryRows,
    interviewSearchQuery,
    interviewFilterStatus,
    interviewFilterCaller,
    interviewFilterDateFrom,
    interviewFilterDateTo,
  ]);

  const interviewTotalPages = Math.max(
    1,
    Math.ceil(filteredInterviewRows.length / interviewPageSize)
  );

  const paginatedInterviewRows = useMemo(() => {
    const start = (interviewPage - 1) * interviewPageSize;
    return filteredInterviewRows.slice(start, start + interviewPageSize);
  }, [filteredInterviewRows, interviewPage, interviewPageSize]);

  const hasInterviewActiveFilters =
    interviewSearchQuery.trim().length > 0 ||
    interviewFilterStatus !== "" ||
    interviewFilterCaller.trim().length > 0 ||
    interviewFilterDateFrom !== "" ||
    interviewFilterDateTo !== "";

  const clearInterviewFilters = () => {
    setInterviewSearchQuery("");
    setInterviewFilterStatus("");
    setInterviewFilterCaller("");
    setInterviewFilterDateFrom("");
    setInterviewFilterDateTo("");
    setInterviewPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    filterBidStatus !== "" ||
    filterJobSite !== "" ||
    filterAiProvider !== "" ||
    filterAiModel.trim().length > 0 ||
    filterHasInterviews !== "" ||
    filterDateFrom !== "" ||
    filterDateTo !== "" ||
    filterCaller.trim().length > 0 ||
    filterInterviewer.trim().length > 0;

  const clearFilters = () => {
    setSearchQuery("");
    setFilterBidStatus("");
    setFilterJobSite("");
    setFilterAiProvider("");
    setFilterAiModel("");
    setFilterHasInterviews("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterCaller("");
    setFilterInterviewer("");
    setPage(1);
  };

  useEffect(() => {
    setPage(1);
  }, [
    searchQuery,
    filterBidStatus,
    filterJobSite,
    filterAiProvider,
    filterAiModel,
    filterHasInterviews,
    filterDateFrom,
    filterDateTo,
    filterCaller,
    filterInterviewer,
    pageSize,
  ]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setInterviewPage(1);
  }, [
    interviewSearchQuery,
    interviewFilterStatus,
    interviewFilterCaller,
    interviewFilterDateFrom,
    interviewFilterDateTo,
    interviewPageSize,
  ]);

  useEffect(() => {
    if (interviewPage > interviewTotalPages) {
      setInterviewPage(interviewTotalPages);
    }
  }, [interviewPage, interviewTotalPages]);

  useEffect(() => {
    if (!authLoading && user?.id) {
      loadRecords();
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
      console.error("Failed to load resume history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBidStatusChange = async (record: ResumeRecord, bidStatus: BidStatus) => {
    try {
      const updated = await updateResumeBidStatus(record.id, bidStatus);
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (error) {
      console.error("Failed to update bid status:", error);
      showToast("error", "Failed to update status");
    }
  };

  const expandRecord = async (record: ResumeRecord) => {
    if (expandedId === record.id) return;

    setExpandedId(record.id);
    setInterviewFormMode(null);
    setInterviewForm(emptyInterviewForm());
    setLoadingDetail(true);
    setExpandedJd("");
    setExpandedResume("");
    setExpandedResumeData(null);
    setJdCopied(false);
    try {
      const { jd, resume } = await getResumeArtifacts(record);
      setExpandedJd(jd);
      setExpandedResume(JSON.stringify(resume, null, 2));
      setExpandedResumeData(resume);
    } catch (error) {
      console.error("Failed to load artifacts:", error);
      setExpandedJd("Failed to load job description.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleExpand = async (record: ResumeRecord) => {
    if (expandedId === record.id) {
      setExpandedId(null);
      setInterviewFormMode(null);
      setExpandedResumeData(null);
      return;
    }
    await expandRecord(record);
  };

  const openBidFromInterview = async (resumeId: string) => {
    const record = records.find((row) => row.id === resumeId);
    if (!record) return;
    setHistoryTab("bids");
    await expandRecord(record);
    window.requestAnimationFrame(() => {
      document.getElementById(`bid-${resumeId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const jdCopyText = (record: ResumeRecord) =>
    formatJobDescriptionForCopy(expandedJd, {
      jobTitle: record.job_title,
      companyName: record.job_company,
      jobLocation: record.job_location,
      industry: record.industry,
      securityClearance: record.security_clearance,
      salary: record.salary,
      postedDate: record.posted_date,
      jobTypes: recordJobTypes(record),
      requiresTravel: record.requires_travel,
    });

  const handleCopyJd = async (record: ResumeRecord) => {
    const text = jdCopyText(record);
    if (!text) return;
    try {
      await writeClipboardText(text);
      setJdCopied(true);
      setTimeout(() => setJdCopied(false), 2000);
    } catch {
      showToast("error", "Copy failed");
    }
  };

  const handleDownloadJd = async (record: ResumeRecord) => {
    const text = jdCopyText(record);
    if (!text) return;
    setJdDownloadingId(record.id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { savedPath } = await saveTextToDownloadsFolder(text, {
        companyName: record.job_company || "",
        jobRole: record.job_title || "",
        fileName: "Job Description.txt",
        accessToken: session?.access_token,
        saveViaDialog: true,
      });
      showToast("success", `Job description saved as ${savedPath}`);
    } catch (error) {
      if (error instanceof SaveCancelledError) return;
      console.error("Failed to download job description:", error);
      showToast(
        "error",
        error instanceof Error ? error.message : "Failed to download job description"
      );
    } finally {
      setJdDownloadingId(null);
    }
  };

  const handleDownloadResumePdf = async (record: ResumeRecord) => {
    if (!expandedResumeData) return;
    setPdfDownloadingId(record.id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { savedPath } = await saveResumePdfToDownloadsFolder(expandedResumeData, {
        companyName: record.job_company || "",
        jobRole: record.job_title || "",
        personName: expandedResumeData.name || "resume",
        accessToken: session?.access_token,
        saveViaDialog: true,
      });
      showToast("success", `Resume PDF saved as ${savedPath}`);
    } catch (error) {
      if (error instanceof SaveCancelledError) return;
      console.error("Failed to download resume PDF:", error);
      showToast("error", error instanceof Error ? error.message : "Failed to download PDF");
    } finally {
      setPdfDownloadingId(null);
    }
  };

  const openInterviewForm = (resumeId: string) => {
    setInterviewFormMode({ kind: "add", resumeId });
    setInterviewForm(emptyInterviewForm());
  };

  const openEditInterview = (row: InterviewRecord) => {
    if (!row.resume_id) return;
    setInterviewFormMode({ kind: "edit", resumeId: row.resume_id, interviewId: row.id });
    setInterviewForm(interviewToForm(row));
  };

  const closeInterviewForm = () => {
    setInterviewFormMode(null);
    setInterviewForm(emptyInterviewForm());
  };

  const handleSaveInterview = async (e: React.FormEvent, resumeId: string) => {
    e.preventDefault();
    if (!user || !interviewFormMode || interviewFormMode.resumeId !== resumeId) return;

    setSavingInterview(true);
    const payload = {
      interview_date: interviewForm.interview_date,
      caller: interviewForm.caller || null,
      interviewer: interviewForm.interviewer || null,
      call_type: interviewForm.call_type || null,
      video_name: interviewForm.video_name || null,
      note: interviewForm.note || null,
    };

    try {
      if (interviewFormMode.kind === "edit") {
        const updated = await updateInterview(interviewFormMode.interviewId, payload);
        setInterviews((prev) =>
          prev.map((row) => (row.id === updated.id ? updated : row))
        );
      } else {
        const { interview: created, resume: updatedResume } = await createInterview(user.id, {
          resume_id: resumeId,
          ...payload,
        });
        setInterviews((prev) => [created, ...prev]);
        if (updatedResume) {
          setRecords((prev) =>
            prev.map((record) => (record.id === updatedResume.id ? updatedResume : record))
          );
        }
      }
      closeInterviewForm();
    } catch (error) {
      console.error("Failed to save interview:", error);
      showToast(
        "error",
        interviewFormMode.kind === "edit"
          ? "Failed to update interview info"
          : "Failed to save interview info"
      );
    } finally {
      setSavingInterview(false);
    }
  };

  const handleDeleteInterview = async (id: string) => {
    if (!confirm("Delete this interview record?")) return;
    try {
      await deleteInterview(id);
      setInterviews((prev) => prev.filter((row) => row.id !== id));
      if (interviewFormMode?.kind === "edit" && interviewFormMode.interviewId === id) {
        closeInterviewForm();
      }
    } catch (error) {
      console.error("Failed to delete interview:", error);
      showToast("error", "Failed to delete");
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <main className="page-shell">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="glass-panel overflow-hidden">
          <div className="page-header">
            <h2 className="page-title">History</h2>
            <p className="page-subtitle">
              Saved applications and interview notes
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setHistoryTab("bids")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  historyTab === "bids"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600/60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                Applications
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab("interviews")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  historyTab === "interviews"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600/60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                Interviews
              </button>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : historyTab === "interviews" ? (
              <>
                <InterviewHistoryFilters
                  searchQuery={interviewSearchQuery}
                  onSearchChange={setInterviewSearchQuery}
                  filterStatus={interviewFilterStatus}
                  onStatusChange={setInterviewFilterStatus}
                  filterCaller={interviewFilterCaller}
                  onCallerChange={setInterviewFilterCaller}
                  filterDateFrom={interviewFilterDateFrom}
                  onDateFromChange={setInterviewFilterDateFrom}
                  filterDateTo={interviewFilterDateTo}
                  onDateToChange={setInterviewFilterDateTo}
                />
                <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-300">
                  <span>
                    {filteredInterviewRows.length === 0
                      ? "No matching interviews"
                      : `Showing ${(interviewPage - 1) * interviewPageSize + 1}–${Math.min(interviewPage * interviewPageSize, filteredInterviewRows.length)} of ${filteredInterviewRows.length}`}
                    {interviewHistoryRows.length !== filteredInterviewRows.length
                      ? ` (${interviewHistoryRows.length} total)`
                      : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    {hasInterviewActiveFilters ? (
                      <button type="button" onClick={clearInterviewFilters} className="btn-compact">
                        Clear filters
                      </button>
                    ) : null}
                    <label className="flex items-center gap-1.5">
                      <span>Per page</span>
                      <select
                        value={interviewPageSize}
                        onChange={(e) => setInterviewPageSize(Number(e.target.value))}
                        className="select-compact min-w-[4.5rem] py-1 text-xs"
                      >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                {filteredInterviewRows.length === 0 ? (
                  <p className="py-12 text-center text-slate-500 dark:text-slate-300">
                    {interviewHistoryRows.length === 0
                      ? "No interview records yet. Add interview info from an application in Applications."
                      : "No interviews match your search or filters."}
                  </p>
                ) : (
                  <InterviewHistoryTable
                    rows={paginatedInterviewRows}
                    onOpenBid={openBidFromInterview}
                  />
                )}
                {filteredInterviewRows.length > 0 && interviewTotalPages > 1 ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-600/60 pt-4">
                    <button
                      type="button"
                      onClick={() => setInterviewPage((p) => Math.max(1, p - 1))}
                      disabled={interviewPage <= 1}
                      className="btn-soft text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {interviewTotalPages <= 7 ? (
                        Array.from({ length: interviewTotalPages }, (_, i) => i + 1).map(
                          (pageNum) => (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => setInterviewPage(pageNum)}
                              className={`min-w-8 rounded-lg px-2 py-1 text-xs ${
                                pageNum === interviewPage
                                  ? "bg-blue-600 font-semibold text-white"
                                  : "border border-slate-200 dark:border-slate-600/60 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                              }`}
                            >
                              {pageNum}
                            </button>
                          )
                        )
                      ) : (
                        <span className="px-2 text-xs text-slate-600 dark:text-slate-300">
                          Page {interviewPage} of {interviewTotalPages}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setInterviewPage((p) => Math.min(interviewTotalPages, p + 1))
                      }
                      disabled={interviewPage >= interviewTotalPages}
                      className="btn-soft text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </>
            ) : records.length === 0 ? (
              <p className="py-12 text-center text-slate-500 dark:text-slate-300">No applications yet. Analyze a job on the Generator page.</p>
            ) : (
              <>
                <div className="card-soft mb-3 space-y-2 p-3">
                  <div>
                    <label htmlFor="history-search" className="filter-label">
                      Search
                    </label>
                    <input
                      id="history-search"
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Title, company, AI model, date, caller…"
                      className="filter-control"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
                      <div className="min-w-0">
                        <label htmlFor="filter-status" className="filter-label">
                          Status
                        </label>
                        <select
                          id="filter-status"
                          value={filterBidStatus}
                          onChange={(e) => setFilterBidStatus(e.target.value as BidStatus | "")}
                          className="filter-select"
                        >
                          <option value="">All statuses</option>
                          {BID_STATUSES.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </div>
                      <div className="min-w-0">
                        <label htmlFor="filter-jobsite" className="filter-label">
                          Job board
                        </label>
                        <select
                          id="filter-jobsite"
                          value={filterJobSite}
                          onChange={(e) => setFilterJobSite(e.target.value)}
                          className="filter-select"
                        >
                          <option value="">All jobsites</option>
                          {JOBSITES.map((site) => (
                            <option key={site.id} value={site.id}>{site.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="min-w-0">
                        <label htmlFor="filter-ai" className="filter-label">
                          AI
                        </label>
                        <select
                          id="filter-ai"
                          value={filterAiProvider}
                          onChange={(e) => setFilterAiProvider(e.target.value)}
                          className="filter-select"
                        >
                          <option value="">All providers</option>
                          {aiProviderOptions.map((provider) => (
                            <option key={provider} value={provider}>
                              {formatProviderLabel(provider)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="min-w-0">
                        <label htmlFor="filter-ai-model" className="filter-label">
                          Model
                        </label>
                        <input
                          id="filter-ai-model"
                          type="search"
                          list="history-model-options"
                          value={filterAiModel}
                          onChange={(e) => setFilterAiModel(e.target.value)}
                          placeholder="All models"
                          className="filter-control"
                        />
                        <datalist id="history-model-options">
                          {modelOptions.map((model) => (
                            <option key={model} value={model} />
                          ))}
                        </datalist>
                      </div>
                      <div className="min-w-0">
                        <label htmlFor="filter-interviews" className="filter-label">
                          Interviews
                        </label>
                        <select
                          id="filter-interviews"
                          value={filterHasInterviews}
                          onChange={(e) => setFilterHasInterviews(e.target.value as "" | "yes" | "no")}
                          className="filter-select"
                        >
                          <option value="">All applications</option>
                          <option value="yes">Has interviews</option>
                          <option value="no">No interviews</option>
                        </select>
                      </div>
                      <div className="min-w-0">
                        <label htmlFor="filter-date-from" className="filter-label">
                          From
                        </label>
                        <input
                          id="filter-date-from"
                          type="date"
                          value={filterDateFrom}
                          onChange={(e) => setFilterDateFrom(e.target.value)}
                          className="filter-control"
                        />
                      </div>
                      <div className="min-w-0">
                        <label htmlFor="filter-date-to" className="filter-label">
                          To
                        </label>
                        <input
                          id="filter-date-to"
                          type="date"
                          value={filterDateTo}
                          onChange={(e) => setFilterDateTo(e.target.value)}
                          className="filter-control"
                        />
                      </div>
                      <div className="min-w-0">
                        <label htmlFor="filter-caller" className="filter-label">
                          Caller
                        </label>
                        <input
                          id="filter-caller"
                          type="search"
                          value={filterCaller}
                          onChange={(e) => setFilterCaller(e.target.value)}
                          placeholder="Caller"
                          className="filter-control"
                        />
                      </div>
                      <div className="min-w-0">
                        <label htmlFor="filter-interviewer" className="filter-label">
                          Interviewer
                        </label>
                        <input
                          id="filter-interviewer"
                          type="search"
                          value={filterInterviewer}
                          onChange={(e) => setFilterInterviewer(e.target.value)}
                          placeholder="Interviewer"
                          className="filter-control"
                        />
                      </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-0.5 text-[11px] text-slate-500 dark:text-slate-300">
                    <span>
                      {filteredRecords.length === 0
                        ? "No matching applications"
                        : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredRecords.length)} of ${filteredRecords.length}`}
                      {records.length !== filteredRecords.length ? ` (${records.length} total)` : ""}
                    </span>
                    <div className="flex items-center gap-2">
                      {hasActiveFilters && (
                        <button type="button" onClick={clearFilters} className="btn-compact">
                          Clear filters
                        </button>
                      )}
                      <label className="flex items-center gap-1.5">
                        <span>Per page</span>
                        <select
                          value={pageSize}
                          onChange={(e) => setPageSize(Number(e.target.value))}
                          className="select-compact min-w-[4.5rem] py-1 text-xs"
                        >
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </div>

                {filteredRecords.length === 0 ? (
                  <p className="py-12 text-center text-slate-500 dark:text-slate-300">
                    No applications match your search or filters.
                  </p>
                ) : (
              <div className="space-y-2">
                {paginatedRecords.map((record) => {
                  const recordInterviews = interviewsByResume.get(record.id) ?? [];
                  const isExpanded = expandedId === record.id;
                  const jobTypes = recordJobTypes(record);
                  const aiCostLabel = formatRecordAiCost(record);
                  const showAddForm =
                    interviewFormMode?.kind === "add" && interviewFormMode.resumeId === record.id;
                  const editingInterviewId =
                    interviewFormMode?.kind === "edit" && interviewFormMode.resumeId === record.id
                      ? interviewFormMode.interviewId
                      : null;

                  return (
                    <div key={record.id} id={`bid-${record.id}`} className="card overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {record.job_link ? (
                              <a
                                href={record.job_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="min-w-0 truncate text-sm font-semibold leading-none text-slate-900 dark:text-slate-50 hover:text-blue-600 hover:underline"
                              >
                                {renderJobRecordHeadline(record)}
                              </a>
                            ) : (
                              <p className="min-w-0 truncate text-sm font-semibold leading-none text-slate-900 dark:text-slate-50">
                                {renderJobRecordHeadline(record)}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="badge">{formatListDate(record.created_at)}</span>
                              <span className="badge">{jobsiteLabel(record.job_site)}</span>
                              {record.salary ? (
                                <span className="badge max-w-[12rem] truncate">{record.salary}</span>
                              ) : null}
                              {record.security_clearance ? (
                                <span className="badge max-w-[12rem] truncate">{record.security_clearance}</span>
                              ) : null}
                              {jobTypes.map((type) => (
                                <span
                                  key={type}
                                  className={`badge ${jobWorkTypeBadgeClass(type)}`}
                                >
                                  {formatJobWorkTypeLabel(type)}
                                </span>
                              ))}
                              {record.requires_travel ? (
                                <span className="badge border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-300">
                                  Travel
                                </span>
                              ) : null}
                              <span className="badge">{record.ai_type ?? "AI"}</span>
                              {record.model && <span className="badge max-w-[9rem] truncate">{record.model}</span>}
                              {record.ats_score != null ? (
                                <span
                                  className={`badge font-semibold ${atsScoreTextClass(record.ats_score)} bg-slate-100 dark:bg-slate-800/80`}
                                >
                                  ATS {record.ats_score} · {formatAtsScoreLabel(record.ats_score)}
                                </span>
                              ) : null}
                              {recordInterviews.length > 0 && (
                                <span className="badge border-blue-200 bg-blue-50 text-blue-700">
                                  {recordInterviews.length} interview{recordInterviews.length === 1 ? "" : "s"}
                                </span>
                              )}
                            </div>
                            {aiCostLabel ? (
                              <p className="mt-1 w-full text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                <span className="font-medium text-slate-500 dark:text-slate-400">
                                  AI cost
                                </span>{" "}
                                {aiCostLabel}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <select
                            value={resolveBidStatus(record.bid_status)}
                            onChange={(e) => handleBidStatusChange(record, e.target.value as BidStatus)}
                            className="select-compact min-w-[7rem]"
                            aria-label="Application status"
                          >
                            {BID_STATUSES.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => toggleExpand(record)}
                            className="btn-compact"
                          >
                            {isExpanded ? "Hide" : "View"}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-slate-100 dark:border-slate-600/50 px-4 py-4">
                          {loadingDetail ? (
                            <div className="flex justify-center py-6">
                              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
                            </div>
                          ) : (
                            <div className="space-y-6">
                              <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
                                <div className="flex min-h-0 flex-col">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Job Description</h4>
                                    <div className="flex items-center gap-1">
                                      <IconButton
                                        title={jdCopied ? "Copied" : "Copy job description"}
                                        onClick={() => void handleCopyJd(record)}
                                        disabled={!expandedJd.trim()}
                                      >
                                        {jdCopied ? <CheckIcon /> : <CopyIcon />}
                                      </IconButton>
                                      <IconButton
                                        title="Download job description"
                                        onClick={() => void handleDownloadJd(record)}
                                        disabled={!expandedJd.trim() || jdDownloadingId === record.id}
                                      >
                                        {jdDownloadingId === record.id ? (
                                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-[#007fff] dark:border-blue-900/50 dark:border-t-blue-400" />
                                        ) : (
                                          <DownloadIcon />
                                        )}
                                      </IconButton>
                                    </div>
                                  </div>
                                  <div className="surface-inset h-[28rem] min-h-0 overflow-auto p-4">
                                    <FormattedJobDescription
                                      jobDescription={prepareJobDescriptionForDisplay(expandedJd)}
                                      jobTitle={record.job_title ?? undefined}
                                      companyName={record.job_company ?? undefined}
                                      jobLocation={record.job_location ?? undefined}
                                      industry={record.industry ?? undefined}
                                      securityClearance={record.security_clearance ?? undefined}
                                      salary={record.salary ?? undefined}
                                      postedDate={record.posted_date ?? undefined}
                                      jobTypes={jobTypes}
                                      requiresTravel={Boolean(record.requires_travel)}
                                    />
                                  </div>
                                </div>
                                <div className="flex min-h-0 flex-col">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Resume JSON</h4>
                                    <IconButton
                                      title="Download resume PDF"
                                      onClick={() => void handleDownloadResumePdf(record)}
                                      disabled={!expandedResumeData || pdfDownloadingId === record.id}
                                    >
                                      {pdfDownloadingId === record.id ? (
                                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-[#007fff] dark:border-blue-900/50 dark:border-t-blue-400" />
                                      ) : (
                                        <DownloadIcon />
                                      )}
                                    </IconButton>
                                  </div>
                                  <pre className="surface-inset h-[28rem] min-h-0 overflow-auto p-3 text-xs whitespace-pre-wrap">{expandedResume}</pre>
                                </div>
                              </div>

                              <div>
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Interviews</h4>
                                  {!showAddForm && !editingInterviewId && (
                                    <button
                                      type="button"
                                      onClick={() => openInterviewForm(record.id)}
                                      className="btn-primary px-3 py-1.5 text-xs"
                                    >
                                      Add interview info
                                    </button>
                                  )}
                                </div>

                                {recordInterviews.length === 0 && !showAddForm ? (
                                  <p className="rounded-lg border border-dashed border-slate-200 dark:border-slate-600/60 bg-slate-50 dark:bg-slate-800/90 px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-300">
                                    No interviews recorded for this application yet.
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {recordInterviews.map((row) =>
                                      editingInterviewId === row.id ? (
                                        <form
                                          key={row.id}
                                          onSubmit={(e) => handleSaveInterview(e, record.id)}
                                          className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20"
                                        >
                                          <div className="mb-3 flex items-center justify-between gap-2">
                                            <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                              Edit interview info
                                            </h5>
                                            <button
                                              type="button"
                                              onClick={closeInterviewForm}
                                              className="btn-soft text-xs"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                          <InterviewFormFields
                                            form={interviewForm}
                                            onChange={(patch) =>
                                              setInterviewForm((prev) => ({ ...prev, ...patch }))
                                            }
                                          />
                                          <div className="mt-4 flex justify-end">
                                            <button
                                              type="submit"
                                              disabled={savingInterview}
                                              className="btn-primary px-4 py-2 text-sm"
                                            >
                                              {savingInterview ? "Saving…" : "Save changes"}
                                            </button>
                                          </div>
                                        </form>
                                      ) : (
                                        <div
                                          key={row.id}
                                          className="flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-600/60 bg-slate-50 dark:bg-slate-800/90 px-3 py-2.5"
                                        >
                                          <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                                              {formatInterviewDate(row.interview_date)}
                                              {row.call_type ? ` · ${row.call_type.replace(/_/g, " ")}` : ""}
                                            </p>
                                            {row.caller && (
                                              <p className="text-sm text-slate-600 dark:text-slate-300">
                                                Caller: {row.caller}
                                              </p>
                                            )}
                                            {row.interviewer && (
                                              <p className="text-sm text-slate-600 dark:text-slate-300">
                                                Interviewer: {row.interviewer}
                                              </p>
                                            )}
                                            {row.video_name && (
                                              <p className="text-xs text-slate-500 dark:text-slate-300">
                                                Recording: {row.video_name}
                                              </p>
                                            )}
                                            {row.note && (
                                              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                                                {row.note}
                                              </p>
                                            )}
                                          </div>
                                          <div className="flex shrink-0 items-center gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => openEditInterview(row)}
                                              className="btn-soft text-xs"
                                            >
                                              Edit
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteInterview(row.id)}
                                              className="btn-soft text-xs text-red-600 dark:text-red-400"
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}

                                {showAddForm && (
                                  <form
                                    onSubmit={(e) => handleSaveInterview(e, record.id)}
                                    className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20"
                                  >
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                      <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        Add interview info
                                      </h5>
                                      <button
                                        type="button"
                                        onClick={closeInterviewForm}
                                        className="btn-soft text-xs"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                    <InterviewFormFields
                                      form={interviewForm}
                                      onChange={(patch) =>
                                        setInterviewForm((prev) => ({ ...prev, ...patch }))
                                      }
                                    />
                                    <div className="mt-4 flex justify-end">
                                      <button
                                        type="submit"
                                        disabled={savingInterview}
                                        className="btn-primary px-4 py-2 text-sm"
                                      >
                                        {savingInterview ? "Saving…" : "Save interview info"}
                                      </button>
                                    </div>
                                  </form>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
                )}

                {filteredRecords.length > 0 && totalPages > 1 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-600/60 pt-4">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="btn-soft text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {totalPages <= 7 ? (
                        Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => setPage(pageNum)}
                            className={`min-w-8 rounded-lg px-2 py-1 text-xs ${
                              pageNum === page
                                ? "bg-blue-600 font-semibold text-white"
                                : "border border-slate-200 dark:border-slate-600/60 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                            }`}
                          >
                            {pageNum}
                          </button>
                        ))
                      ) : (
                        <span className="px-2 text-xs text-slate-600 dark:text-slate-300">
                          Page {page} of {totalPages}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="btn-soft text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
