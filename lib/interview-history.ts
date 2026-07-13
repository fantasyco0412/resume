import type {
  BidStatus,
  InterviewCallType,
  InterviewRecord,
  ResumeRecord,
} from "@/lib/supabase/database.types";
import { DEFAULT_BID_STATUS, INTERVIEW_CALL_TYPES } from "@/lib/supabase/database.types";

export const INTERVIEW_STAGE_LABELS: Record<InterviewCallType, string> = {
  intro: "Intro",
  hr: "HR",
  live_coding: "Tech",
  system_design: "System design",
  culture: "Culture",
  final: "Final",
};

export interface InterviewHistoryRow {
  resumeId: string | null;
  company: string;
  jobTitle: string;
  caller: string;
  latestDate: string;
  pipeline: InterviewCallType[];
  pipelineLabel: string;
  status: BidStatus;
}

function resolveStatus(status: string | null | undefined): BidStatus {
  if (!status || status === "draft") return DEFAULT_BID_STATUS;
  const allowed: BidStatus[] = ["applied", "interviewing", "rejected", "offer", "accepted"];
  return allowed.includes(status as BidStatus) ? (status as BidStatus) : DEFAULT_BID_STATUS;
}

function buildPipeline(interviews: InterviewRecord[]): InterviewCallType[] {
  const sorted = [...interviews].sort(
    (a, b) => new Date(a.interview_date).getTime() - new Date(b.interview_date).getTime()
  );

  const pipeline: InterviewCallType[] = [];
  for (const row of sorted) {
    if (!row.call_type || !INTERVIEW_CALL_TYPES.includes(row.call_type)) continue;
    if (pipeline[pipeline.length - 1] === row.call_type) continue;
    pipeline.push(row.call_type);
  }
  return pipeline;
}

function formatPipelineLabel(pipeline: InterviewCallType[]): string {
  if (pipeline.length === 0) return "—";
  return pipeline.map((stage) => INTERVIEW_STAGE_LABELS[stage]).join(" → ");
}

function pickCaller(interviews: InterviewRecord[]): string {
  const sorted = [...interviews].sort(
    (a, b) => new Date(b.interview_date).getTime() - new Date(a.interview_date).getTime()
  );
  for (const row of sorted) {
    const caller = row.caller?.trim();
    if (caller) return caller;
  }
  return "";
}

export function buildInterviewHistoryRows(
  interviews: InterviewRecord[],
  resumes: ResumeRecord[]
): InterviewHistoryRow[] {
  const resumeById = new Map(resumes.map((record) => [record.id, record]));
  const grouped = new Map<string, { resume: ResumeRecord | null; interviews: InterviewRecord[] }>();

  for (const interview of interviews) {
    if (interview.resume_id && resumeById.has(interview.resume_id)) {
      const key = `resume:${interview.resume_id}`;
      const entry = grouped.get(key) ?? {
        resume: resumeById.get(interview.resume_id)!,
        interviews: [],
      };
      entry.interviews.push(interview);
      grouped.set(key, entry);
      continue;
    }

    const key = `orphan:${interview.id}`;
    grouped.set(key, { resume: null, interviews: [interview] });
  }

  const rows: InterviewHistoryRow[] = [];

  for (const { resume, interviews: groupInterviews } of grouped.values()) {
    if (groupInterviews.length === 0) continue;

    const latestDate = groupInterviews.reduce((latest, row) => {
      return new Date(row.interview_date) > new Date(latest) ? row.interview_date : latest;
    }, groupInterviews[0].interview_date);

    const pipeline = buildPipeline(groupInterviews);

    rows.push({
      resumeId: resume?.id ?? groupInterviews[0].resume_id,
      company: resume?.job_company?.trim() || "Unknown company",
      jobTitle: resume?.job_title?.trim() || "",
      caller: pickCaller(groupInterviews),
      latestDate,
      pipeline,
      pipelineLabel: formatPipelineLabel(pipeline),
      status: resolveStatus(resume?.bid_status),
    });
  }

  rows.sort(
    (a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
  );

  return rows;
}

export function formatInterviewHistoryDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function statusBadgeClass(status: BidStatus): string {
  switch (status) {
    case "interviewing":
      return "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300";
    case "offer":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "accepted":
      return "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-200";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600/50 dark:bg-slate-800/80 dark:text-slate-200";
  }
}
