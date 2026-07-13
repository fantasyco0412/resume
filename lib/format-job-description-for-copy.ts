import { formatJobWorkTypeLabel } from "@/lib/prompts/job-page-extract";
import type { JobWorkType } from "@/lib/prompts/job-page-extract";
import { prepareJobDescriptionForDisplay } from "@/lib/normalize-job-description";

export interface JobDescriptionCopyHeader {
  jobTitle?: string | null;
  companyName?: string | null;
  jobLocation?: string | null;
  industry?: string | null;
  securityClearance?: string | null;
  salary?: string | null;
  postedDate?: string | null;
  jobTypes?: JobWorkType[] | null;
  requiresTravel?: boolean | null;
}

export function formatJobDescriptionForCopy(
  jobDescription: string,
  header?: JobDescriptionCopyHeader
): string {
  const body = prepareJobDescriptionForDisplay(jobDescription);
  const lines: string[] = [];

  const title = String(header?.jobTitle ?? "").trim();
  const company = String(header?.companyName ?? "").trim();
  const jobLocation = String(header?.jobLocation ?? "").trim();
  const industry = String(header?.industry ?? "").trim();
  const securityClearance = String(header?.securityClearance ?? "").trim();
  const salary = String(header?.salary ?? "").trim();
  const postedDate = String(header?.postedDate ?? "").trim();
  const jobTypes = (header?.jobTypes ?? []).filter((type) => type !== "unknown");
  const requiresTravel = Boolean(header?.requiresTravel);

  if (title) {
    const titleLine = [title, company, industry].filter(Boolean).join(" · ");
    lines.push(titleLine);
  }

  const detailParts = [
    jobLocation,
    jobTypes.length > 0
      ? jobTypes.map((type) => formatJobWorkTypeLabel(type)).join(" · ")
      : "",
    postedDate ? `Posted ${postedDate}` : "",
    salary ? `Pay: ${salary}` : "",
    securityClearance ? `Clearance: ${securityClearance}` : "",
    requiresTravel ? "Travel required" : "",
  ].filter(Boolean);
  if (detailParts.length > 0) lines.push(detailParts.join(" · "));

  if (lines.length > 0 && body) {
    lines.push("", "—".repeat(40), "");
  }

  if (body) lines.push(body);

  return lines.join("\n").trim();
}
