import type { GeneralAppSettings } from "@/lib/general-app-settings";
import {
  getGeneralAppSettings,
  saveGeneralAppSettings,
} from "@/lib/supabase/services/app-settings";
import {
  pruneResumeHistoryWithoutInterviews,
  type PruneResumeHistoryResult,
} from "@/lib/supabase/services/prune-resume-history";

export const DEFAULT_WEEKLY_CLEANUP_HOUR = 3;
export const WEEKLY_CLEANUP_CHECK_INTERVAL_MS = 60 * 60 * 1000;

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function parseWeeklyCleanupHour(raw: string | undefined): number {
  const hour = Number(raw ?? DEFAULT_WEEKLY_CLEANUP_HOUR);
  if (!Number.isFinite(hour)) return DEFAULT_WEEKLY_CLEANUP_HOUR;
  return Math.min(23, Math.max(0, Math.round(hour)));
}

export function isWeeklyCleanupDue(
  now: Date,
  settings: GeneralAppSettings,
  cleanupHour = parseWeeklyCleanupHour(process.env.WEEKLY_CLEANUP_HOUR)
): boolean {
  if (now.getDay() !== 0) return false;
  if (now.getHours() < cleanupHour) return false;

  if (!settings.last_scheduled_prune_at) return true;

  const lastRun = new Date(settings.last_scheduled_prune_at);
  return !isSameLocalDay(lastRun, now);
}

export async function runManualResumePrune(): Promise<{
  settings: GeneralAppSettings;
  pruneResult: PruneResumeHistoryResult;
}> {
  const settings = await getGeneralAppSettings();
  const pruneResult = await pruneResumeHistoryWithoutInterviews(
    settings.prune_resume_no_interview_months
  );
  return { settings, pruneResult };
}

export async function runScheduledResumePruneIfDue(
  now = new Date()
): Promise<PruneResumeHistoryResult | null> {
  const settings = await getGeneralAppSettings();
  const cleanupHour = parseWeeklyCleanupHour(process.env.WEEKLY_CLEANUP_HOUR);

  if (!isWeeklyCleanupDue(now, settings, cleanupHour)) {
    return null;
  }

  const pruneResult = await pruneResumeHistoryWithoutInterviews(
    settings.prune_resume_no_interview_months
  );

  await saveGeneralAppSettings({
    ...settings,
    last_scheduled_prune_at: now.toISOString(),
  });

  return pruneResult;
}
