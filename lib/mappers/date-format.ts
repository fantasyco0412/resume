/** Convert ISO date (YYYY-MM-DD) or partial ISO to MM/YYYY for display and AI prompts. */
export function isoDateToDisplay(date: string | null | undefined): string {
  if (!date?.trim()) return "";

  const trimmed = date.trim();
  if (/^\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
  if (trimmed.toLowerCase() === "present") return "Present";

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (isoMatch) {
    return `${isoMatch[2]}/${isoMatch[1]}`;
  }

  return trimmed;
}

/** Convert MM/YYYY (or Present) to ISO date (YYYY-MM-01) for Postgres date columns. */
export function displayDateToIso(date: string | null | undefined): string | null {
  if (!date?.trim()) return null;

  const trimmed = date.trim();
  if (trimmed.toLowerCase() === "present") return null;

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, "0");
    return `${slashMatch[2]}-${month}-01`;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-01`;
  }

  return null;
}

export function formatCompanyEndDate(
  endDate: string | null | undefined,
  isCurrent: boolean
): string {
  if (isCurrent) return "Present";
  return isoDateToDisplay(endDate) || "Present";
}

export function formatGpa(gpa: number | null | undefined): string | undefined {
  if (gpa == null || Number.isNaN(gpa)) return undefined;
  return String(gpa);
}
