/** Try to pull a posted/reposted date line from raw job page text (LinkedIn, Indeed, etc.). */
export function extractPostedDateFromText(pageContent: string): string {
  const text = pageContent.replace(/\s+/g, " ").trim();
  if (!text) return "";

  const patterns = [
    /\b(?:reposted|posted)\s+(?:on\s+)?(\d+\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?)\s+ago)\b/i,
    /\b(?:reposted|posted)\s+(?:on\s+)?(today|yesterday)\b/i,
    /\b(?:reposted|posted)\s+(?:on\s+)?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/i,
    /\b(?:reposted|posted)\s+(?:on\s+)?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/i,
    /\b(?:reposted|posted)\s+(?:on\s+)?(\d{4}-\d{2}-\d{2})\b/i,
    /\b(?:date posted|posting date|posted date)[:\s]+([^|•\n]{4,40})/i,
    /\b(?:reposted|posted)\s+(?:on\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})\b/i,
    /\b(today|yesterday)\b/i,
    /\b(\d+\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?)\s+ago)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim().replace(/\s+/g, " ");
    if (value && value.length <= 48) {
      return normalizePostedDate(value);
    }
  }

  return "";
}

function startOfLocalDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatPostedDateValue(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function parseAbsolutePostedDate(text: string): Date | null {
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const date = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return Number.isNaN(date.getTime()) ? null : startOfLocalDay(date);
  }

  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    let year = Number(slashMatch[3]);
    if (year < 100) year += 2000;
    const date = new Date(year, Number(slashMatch[1]) - 1, Number(slashMatch[2]));
    return Number.isNaN(date.getTime()) ? null : startOfLocalDay(date);
  }

  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) {
    return startOfLocalDay(new Date(parsed));
  }

  return null;
}

function parseRelativePostedDate(text: string, now = new Date()): Date | null {
  const lower = text.toLowerCase().trim();
  const today = startOfLocalDay(now);

  if (lower === "today") return today;

  if (lower === "yesterday") {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    return date;
  }

  const agoMatch = lower.match(
    /^(\d+)\s+(second|minute|hour|day|week|month)s?\s+ago$/
  );
  if (agoMatch) {
    const amount = Number(agoMatch[1]);
    const unit = agoMatch[2];
    const date = new Date(now);

    switch (unit) {
      case "second":
        date.setSeconds(date.getSeconds() - amount);
        break;
      case "minute":
        date.setMinutes(date.getMinutes() - amount);
        break;
      case "hour":
        date.setHours(date.getHours() - amount);
        break;
      case "day":
        date.setDate(date.getDate() - amount);
        break;
      case "week":
        date.setDate(date.getDate() - amount * 7);
        break;
      case "month":
        date.setMonth(date.getMonth() - amount);
        break;
    }

    return startOfLocalDay(date);
  }

  return null;
}

function adjustLikelyWrongPostingYear(date: Date, now = new Date()): Date {
  const today = startOfLocalDay(now);
  const year = date.getFullYear();
  const currentYear = today.getFullYear();

  if (year !== currentYear - 1) return date;

  const corrected = startOfLocalDay(
    new Date(currentYear, date.getMonth(), date.getDate())
  );
  const maxAgeMs = 60 * 24 * 60 * 60 * 1000;

  if (
    corrected <= today &&
    today.getTime() - corrected.getTime() <= maxAgeMs
  ) {
    return corrected;
  }

  return date;
}

export function pageHasRelativePostedDate(text: string): boolean {
  return (
    /\b(?:reposted|posted)\s+(?:on\s+)?(?:today|yesterday|\d+\s+(?:days?|weeks?|hours?)\s+ago)\b/i.test(
      text
    ) || /\b(today|yesterday|\d+\s+days?\s+ago)\b/i.test(text)
  );
}

export function normalizePostedDate(value: unknown, now = new Date()): string {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (/^(none|null|n\/a|unknown|not found)$/i.test(normalized)) return "";

  const withoutPrefix = normalized
    .replace(/^(?:reposted|posted)\s+(?:on\s+)?/i, "")
    .trim();
  const candidate = (withoutPrefix || normalized).slice(0, 64);

  const relative = parseRelativePostedDate(candidate, now);
  if (relative) return formatPostedDateValue(relative);

  const absolute = parseAbsolutePostedDate(candidate);
  if (absolute) {
    return formatPostedDateValue(adjustLikelyWrongPostingYear(absolute, now));
  }

  return candidate;
}
