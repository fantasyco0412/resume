import type { JobWorkType } from "@/lib/prompts/job-page-extract";
import { normalizeJobWorkType } from "@/lib/job-work-type";

export function jobTypesForStorage(jobTypes: JobWorkType[] | null | undefined): string[] {
  if (!Array.isArray(jobTypes)) return [];
  return jobTypes
    .map((type) => normalizeJobWorkType(type))
    .filter((type) => type !== "unknown");
}

export function parseStoredJobTypes(
  jobTypes: string[] | null | undefined
): JobWorkType[] {
  if (!Array.isArray(jobTypes)) return [];
  return jobTypes.map((type) => normalizeJobWorkType(type));
}

export function optionalCostUsd(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

export function optionalText(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function optionalAtsScore(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 100) return null;
  return rounded;
}
