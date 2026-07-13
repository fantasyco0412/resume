import { cutoffDateForMonths } from "@/lib/general-app-settings";
import type { ResumeRecord } from "@/lib/supabase/database.types";
import { createServiceSupabaseClient } from "@/lib/supabase/service-client";
import {
  buildCoverLetterJsonStoragePath,
  deleteCoverLetterJson,
  deleteJd,
  deleteResumeJson,
} from "@/lib/supabase/storage";

export interface PruneResumeHistoryResult {
  months: number;
  cutoffDate: string;
  deletedCount: number;
}

async function deleteResumeArtifacts(record: ResumeRecord): Promise<void> {
  const client = createServiceSupabaseClient();
  const tasks: Promise<void>[] = [];

  if (record.jd_file_path) {
    tasks.push(deleteJd(record.jd_file_path, client).catch(() => undefined));
  }
  if (record.resume_file_path) {
    tasks.push(deleteResumeJson(record.resume_file_path, client).catch(() => undefined));
  }

  tasks.push(
    deleteCoverLetterJson(
      buildCoverLetterJsonStoragePath(record.user_id, record.id),
      client
    ).catch(() => undefined)
  );

  await Promise.all(tasks);
}

export async function pruneResumeHistoryWithoutInterviews(
  months: number
): Promise<PruneResumeHistoryResult> {
  const client = createServiceSupabaseClient();
  const cutoff = cutoffDateForMonths(months);
  const cutoffIso = cutoff.toISOString();

  const { data: interviews, error: interviewsError } = await client
    .from("interview_history")
    .select("resume_id")
    .not("resume_id", "is", null);

  if (interviewsError) throw interviewsError;

  const interviewedResumeIds = new Set(
    (interviews ?? [])
      .map((row) => row.resume_id)
      .filter((resumeId): resumeId is string => Boolean(resumeId))
  );

  const { data: resumes, error: resumesError } = await client
    .from("resume_history")
    .select("*")
    .lt("created_at", cutoffIso);

  if (resumesError) throw resumesError;

  const toDelete = ((resumes ?? []) as ResumeRecord[]).filter(
    (record) => !interviewedResumeIds.has(record.id)
  );

  for (const record of toDelete) {
    await deleteResumeArtifacts(record);

    const { error } = await client.from("resume_history").delete().eq("id", record.id);
    if (error) throw error;
  }

  return {
    months,
    cutoffDate: cutoffIso,
    deletedCount: toDelete.length,
  };
}
