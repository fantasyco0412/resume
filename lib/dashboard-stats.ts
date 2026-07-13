import type { ResumeRecord } from "@/lib/supabase/database.types";
import { DEFAULT_BID_STATUS, INTERVIEW_CALL_TYPES, type InterviewCallType } from "@/lib/supabase/database.types";
import { JOBSITES } from "@/lib/jobsites";

export interface CountEntry {
  label: string;
  count: number;
}

export interface BidSuccessStats {
  bidCount: number;
  interviewBidCount: number;
  interviewRate: number;
}

export interface ModelRateEntry {
  model: string;
  bidCount: number;
  interviewBidCount: number;
  interviewRate: number;
}

export interface JobsiteRateEntry {
  jobsite: string;
  bidCount: number;
  interviewBidCount: number;
  interviewRate: number;
}

export function resolveBidStatusForStats(status: string | null | undefined): string {
  if (!status || status === "draft") return DEFAULT_BID_STATUS;
  return status;
}

export function isBidAdvanced(
  record: ResumeRecord,
  interviewCountForBid: number
): boolean {
  if (interviewCountForBid > 0) return true;
  return resolveBidStatusForStats(record.bid_status) !== DEFAULT_BID_STATUS;
}

export function buildInterviewsByResume<T extends { resume_id: string | null }>(
  interviews: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of interviews) {
    if (!row.resume_id) continue;
    const list = map.get(row.resume_id) ?? [];
    list.push(row);
    map.set(row.resume_id, list);
  }
  return map;
}

export function computeBidSuccessStats(
  records: ResumeRecord[],
  interviewsByResume: Map<string, { resume_id: string | null }[]>
): BidSuccessStats {
  let interviewBidCount = 0;

  for (const record of records) {
    const linked = interviewsByResume.get(record.id) ?? [];
    if (isBidAdvanced(record, linked.length)) {
      interviewBidCount += 1;
    }
  }

  const bidCount = records.length;
  const interviewRate =
    bidCount > 0 ? Math.round((interviewBidCount / bidCount) * 1000) / 10 : 0;

  return { bidCount, interviewBidCount, interviewRate };
}

export function computeModelSuccessStats(
  records: ResumeRecord[],
  interviewsByResume: Map<string, { resume_id: string | null }[]>
): ModelRateEntry[] {
  const byModel = new Map<string, ResumeRecord[]>();

  for (const record of records) {
    const model = record.model?.trim() || "Unknown";
    const list = byModel.get(model) ?? [];
    list.push(record);
    byModel.set(model, list);
  }

  return Array.from(byModel.entries())
    .map(([model, modelRecords]) => {
      const stats = computeBidSuccessStats(modelRecords, interviewsByResume);
      return {
        model,
        bidCount: stats.bidCount,
        interviewBidCount: stats.interviewBidCount,
        interviewRate: stats.interviewRate,
      };
    })
    .sort((a, b) => b.bidCount - a.bidCount || b.interviewRate - a.interviewRate);
}

export function jobsiteLabel(id: string | null): string {
  if (!id) return "Unknown";
  return JOBSITES.find((site) => site.id === id)?.label ?? id;
}

