import type { ProfileBundle } from "@/lib/supabase/database.types";
import { userCompanyToResumeExperience } from "@/lib/mappers/profile-to-resume";

export function parseExperienceDate(dateStr: string): Date {
  if (!dateStr || String(dateStr).toLowerCase() === "present") {
    return new Date();
  }

  const parts = String(dateStr).trim().split("/");
  if (parts.length >= 2) {
    const month = parseInt(parts[0], 10) || 1;
    const year = parseInt(parts[1], 10);
    if (!Number.isNaN(year)) {
      return new Date(year, month - 1);
    }
  }

  return new Date();
}

export function getTenureYears(startDate: string, endDate: string): number {
  const start = parseExperienceDate(startDate);
  const end = parseExperienceDate(endDate);
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  return Math.max(0.25, months / 12);
}

/** Bullet count scaled to time in role — looks natural on a 1-page resume. */
export function getBulletCountForTenure(tenureYears: number): number {
  if (tenureYears < 1) return 4;
  if (tenureYears < 2) return 5;
  if (tenureYears < 3) return 6;
  if (tenureYears < 4) return 7;
  if (tenureYears < 5) return 8;
  return 9;
}

export interface ExperienceBulletTarget {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  tenureYears: number;
  bulletCount: number;
}

export function getBulletTargetsForExperience(
  experience: Array<{
    title?: string;
    company?: string;
    startDate?: string;
    endDate?: string;
  }>
): ExperienceBulletTarget[] {
  return experience.map((exp) => {
    const tenureYears = getTenureYears(exp.startDate || "", exp.endDate || "Present");
    return {
      title: exp.title || "Role",
      company: exp.company || "Company",
      startDate: exp.startDate || "",
      endDate: exp.endDate || "Present",
      tenureYears,
      bulletCount: getBulletCountForTenure(tenureYears),
    };
  });
}

type LegacyCompanySlot = {
  title?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
} | null;

export type LegacyCompanyProfile = {
  company_1?: LegacyCompanySlot;
  company_2?: LegacyCompanySlot;
  company_3?: LegacyCompanySlot;
  company_4?: LegacyCompanySlot;
  company_5?: LegacyCompanySlot;
};

export function buildBulletGuidanceFromCompanies(
  companies: Array<{
    title?: string;
    company?: string;
    startDate?: string;
    endDate?: string;
  }>
): string {
  if (companies.length === 0) return "";

  const sorted = [...companies].sort((a, b) => {
    const aEnd = parseExperienceDate(a.endDate || "Present").getTime();
    const bEnd = parseExperienceDate(b.endDate || "Present").getTime();
    if (aEnd !== bEnd) return bEnd - aEnd;
    return (
      parseExperienceDate(b.startDate || "").getTime() -
      parseExperienceDate(a.startDate || "").getTime()
    );
  });

  const targets = getBulletTargetsForExperience(sorted);
  const lines = targets.map((t, i) => {
    const tenureLabel =
      t.tenureYears < 1
        ? `${Math.round(t.tenureYears * 12)} months`
        : `${t.tenureYears.toFixed(1).replace(/\.0$/, "")} years`;
    return `${i + 1}. ${t.title} at ${t.company} (${t.startDate} – ${t.endDate}, ~${tenureLabel}): EXACTLY ${t.bulletCount} achievement bullets`;
  });

  return `
----------------------------------------
EXPERIENCE BULLET TARGETS (MANDATORY)
----------------------------------------
Include every role below in the experience array (most recent first).
Generate EXACTLY the bullet count shown for each role — not fewer, not more.
Shorter tenures get fewer bullets; longer tenures get more. This keeps the resume credible.

${lines.join("\n")}
`;
}

export function buildBulletGuidanceFromProfile(
  profileData: LegacyCompanyProfile | ProfileBundle
): string {
  const companies =
    "companies" in profileData
      ? profileData.companies.map(userCompanyToResumeExperience)
      : ([
          profileData.company_1,
          profileData.company_2,
          profileData.company_3,
          profileData.company_4,
          profileData.company_5,
        ].filter(Boolean) as Array<{
          title?: string;
          company?: string;
          startDate?: string;
          endDate?: string;
        }>);

  return buildBulletGuidanceFromCompanies(companies);
}

export function formatTenureLabel(years: number): string {
  if (years < 1) return `${Math.round(years * 12)} months`;
  return `${years.toFixed(1).replace(/\.0$/, "")} years`;
}
