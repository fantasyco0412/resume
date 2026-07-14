"use client";

import { useEffect, useState, memo, type ReactNode } from "react";
import type { AnalysisResult } from "@/lib/types/resume";
import type { JobWorkType } from "@/lib/prompts/job-page-extract";
import { formatJobWorkTypeLabel } from "@/lib/prompts/job-page-extract";
import { formatProviderLabel } from "@/lib/openrouter-shared";
import { jobWorkTypeBadgeClass } from "@/lib/job-work-type";
import {
  jobCompanyTextClass,
  jobContextSepClass,
  jobIndustryTextClass,
  jobLocationTextClass,
  jobPostedDateTextClass,
} from "@/lib/job-display-styles";
import { getJobsiteLabel, type JobsiteId } from "@/lib/jobsites";
import { formatDurationMs } from "@/lib/format-duration";
import { atsScoreTextClass, formatAtsScoreLabel } from "@/lib/check-ats-client";
import { formatAiCostBreakdown, formatCostUsd, sumCosts } from "@/lib/ai-usage";
import type { AtsMatchResult } from "@/lib/types/ats-match";
import JobDescriptionDialog from "@/components/JobDescriptionDialog";
import ResumeJsonDialog from "@/components/ResumeJsonDialog";
import AtsMatchDialog from "@/components/AtsMatchDialog";
import SessionModelControl from "@/components/SessionModelControl";
import type { DirectProviderModels } from "@/lib/direct-ai-shared";

export interface AnalysisSessionView {
  id: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  jobLocation: string;
  industry: string;
  securityClearance: string;
  jobType: JobWorkType;
  jobTypes: JobWorkType[];
  requiresTravel: boolean;
  salary: string;
  postedDate: string;
  aiProvider: string;
  aiModel: string;
  useOpenRouter: boolean;
  jobsite: JobsiteId;
  extracting: boolean;
  extractError: string | null;
  generating: boolean;
  generateError: string | null;
  result: AnalysisResult | null;
  downloading?: boolean;
  downloadError?: string | null;
  resumeId?: string;
  providerUsed?: string;
  modelUsed?: string;
  extractMs?: number;
  analyzeMs?: number;
  pdfMs?: number;
  atsLoading?: boolean;
  atsResult?: AtsMatchResult | null;
  atsError?: string | null;
  extractCostUsd?: number;
  generationCostUsd?: number;
  atsCostUsd?: number;
  answersCostUsd?: number;
  coverLetterCostUsd?: number;
}

interface AnalysisResultCardProps {
  session: AnalysisSessionView;
  sequenceNo: number;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  onGenerateResume: (id: string) => void;
  onDownloadResume?: (id: string) => void;
  onGenerateAnswers: (id: string) => void;
  onGenerateCoverLetter: (id: string) => void;
  onClose: (id: string) => void;
  directModels: DirectProviderModels;
  onSessionModelChange?: (
    sessionId: string,
    payload: { aiProvider: string; aiModel: string }
  ) => void;
  onError?: (message: string) => void;
  onAtsSaved?: (
    sessionId: string,
    payload: { atsResult: AtsMatchResult; atsCostUsd?: number }
  ) => void;
  onRegenerateFromJson?: (sessionId: string, resume: AnalysisResult) => Promise<void>;
}

type GeneratePhase = "extract" | "analyze" | "pdf" | null;

function GenerationProgressBar({ phase }: { phase: GeneratePhase }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!phase) {
      setProgress(0);
      return;
    }

    const floor = phase === "pdf" ? 68 : 0;
    const ceiling = phase === "pdf" ? 96 : 68;
    const tau = phase === "pdf" ? 12_000 : phase === "extract" ? 15_000 : 90_000;
    const started = Date.now();

    setProgress(floor);

    const tick = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const ratio = 1 - Math.exp(-elapsed / tau);
      setProgress(floor + (ceiling - floor) * ratio);
    }, 120);

    return () => window.clearInterval(tick);
  }, [phase]);

  if (!phase) return null;

  const label =
    phase === "extract"
      ? "Extracting job details…"
      : phase === "pdf"
        ? "Creating PDF…"
        : "Generating resume…";

  return (
    <div className="mt-1.5">
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">{label}</span>
        <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="relative h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/80">
        <div
          className="relative h-full rounded-full bg-gradient-to-r from-[#007fff] via-blue-500 to-cyan-400 transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        >
          <span className="absolute inset-0 animate-pulse bg-white/25" />
        </div>
      </div>
    </div>
  );
}

function MetaLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
      {children}
    </p>
  );
}

function MetaSep() {
  return <span className="select-none text-slate-300 dark:text-slate-600">·</span>;
}

function MetaBit({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <span>
      <span className="font-medium text-slate-400 dark:text-slate-500">{label}</span>{" "}
      <span className="text-slate-700 dark:text-slate-200">{value}</span>
    </span>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function BtnIcon({ children, className = "h-3.5 w-3.5 shrink-0" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex ${className}`} aria-hidden>
      {children}
    </span>
  );
}

function DocumentIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

const actionBtnClass =
  "btn-compact inline-flex h-7 items-center gap-1 px-2 text-[11px] leading-none";

function totalDurationMs(session: AnalysisSessionView): number | null {
  const parts = [session.extractMs, session.analyzeMs, session.pdfMs].filter(
    (value): value is number => value != null
  );
  if (parts.length === 0) return null;
  return parts.reduce((sum, value) => sum + value, 0);
}

function totalAiCostUsd(session: AnalysisSessionView): number {
  return sumCosts(
    session.extractCostUsd,
    session.generationCostUsd,
    session.atsCostUsd,
    session.answersCostUsd,
    session.coverLetterCostUsd
  );
}

function JobTypeBadges({
  jobTypes,
  requiresTravel,
}: {
  jobTypes: JobWorkType[];
  requiresTravel: boolean;
}) {
  const visibleTypes =
    jobTypes.filter((type) => type !== "unknown").length > 0
      ? jobTypes.filter((type) => type !== "unknown")
      : ["unknown" as JobWorkType];

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {visibleTypes.map((type) => (
        <span
          key={type}
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight ring-1 ring-inset ring-black/5 dark:ring-white/10 ${jobWorkTypeBadgeClass(type)}`}
        >
          {formatJobWorkTypeLabel(type)}
        </span>
      ))}
      {requiresTravel ? (
        <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium leading-tight text-violet-800 ring-1 ring-inset ring-violet-200/80 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-800/50">
          Travel
        </span>
      ) : null}
    </span>
  );
}

