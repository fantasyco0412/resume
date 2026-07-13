export type JobWorkType = "onsite" | "hybrid" | "remote" | "unknown";

export function buildJobPageExtractPrompt(
  pageContent: string,
  referenceDate: Date = new Date()
): string {
  const todayLabel = referenceDate.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `You extract structured job posting data from raw page text (often copied from LinkedIn, Indeed, Greenhouse, etc.).

Today's date: ${todayLabel}

Return ONLY valid JSON with this exact shape:
{
  "jobTitle": "string",
  "companyName": "string",
  "jobDescription": "string",
  "jobLocation": "string",
  "industry": "string",
  "securityClearance": "string",
  "jobTypes": ["remote" | "hybrid" | "onsite"],
  "requiresTravel": false,
  "salary": "string",
  "postedDate": "string"
}

Rules:
- jobTitle: the role title only (e.g. "Senior Software Engineer"). No company name, no location, no employment type.
- companyName: hiring company only. No "via", no staffing agency unless that is clearly the employer.
- jobDescription: clean job description body — responsibilities, requirements, qualifications. Remove nav menus, footers, "Apply now", similar jobs, cookie banners, and duplicate headers. Keep bullet lists with one bullet per line (use • or -). Separate sections with a blank line. Preserve paragraph breaks.
- jobLocation: where the role is based — city/state/country, region, or "Remote" / "Remote (US)" when the posting specifies a remote location constraint. Use "" if not stated. Do not repeat the company HQ unless it is clearly the job location.
- industry: primary industry or domain (e.g. "Healthcare", "Financial Services", "Defense & Government", "SaaS", "Retail"). Infer from company context and JD wording when explicit. Use "" if unclear — do not guess.
- securityClearance: required U.S. security clearance if stated (e.g. "Secret", "Top Secret", "TS/SCI", "TS/SCI + CI Poly", "Public Trust (Moderate)", "Eligible to obtain clearance"). Use "" if none is required or not mentioned. Do not infer clearance from generic defense/government context alone.
- jobTypes: list ALL possible work arrangements supported by the posting (can be more than one):
  - If explicitly "fully remote" / "100% remote" with no in-office option → ["remote"]
  - If duties may be performed remotely AND in an office/laboratory/on-site (flexible wording like "remotely, in an office, or in a laboratory") → ["remote", "hybrid"]
  - If explicit hybrid → include "hybrid"; also include "remote" if remote work is mentioned
  - If in-office/on-site only with no remote option → ["onsite"]
  - Use an empty array only if work location is truly not mentioned
- requiresTravel: true if the posting mentions required/expected travel (business travel, % travel, willingness to travel, etc.)
- salary: compensation text if present (e.g. "$120k–$150k", "$50/hr"). Use "" if not found.
- postedDate: posting date as a calendar date using today's date above (e.g. "Jul 9, 2026", "2026-07-09"). If the page shows relative text ("today", "yesterday", "3 days ago"), convert using today's date. Use the current year unless the posting explicitly shows a different year. Use "" if no posted/reposted date appears.
- Do not invent facts not supported by the text.

Page content:
"""
${pageContent}
"""`;
}

export function formatJobWorkTypeLabel(jobType: JobWorkType): string {
  switch (jobType) {
    case "onsite":
      return "Onsite";
    case "hybrid":
      return "Hybrid";
    case "remote":
      return "Remote";
    default:
      return "Unknown";
  }
}

export function formatJobWorkTypesLabel(jobTypes: JobWorkType[]): string {
  const labels = jobTypes
    .filter((type) => type !== "unknown")
    .map((type) => formatJobWorkTypeLabel(type));
  return labels.length > 0 ? labels.join(" · ") : "Unknown";
}
