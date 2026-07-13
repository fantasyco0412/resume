import type { JobWorkType } from "@/lib/prompts/job-page-extract";

export interface JobWorkTypeAnalysis {
  /** Possible work arrangements (excludes unknown when empty uses unknown). */
  jobTypes: JobWorkType[];
  /** Primary type for backward compatibility. */
  jobType: JobWorkType;
  requiresTravel: boolean;
}

const FULLY_REMOTE_PATTERN =
  /\b(fully remote|100% remote|remote[- ]only|completely remote|entirely remote|remote-first with no office)\b/i;

const REMOTE_PATTERN =
  /\b(remote(?:ly)?|work from home|wfh|telecommute|work from anywhere|virtual(?:ly)?|distributed team)\b/i;

const OFFICE_OR_ONSITE_PATTERN =
  /\b(in[-\s]?office|in[-\s]?person|on[-\s]?site|office[-\s]?based|in an office|in a laboratory|laboratory setting|at (?:the )?office|office setting|in the office)\b/i;

const HYBRID_PATTERN = /\bhybrid\b/i;

const TRAVEL_PATTERN =
  /\b(travel required|must travel|requires travel|business travel|willingness to travel|ability to travel|\d{1,3}%\s*travel|up to \d{1,3}% travel)\b/i;

const TRAVEL_LOOSE_PATTERN =
  /\b(travel|traveling|travelling)\b[\s\S]{0,40}\b(required|expect(?:ed)?|occasional(?:ly)?|frequent(?:ly)?|up to)\b/i;

export function mentionsJobTravel(text: string): boolean {
  const sample = String(text || "");
  return TRAVEL_PATTERN.test(sample) || TRAVEL_LOOSE_PATTERN.test(sample);
}

function isFullyRemote(text: string): boolean {
  return FULLY_REMOTE_PATTERN.test(text);
}

function mentionsRemote(text: string): boolean {
  return REMOTE_PATTERN.test(text);
}

function mentionsOfficeOrOnsite(text: string): boolean {
  return OFFICE_OR_ONSITE_PATTERN.test(text);
}

function mentionsHybrid(text: string): boolean {
  return HYBRID_PATTERN.test(text);
}

export function normalizeJobWorkType(value: unknown): JobWorkType {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "unknown";
  if (raw.includes("hybrid")) return "hybrid";
  if (raw.includes("remote") || raw.includes("work from home") || raw.includes("wfh")) {
    return "remote";
  }
  if (raw.includes("onsite") || raw.includes("on-site") || raw.includes("in office")) {
    return "onsite";
  }
  if (raw === "onsite" || raw === "hybrid" || raw === "remote") return raw;
  return "unknown";
}

function normalizeJobWorkTypeList(value: unknown): JobWorkType[] {
  if (!Array.isArray(value)) return [];
  const types = value
    .map((item) => normalizeJobWorkType(item))
    .filter((item) => item !== "unknown");
  return [...new Set(types)];
}

function sortJobTypes(types: JobWorkType[]): JobWorkType[] {
  const order: JobWorkType[] = ["remote", "hybrid", "onsite"];
  return [...new Set(types)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/**
 * Infer possible job work types from posting text.
 *
 * - Explicit fully remote (no office/lab) → Remote only
 * - Remote + office/lab/onsite options → Remote + Hybrid
 * - Explicit hybrid → Hybrid (+ Remote if remote also mentioned)
 * - Onsite/office only → Onsite
 */
export function analyzeJobWorkType(
  text: string,
  aiHint?: unknown,
  aiTypesHint?: unknown
): JobWorkTypeAnalysis {
  const sample = String(text || "");
  const requiresTravel = mentionsJobTravel(sample);
  const types = new Set<JobWorkType>();

  const fullyRemote = isFullyRemote(sample);
  const remote = mentionsRemote(sample);
  const office = mentionsOfficeOrOnsite(sample);
  const hybrid = mentionsHybrid(sample);

  if (fullyRemote && !office) {
    types.add("remote");
  } else if (remote && office) {
    types.add("remote");
    types.add("hybrid");
  } else if (hybrid) {
    types.add("hybrid");
    if (remote) types.add("remote");
  } else if (remote) {
    types.add("remote");
  } else if (office) {
    types.add("onsite");
  }

  for (const hint of normalizeJobWorkTypeList(aiTypesHint)) {
    types.add(hint);
  }

  const singleHint = normalizeJobWorkType(aiHint);
  if (singleHint !== "unknown") {
    if (singleHint === "hybrid" && remote) {
      types.add("remote");
      types.add("hybrid");
    } else if (singleHint === "onsite" && remote && office) {
      types.add("remote");
      types.add("hybrid");
    } else {
      types.add(singleHint);
    }
  }

  let jobTypes = sortJobTypes([...types]);
  if (jobTypes.length === 0) {
    jobTypes = ["unknown"];
  }

  return {
    jobTypes,
    jobType: jobTypes[0] ?? "unknown",
    requiresTravel,
  };
}

export function jobWorkTypeBadgeClass(jobType: JobWorkType): string {
  switch (jobType) {
    case "remote":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
    case "hybrid":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
    case "onsite":
      return "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  }
}

export function jobTypesIncludeHybridOrOnsite(jobTypes: JobWorkType[]): boolean {
  return jobTypes.includes("hybrid") || jobTypes.includes("onsite");
}

export function extractedJobIsHybridOrOnsite(input: {
  jobType?: JobWorkType;
  jobTypes?: JobWorkType[];
}): boolean {
  if (jobTypesIncludeHybridOrOnsite(input.jobTypes ?? [])) return true;
  return input.jobType === "hybrid" || input.jobType === "onsite";
}
