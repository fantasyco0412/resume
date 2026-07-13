export const JOBSITES = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "ziprecruiter", label: "ZipRecruiter" },
  { id: "indeed", label: "Indeed" },
  { id: "glassdoor", label: "Glassdoor" },
  { id: "dice", label: "Dice" },
  { id: "jobright", label: "JobRight" },
  { id: "cord", label: "Cord" },
  { id: "greenhouse", label: "Greenhouse" },
  { id: "lever", label: "Lever" },
  { id: "workday", label: "Workday" },
  { id: "other", label: "Other" },
] as const;

export type JobsiteId = (typeof JOBSITES)[number]["id"];

export const DEFAULT_JOBSITE: JobsiteId = "linkedin";

export function isValidJobsite(id: string): id is JobsiteId {
  return JOBSITES.some((site) => site.id === id);
}

export function resolveJobsite(saved: string | undefined): JobsiteId {
  if (saved && isValidJobsite(saved)) return saved;
  return DEFAULT_JOBSITE;
}

export function getJobsiteLabel(id: JobsiteId): string {
  return JOBSITES.find((site) => site.id === id)?.label ?? "LinkedIn";
}
