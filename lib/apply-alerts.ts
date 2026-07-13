import type { ResumeRecord } from "@/lib/supabase/database.types";

export interface DuplicateApplicationMatch {
  date: string;
  company: string;
  role: string;
}

function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+(inc|llc|ltd|corp|corporation|co|company)\.?$/i, "")
    .replace(/\s+/g, " ");
}

function monthsAgoDate(months: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() - months);
  return date;
}

export function findDuplicateCompanyApplications(
  records: ResumeRecord[],
  companyName: string,
  months: number
): DuplicateApplicationMatch[] {
  const target = normalizeCompanyName(companyName);
  if (!target) return [];

  const cutoff = monthsAgoDate(months);

  return records
    .filter((record) => {
      const company = record.job_company?.trim();
      if (!company) return false;
      if (normalizeCompanyName(company) !== target) return false;
      return new Date(record.created_at) >= cutoff;
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .map((record) => ({
      date: new Date(record.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      company: record.job_company?.trim() || "Unknown company",
      role: record.job_title?.trim() || "Untitled role",
    }));
}

const HYBRID_ONSITE_PATTERN =
  /\b(hybrid|on[-\s]?site|in[-\s]?office|office[-\s]?based)\b/i;

export function jobContainsHybridOrOnsite(text: string): boolean {
  return HYBRID_ONSITE_PATTERN.test(text);
}

export function formatDuplicateApplicationsMessage(
  matches: DuplicateApplicationMatch[],
  months: number
): string {
  const period = months === 1 ? "the last month" : `the last ${months} months`;
  const lines = matches.map(
    (item) => `• ${item.date} — ${item.company} — ${item.role}`
  );
  return (
    `You already applied to this company within ${period}:\n\n` +
    lines.join("\n")
  );
}

export function formatHybridOnsiteMessage(): string {
  return (
    "This job description mentions hybrid or onsite work. " +
    "Review the location requirements before applying."
  );
}
