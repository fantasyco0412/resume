import type { ApplyAlertSettings } from "@/lib/apply-alert-settings";
import {
  findDuplicateCompanyApplications,
  type DuplicateApplicationMatch,
} from "@/lib/apply-alerts";
import { extractedJobIsHybridOrOnsite } from "@/lib/job-work-type";
import type { JobWorkType } from "@/lib/prompts/job-page-extract";
import type { ResumeRecord } from "@/lib/supabase/database.types";

export interface GeneratePreflightSession {
  id: string;
  jobTitle: string;
  companyName: string;
  jobType: JobWorkType;
  jobTypes: JobWorkType[];
}

export interface FlaggedGenerateSession {
  sessionId: string;
  jobTitle: string;
  companyName: string;
  duplicateMatches: DuplicateApplicationMatch[];
  showHybridOnsite: boolean;
}

export async function scanGenerateApplyAlerts(
  sessions: GeneratePreflightSession[],
  sessionIds: string[],
  settings: ApplyAlertSettings,
  loadRecords: () => Promise<ResumeRecord[]>
): Promise<FlaggedGenerateSession[]> {
  const idSet = new Set(sessionIds);
  const targets = sessions.filter((session) => idSet.has(session.id));
  if (targets.length === 0) return [];

  let records: ResumeRecord[] = [];
  const needsDuplicateCheck =
    settings.duplicate_apply_alert_enabled &&
    targets.some((session) => session.companyName.trim());

  if (needsDuplicateCheck) {
    try {
      records = await loadRecords();
    } catch {
      records = [];
    }
  }

  const flagged: FlaggedGenerateSession[] = [];

  for (const session of targets) {
    let duplicateMatches: DuplicateApplicationMatch[] = [];

    if (settings.duplicate_apply_alert_enabled && session.companyName.trim()) {
      duplicateMatches = findDuplicateCompanyApplications(
        records,
        session.companyName,
        settings.duplicate_apply_months
      );
    }

    const showHybridOnsite =
      settings.hybrid_onsite_alert_enabled &&
      extractedJobIsHybridOrOnsite({
        jobType: session.jobType,
        jobTypes: session.jobTypes,
      });

    if (duplicateMatches.length > 0 || showHybridOnsite) {
      flagged.push({
        sessionId: session.id,
        jobTitle: session.jobTitle,
        companyName: session.companyName,
        duplicateMatches,
        showHybridOnsite,
      });
    }
  }

  return flagged;
}