export default memo(function AnalysisResultCard({
  session,
  sequenceNo,
  selected = false,
  onSelectedChange,
  onGenerateResume,
  onDownloadResume,
  onGenerateAnswers,
  onGenerateCoverLetter,
  onClose,
  directModels,
  onSessionModelChange,
  onError,
  onAtsSaved,
  onRegenerateFromJson,
}: AnalysisResultCardProps) {
  const [jdOpen, setJdOpen] = useState(false);
  const [resumeJsonOpen, setResumeJsonOpen] = useState(false);
  const [atsOpen, setAtsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const hasResume = Boolean(session.result);
  const busy = session.extracting || session.generating || session.downloading;
  const atsBusy = Boolean(session.atsLoading);
  const closeDisabled = session.generating || session.downloading;
  const hasJobDescription = Boolean(session.jobDescription.trim());
  const generatePhase: GeneratePhase = session.extracting
    ? "extract"
    : session.generating
      ? "analyze"
      : session.downloading
        ? "pdf"
        : null;

  const generatedWith =
    session.providerUsed && session.result
      ? `${formatProviderLabel(session.providerUsed)}${session.modelUsed ? ` · ${session.modelUsed}` : ""}`
      : "";

  const displayModel = session.aiModel;
  const totalMs = totalDurationMs(session);
  const totalCost = totalAiCostUsd(session);
  const costBreakdown = formatAiCostBreakdown({
    extractCostUsd: session.extractCostUsd,
    generationCostUsd: session.generationCostUsd,
    atsCostUsd: session.atsCostUsd,
    answersCostUsd: session.answersCostUsd,
    coverLetterCostUsd: session.coverLetterCostUsd,
  });

  const hasHiddenDetails =
    Boolean(getJobsiteLabel(session.jobsite)) ||
    Boolean(generatedWith) ||
    session.extractMs != null ||
    session.analyzeMs != null ||
    session.pdfMs != null ||
    Boolean(costBreakdown && costBreakdown !== formatCostUsd(totalCost));

  const showSummaryLine =
    Boolean(session.salary) ||
    Boolean(session.securityClearance) ||
    Boolean(displayModel) ||
    totalMs != null ||
    session.atsLoading ||
    Boolean(session.atsResult) ||
    Boolean(session.atsError) ||
    totalCost > 0;

  return (
    <>
      <JobDescriptionDialog
        open={jdOpen}
        onClose={() => setJdOpen(false)}
        jobTitle={session.jobTitle}
        companyName={session.companyName}
        jobDescription={session.jobDescription}
        jobLocation={session.jobLocation}
        industry={session.industry}
        securityClearance={session.securityClearance}
        salary={session.salary}
        postedDate={session.postedDate}
        jobTypes={session.jobTypes}
        requiresTravel={session.requiresTravel}
      />
      {session.result ? (
        <ResumeJsonDialog
          open={resumeJsonOpen}
          onClose={() => setResumeJsonOpen(false)}
          jobTitle={session.jobTitle}
          companyName={session.companyName}
          resume={session.result}
          regenerating={false}
          onRegenerate={async (resume) => {
            if (!onRegenerateFromJson) return;
            await onRegenerateFromJson(session.id, resume);
          }}
        />
      ) : null}
      <AtsMatchDialog
        open={atsOpen}
        onClose={() => setAtsOpen(false)}
        resume={session.result}
        jobDescription={session.jobDescription}
        jobTitle={session.jobTitle}
        companyName={session.companyName}
        apiModel={session.aiModel}
        apiProvider={session.aiProvider}
        useOpenRouter={session.useOpenRouter}
        initialAts={session.atsResult ?? undefined}
        resumeRecordId={session.resumeId}
        onAtsSaved={(payload) => onAtsSaved?.(session.id, payload)}
        onError={(message) => onError?.(message)}
      />
      <article
        className={`group relative overflow-hidden rounded-xl border bg-gradient-to-br from-white via-white to-slate-50/90 shadow-sm transition-shadow duration-200 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900/40 ${
          selected
            ? "border-blue-300/80 ring-2 ring-[#007fff]/35 dark:border-blue-500/40 dark:ring-blue-400/30"
            : busy
              ? "border-blue-200/80 shadow-[0_8px_28px_-14px_rgba(0,127,255,0.45)] dark:border-blue-500/30"
              : "border-slate-200/90 hover:shadow-md dark:border-slate-600/80 dark:hover:border-slate-500/50"
        }`}
      >
        <div
          className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${
            busy ? "from-[#007fff] via-blue-500 to-cyan-400" : "from-slate-300 to-slate-200 dark:from-slate-600 dark:to-slate-700"
          }`}
          aria-hidden
        />

        <button
          type="button"
          onClick={() => onClose(session.id)}
          disabled={closeDisabled}
          className="absolute right-1.5 top-1.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 opacity-70 transition hover:bg-slate-100 hover:text-slate-600 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          aria-label="Remove this job"
        >
          <CloseIcon />
        </button>

        <div className="border-b border-slate-100/90 px-2.5 py-1.5 pl-3 pr-8 dark:border-slate-600/40">
          <div className="flex min-w-0 items-start gap-2">
            {onSelectedChange ? (
              <input
                type="checkbox"
                checked={selected}
                onChange={(event) => onSelectedChange(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-[#007fff] focus:ring-[#007fff]/30 dark:border-slate-500 dark:bg-slate-800"
                aria-label={`Select ${session.jobTitle || "analysis result"}`}
              />
            ) : null}
            <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">
                  {sequenceNo}.
                </span>
                <h3 className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  {session.extracting && !session.jobTitle
                    ? "Extracting…"
                    : session.jobTitle || "Unknown role"}
                </h3>
                {session.companyName ? (
                  <span className={`truncate text-xs ${jobCompanyTextClass}`}>
                    {session.companyName}
                  </span>
                ) : null}
                {session.industry ? (
                  <>
                    <span className={jobContextSepClass}>·</span>
                    <span className={`truncate text-xs ${jobIndustryTextClass}`}>
                      {session.industry}
                    </span>
                  </>
                ) : null}
                {session.jobLocation ? (
                  <>
                    <span className={jobContextSepClass}>·</span>
                    <span className={`truncate text-xs ${jobLocationTextClass}`}>
                      {session.jobLocation}
                    </span>
                  </>
                ) : null}
                {!session.extracting ? (
                  <>
                    <span className={jobContextSepClass}>·</span>
                    <JobTypeBadges
                      jobTypes={session.jobTypes}
                      requiresTravel={session.requiresTravel}
                    />
                  </>
                ) : null}
                {session.postedDate ? (
                  <>
                    <span className={jobContextSepClass}>·</span>
                    <span className={`truncate text-xs ${jobPostedDateTextClass}`}>
                      Posted {session.postedDate}
                    </span>
                  </>
                ) : null}
              </div>

              {showSummaryLine ? (
                <div className="mt-1 flex items-start gap-0.5">
                  <MetaLine>
                    {session.salary ? <MetaBit label="Salary" value={session.salary} /> : null}
                    {session.securityClearance ? (
                      <>
                        {session.salary && <MetaSep />}
                        <MetaBit label="Security clearance" value={session.securityClearance} />
                      </>
                    ) : null}
                    {displayModel ? (
                      <>
                        {(session.salary || session.securityClearance) && <MetaSep />}
                        <SessionModelControl
                          useOpenRouter={session.useOpenRouter}
                          aiProvider={session.aiProvider}
                          aiModel={session.aiModel}
                          directModels={directModels}
                          disabled={busy}
                          onChange={(next) =>
                            onSessionModelChange?.(session.id, next)
                          }
                        />
                      </>
                    ) : null}
                    {totalMs != null ? (
                      <>
                        {(session.salary || session.securityClearance || displayModel) && <MetaSep />}
                        <MetaBit label="Total time" value={formatDurationMs(totalMs)} />
                      </>
                    ) : null}
                    {session.atsLoading ? (
                      <>
                        {(session.salary || session.securityClearance || displayModel || totalMs != null) && (
                          <MetaSep />
                        )}
                        <span className="text-slate-500 dark:text-slate-400">Checking ATS match…</span>
                      </>
                    ) : session.atsResult ? (
                      <>
                        {(session.salary || session.securityClearance || displayModel || totalMs != null) && (
                          <MetaSep />
                        )}
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${atsScoreTextClass(session.atsResult.score)} bg-slate-100 dark:bg-slate-800/80`}
                        >
                          ATS {session.atsResult.score} · {formatAtsScoreLabel(session.atsResult.score)}
                        </span>
                      </>
                    ) : session.atsError ? (
                      <>
                        {(session.salary || session.securityClearance || displayModel || totalMs != null) && (
                          <MetaSep />
                        )}
                        <span className="font-medium text-red-600 dark:text-red-400">ATS check failed</span>
                      </>
                    ) : null}
                    {totalCost > 0 ? (
                      <>
                        {(session.salary ||
                          session.securityClearance ||
                          displayModel ||
                          totalMs != null ||
                          session.atsLoading ||
                          session.atsResult ||
                          session.atsError) && <MetaSep />}
                        <MetaBit label="Est. AI cost" value={formatCostUsd(totalCost)} />
                      </>
                    ) : null}
                  </MetaLine>
                  {hasHiddenDetails ? (
                    <button
                      type="button"
                      onClick={() => setDetailsOpen((open) => !open)}
                      className="mt-0.5 shrink-0 rounded-md p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                      aria-expanded={detailsOpen}
                      aria-label={detailsOpen ? "Hide details" : "Show details"}
                    >
                      <ChevronIcon open={detailsOpen} />
                    </button>
                  ) : null}
                </div>
              ) : null}

              {detailsOpen && hasHiddenDetails ? (
                <div className="mt-0.5">
                  <MetaLine>
                  <MetaBit label="Job board" value={getJobsiteLabel(session.jobsite)} />
                  {generatedWith ? (
                    <>
                      <MetaSep />
                      <MetaBit label="Created with" value={generatedWith} />
                    </>
                  ) : null}
                  {session.extractMs != null ? (
                    <>
                      <MetaSep />
                      <MetaBit label="Job extract" value={formatDurationMs(session.extractMs)} />
                    </>
                  ) : null}
                  {session.analyzeMs != null ? (
                    <>
                      <MetaSep />
                      <MetaBit label="Resume gen" value={formatDurationMs(session.analyzeMs)} />
                    </>
                  ) : null}
                  {session.pdfMs != null ? (
                    <>
                      <MetaSep />
                      <MetaBit label="PDF" value={formatDurationMs(session.pdfMs)} />
                    </>
                  ) : null}
                  {costBreakdown && totalCost > 0 && costBreakdown !== formatCostUsd(totalCost) ? (
                    <>
                      <MetaSep />
                      <MetaBit label="Cost breakdown" value={costBreakdown} />
                    </>
                  ) : null}
                </MetaLine>
                </div>
              ) : null}

              <GenerationProgressBar phase={generatePhase} />
            </div>
          </div>
        </div>

        {(session.extractError || session.generateError || session.downloadError) && (
          <div className="border-b border-red-100 bg-red-50/90 px-2.5 py-1 pl-3 text-[11px] leading-snug text-red-800 dark:border-red-900/30 dark:bg-red-950/40 dark:text-red-300">
            {session.extractError || session.generateError || session.downloadError}
          </div>
        )}

        <div className="flex flex-wrap gap-1 px-2.5 py-1.5 pl-3">
          <button
            type="button"
            onClick={() => onGenerateResume(session.id)}
            disabled={busy || !hasJobDescription}
            className={`${actionBtnClass} bg-[#007fff] font-semibold text-white shadow-sm hover:border-[#0066cc] hover:bg-[#0066cc] hover:text-white disabled:border-slate-200 disabled:bg-slate-100 disabled:font-medium disabled:text-slate-400 disabled:shadow-none disabled:hover:border-slate-200 disabled:hover:bg-slate-100 disabled:hover:text-slate-400 dark:disabled:border-slate-700/80 dark:disabled:bg-slate-800/40 dark:disabled:text-slate-500 dark:hover:border-[#0066cc] dark:hover:bg-[#0066cc] dark:disabled:hover:border-slate-700/80 dark:disabled:hover:bg-slate-800/40 dark:disabled:hover:text-slate-500`}
          >
            <BtnIcon>
              {session.extracting || session.generating ? (
                <RefreshIcon />
              ) : hasResume ? (
                <RefreshIcon />
              ) : (
                <SparklesIcon />
              )}
            </BtnIcon>
            {session.extracting
              ? "Extracting…"
              : session.generating
                ? "Generating…"
                : hasResume
                  ? "Regenerate resume"
                  : "Generate resume"}
          </button>
          <button
            type="button"
            onClick={() => onDownloadResume?.(session.id)}
            disabled={!hasResume || busy || !onDownloadResume}
            className={actionBtnClass}
          >
            <BtnIcon>
              {session.downloading ? <RefreshIcon /> : <DownloadIcon />}
            </BtnIcon>
            {session.downloading ? "Downloading…" : "Download resume"}
          </button>
          <button
            type="button"
            onClick={() => setJdOpen(true)}
            disabled={!hasJobDescription}
            className={actionBtnClass}
          >
            <BtnIcon>
              <DocumentIcon />
            </BtnIcon>
            View description
          </button>
          <button
            type="button"
            onClick={() => setResumeJsonOpen(true)}
            disabled={!hasResume}
            className={actionBtnClass}
          >
            <BtnIcon>
              <CodeIcon />
            </BtnIcon>
            View JSON
          </button>
          <button
            type="button"
            onClick={() => setAtsOpen(true)}
            disabled={!hasResume || !hasJobDescription || busy || atsBusy}
            className={actionBtnClass}
          >
            <BtnIcon>
              <TargetIcon />
            </BtnIcon>
            {atsBusy ? "Checking…" : "Check ATS"}
          </button>
          <button
            type="button"
            onClick={() => onGenerateAnswers(session.id)}
            disabled={!hasResume || busy}
            className={actionBtnClass}
          >
            <BtnIcon>
              <ChatIcon />
            </BtnIcon>
            Questions
          </button>
          <button
            type="button"
            onClick={() => onGenerateCoverLetter(session.id)}
            disabled={!hasResume || busy}
            className={actionBtnClass}
          >
            <BtnIcon>
              <MailIcon />
            </BtnIcon>
            Cover letter
          </button>
        </div>
      </article>
    </>
  );
});