export function countByJobSite(records: ResumeRecord[]): CountEntry[] {
  const map = new Map<string, number>();
  for (const record of records) {
    const label = jobsiteLabel(record.job_site);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function computeJobsiteSuccessStats(
  records: ResumeRecord[],
  interviewsByResume: Map<string, { resume_id: string | null }[]>
): JobsiteRateEntry[] {
  const byJobsite = new Map<string, ResumeRecord[]>();

  for (const record of records) {
    const jobsite = jobsiteLabel(record.job_site);
    const list = byJobsite.get(jobsite) ?? [];
    list.push(record);
    byJobsite.set(jobsite, list);
  }

  return Array.from(byJobsite.entries())
    .map(([jobsite, jobsiteRecords]) => {
      const stats = computeBidSuccessStats(jobsiteRecords, interviewsByResume);
      return {
        jobsite,
        bidCount: stats.bidCount,
        interviewBidCount: stats.interviewBidCount,
        interviewRate: stats.interviewRate,
      };
    })
    .filter((entry) => entry.bidCount > 0)
    .sort((a, b) => b.bidCount - a.bidCount || b.interviewRate - a.interviewRate);
}

export const AI_PROVIDER_ORDER = [
  "openai",
  "anthropic",
  "deepseek",
  "google",
  "meta-llama",
  "mistralai",
] as const;

export function getLocalDateKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getTodayKey(): string {
  return getLocalDateKey(new Date());
}

export function isToday(iso: string): boolean {
  return getLocalDateKey(iso) === getTodayKey();
}

export function isInDateRange(iso: string, from: string, to: string): boolean {
  const key = getLocalDateKey(iso);
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

export function filterRecordsByDateRange(
  records: ResumeRecord[],
  from: string,
  to: string
): ResumeRecord[] {
  if (!from && !to) return records;
  return records.filter((record) => isInDateRange(record.created_at, from, to));
}

export function countByField(
  records: ResumeRecord[],
  field: "ai_type" | "model",
  fallback = "Unknown"
): CountEntry[] {
  const map = new Map<string, number>();
  for (const record of records) {
    const raw = field === "ai_type" ? record.ai_type : record.model;
    const key =
      field === "ai_type"
        ? (raw?.trim() || fallback).toLowerCase()
        : raw?.trim() || fallback;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function countByProvider(
  records: ResumeRecord[],
  { includeZero = false }: { includeZero?: boolean } = {}
): CountEntry[] {
  const map = new Map<string, number>();
  for (const record of records) {
    const key = (record.ai_type?.trim() || "unknown").toLowerCase();
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const ordered = AI_PROVIDER_ORDER.map((provider) => ({
    label: provider,
    count: map.get(provider) ?? 0,
  }));

  const extras = Array.from(map.entries())
    .filter(
      ([label]) => !AI_PROVIDER_ORDER.includes(label as (typeof AI_PROVIDER_ORDER)[number])
    )
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const all = [...ordered, ...extras];
  return includeZero ? all : all.filter((entry) => entry.count > 0);
}

export function getMonthStartKey(reference = new Date()): string {
  const y = reference.getFullYear();
  const m = String(reference.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/** Monday as the first day of the week. */
export function getWeekStartKey(reference = new Date()): string {
  const d = new Date(reference);
  const weekday = d.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  d.setDate(d.getDate() + diff);
  return getLocalDateKey(d);
}

export function shiftDateKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + days);
  return getLocalDateKey(d);
}

export function formatDisplayDate(key: string): string {
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShortDate(key: string): string {
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
  });
}

export interface DailyBidPoint {
  date: string;
  count: number;
}

export interface DailyInterviewPoint {
  date: string;
  bidCount: number;
  interviewBidCount: number;
  interviewRate: number;
}

export interface InterviewCallTypePoint {
  callType: string;
  label: string;
  total: number;
  progressing: number;
  failed: number;
  succeed: number;
}

type InterviewOutcome = "progressing" | "failed" | "succeed";

interface CallTypeBuckets {
  total: number;
  progressing: number;
  failed: number;
  succeed: number;
}

function emptyBuckets(): CallTypeBuckets {
  return { total: 0, progressing: 0, failed: 0, succeed: 0 };
}

function addOutcome(
  buckets: Map<string, CallTypeBuckets>,
  callType: string,
  outcome: InterviewOutcome
) {
  const current = buckets.get(callType) ?? emptyBuckets();
  current.total += 1;
  current[outcome] += 1;
  buckets.set(callType, current);
}

export function isBidRejected(status: string | null | undefined): boolean {
  return resolveBidStatusForStats(status) === "rejected";
}

export function isBidSucceeded(status: string | null | undefined): boolean {
  const resolved = resolveBidStatusForStats(status);
  return resolved === "offer" || resolved === "accepted";
}

const INTERVIEW_CALL_TYPE_LABELS: Record<string, string> = {
  intro: "Intro",
  hr: "HR",
  live_coding: "Live coding",
  system_design: "System design",
  culture: "Culture",
  final: "Final",
  unknown: "Unknown",
};

export function normalizeInterviewCallType(callType: string | null | undefined): string {
  return callType?.trim().toLowerCase() || "unknown";
}

export function interviewCallTypeLabel(callType: string): string {
  const key = normalizeInterviewCallType(callType);
  return INTERVIEW_CALL_TYPE_LABELS[key] ?? key.replace(/_/g, " ");
}

export function computeInterviewCallTypeStats(
  records: ResumeRecord[],
  interviewsByResume: Map<string, { interview_date: string; created_at: string; call_type: string | null }[]>
): InterviewCallTypePoint[] {
  const buckets = new Map<string, CallTypeBuckets>();

  for (const record of records) {
    const interviews = sortInterviewsChronologically(interviewsByResume.get(record.id) ?? []);
    if (interviews.length === 0) continue;

    if (isBidRejected(record.bid_status)) {
      interviews.forEach((interview, index) => {
        const callType = normalizeInterviewCallType(interview.call_type);
        const outcome: InterviewOutcome =
          index === interviews.length - 1 ? "failed" : "succeed";
        addOutcome(buckets, callType, outcome);
      });
      continue;
    }

    if (isBidSucceeded(record.bid_status)) {
      for (const interview of interviews) {
        addOutcome(buckets, normalizeInterviewCallType(interview.call_type), "succeed");
      }
      continue;
    }

    for (const interview of interviews) {
      addOutcome(buckets, normalizeInterviewCallType(interview.call_type), "progressing");
    }
  }

  const seen = new Set<string>();
  const orderedTypes: string[] = [];

  for (const type of INTERVIEW_CALL_TYPES) {
    if ((buckets.get(type)?.total ?? 0) > 0) {
      orderedTypes.push(type);
      seen.add(type);
    }
  }

  for (const type of buckets.keys()) {
    if (!seen.has(type) && (buckets.get(type)?.total ?? 0) > 0) {
      orderedTypes.push(type);
    }
  }


  return orderedTypes
    .map((callType) => ({ callType, ...(buckets.get(callType) ?? emptyBuckets()) }))
    .sort((a, b) => {
      const aIndex = INTERVIEW_CALL_TYPES.indexOf(a.callType as InterviewCallType);
      const bIndex = INTERVIEW_CALL_TYPES.indexOf(b.callType as InterviewCallType);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return b.total - a.total || a.callType.localeCompare(b.callType);
    })
    .map(({ callType, total, progressing, failed, succeed }) => ({
      callType,
      label: interviewCallTypeLabel(callType),
      total,
      progressing,
      failed,
      succeed,
    }));
}

export function sortInterviewsChronologically<T extends { interview_date: string; created_at: string }>(
  interviews: T[]
): T[] {
  return [...interviews].sort((a, b) => {
    const dateDiff =
      new Date(a.interview_date).getTime() - new Date(b.interview_date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function enumerateDateKeys(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];

  const keys: string[] = [];
  let current = from;
  while (current <= to) {
    keys.push(current);
    current = shiftDateKey(current, 1);
  }
  return keys;
}

export function computeDailyBidCounts(
  records: ResumeRecord[],
  from: string,
  to: string
): DailyBidPoint[] {
  const dates = enumerateDateKeys(from, to);
  const counts = new Map<string, number>(dates.map((date) => [date, 0]));

  for (const record of records) {
    const key = getLocalDateKey(record.created_at);
    if (!counts.has(key)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return dates.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

export function computeDailyInterviewStats(
  records: ResumeRecord[],
  interviewsByResume: Map<string, { resume_id: string | null }[]>,
  from: string,
  to: string
): DailyInterviewPoint[] {
  const dates = enumerateDateKeys(from, to);
  const byDate = new Map<string, ResumeRecord[]>(dates.map((date) => [date, []]));

  for (const record of records) {
    const key = getLocalDateKey(record.created_at);
    const list = byDate.get(key);
    if (!list) continue;
    list.push(record);
  }

  return dates.map((date) => {
    const stats = computeBidSuccessStats(byDate.get(date) ?? [], interviewsByResume);
    return {
      date,
      bidCount: stats.bidCount,
      interviewBidCount: stats.interviewBidCount,
      interviewRate: stats.interviewRate,
    };
  });
}

export function providerLabel(provider: string): string {
  if (provider === "Unknown") return provider;
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function providerBarHex(provider: string): string {
  switch (provider.toLowerCase()) {
    case "openai":
      return "#10b981";
    case "anthropic":
      return "#f59e0b";
    case "deepseek":
      return "#8b5cf6";
    default:
      return "#64748b";
  }
}

export function providerTextHex(provider: string): string {
  switch (provider.toLowerCase()) {
    case "openai":
      return "#047857";
    case "anthropic":
      return "#b45309";
    case "deepseek":
      return "#6d28d9";
    default:
      return "#475569";
  }
}

export function providerColor(provider: string): {
  bar: string;
  bg: string;
  text: string;
  ring: string;
} {
  switch (provider.toLowerCase()) {
    case "openai":
      return {
        bar: "bg-emerald-500",
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        ring: "stroke-emerald-500",
      };
    case "anthropic":
      return {
        bar: "bg-amber-500",
        bg: "bg-amber-50",
        text: "text-amber-700",
        ring: "stroke-amber-500",
      };
    case "deepseek":
      return {
        bar: "bg-violet-500",
        bg: "bg-violet-50",
        text: "text-violet-700",
        ring: "stroke-violet-500",
      };
    default:
      return {
        bar: "bg-slate-400",
        bg: "bg-slate-50",
        text: "text-slate-600",
        ring: "stroke-slate-400",
      };
  }
}
