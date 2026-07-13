import {
  DEFAULT_WEEKLY_CLEANUP_HOUR,
  runScheduledResumePruneIfDue,
  WEEKLY_CLEANUP_CHECK_INTERVAL_MS,
} from "@/lib/supabase/services/scheduled-prune";
import { isSupabaseNetworkError } from "@/lib/supabase/network";

export function startWeeklyCleanupScheduler(): void {
  if (process.env.WEEKLY_CLEANUP_ENABLED === "false") {
    console.log("[weekly-cleanup] Disabled via WEEKLY_CLEANUP_ENABLED=false");
    return;
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[weekly-cleanup] Skipped — SUPABASE_SERVICE_ROLE_KEY is not set");
    return;
  }

  const cleanupHour = Number(process.env.WEEKLY_CLEANUP_HOUR ?? DEFAULT_WEEKLY_CLEANUP_HOUR);
  let running = false;

  const check = async () => {
    if (running) return;
    running = true;

    try {
      const result = await runScheduledResumePruneIfDue();
      if (result) {
        console.log(
          `[weekly-cleanup] Removed ${result.deletedCount} bid(s) older than ${result.months} month(s) with no interview (cutoff ${result.cutoffDate}).`
        );
      }
    } catch (error) {
      if (isSupabaseNetworkError(error)) {
        console.warn(
          "[weekly-cleanup] Skipped — cannot reach Supabase (check VPN/proxy or project status)."
        );
      } else {
        console.error("[weekly-cleanup] Failed:", error);
      }
    } finally {
      running = false;
    }
  };

  console.log(
    `[weekly-cleanup] Scheduled every Sunday at ${cleanupHour}:00 (server local time).`
  );

  void check();
  setInterval(() => void check(), WEEKLY_CLEANUP_CHECK_INTERVAL_MS);
}
