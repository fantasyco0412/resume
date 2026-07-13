export const APP_SETTINGS_GENERAL_KEY = "general";

export const DEFAULT_PRUNE_RESUME_NO_INTERVIEW_MONTHS = 4;

export interface GeneralAppSettings {
  prune_resume_no_interview_months: number;
  /** ISO timestamp of the last automatic Sunday cleanup. */
  last_scheduled_prune_at: string | null;
}

export const DEFAULT_GENERAL_APP_SETTINGS: GeneralAppSettings = {
  prune_resume_no_interview_months: DEFAULT_PRUNE_RESUME_NO_INTERVIEW_MONTHS,
  last_scheduled_prune_at: null,
};

export function parseGeneralAppSettings(value: unknown): GeneralAppSettings {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const months = Number(raw.prune_resume_no_interview_months);
  const lastScheduled =
    typeof raw.last_scheduled_prune_at === "string" ? raw.last_scheduled_prune_at : null;

  return {
    prune_resume_no_interview_months:
      Number.isFinite(months) && months >= 1 && months <= 24
        ? Math.round(months)
        : DEFAULT_PRUNE_RESUME_NO_INTERVIEW_MONTHS,
    last_scheduled_prune_at: lastScheduled,
  };
}

export function generalAppSettingsToJson(settings: GeneralAppSettings): GeneralAppSettings {
  return {
    prune_resume_no_interview_months: settings.prune_resume_no_interview_months,
    last_scheduled_prune_at: settings.last_scheduled_prune_at,
  };
}

export function cutoffDateForMonths(months: number, now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return cutoff;
}
