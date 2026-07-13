import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type {
  InterviewCallType,
  InterviewRecord,
  ResumeRecord,
} from "@/lib/supabase/database.types";
import { DEFAULT_BID_STATUS } from "@/lib/supabase/database.types";
import { generateId } from "@/lib/generate-id";
import { updateResumeBidStatus } from "@/lib/supabase/services/resumes";

export interface InterviewFormInput {
  resume_id?: string | null;
  interview_date: string;
  caller?: string | null;
  interviewer?: string | null;
  call_type?: InterviewCallType | null;
  video_name?: string | null;
  note?: string | null;
}

export async function listInterviews(
  userId: string,
  client: SupabaseClient = supabase
): Promise<InterviewRecord[]> {
  const { data, error } = await client
    .from("interview_history")
    .select("*")
    .eq("user_id", userId)
    .order("interview_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as InterviewRecord[];
}

export interface CreateInterviewResult {
  interview: InterviewRecord;
  resume?: ResumeRecord;
}

function isAppliedStatus(status: string | null | undefined): boolean {
  if (!status || status === "draft") return true;
  return status === DEFAULT_BID_STATUS;
}

export async function createInterview(
  userId: string,
  input: InterviewFormInput,
  client: SupabaseClient = supabase
): Promise<CreateInterviewResult> {
  let isFirstInterview = false;

  if (input.resume_id) {
    const { count, error: countError } = await client
      .from("interview_history")
      .select("*", { count: "exact", head: true })
      .eq("resume_id", input.resume_id);

    if (countError) throw countError;
    isFirstInterview = (count ?? 0) === 0;
  }

  const { data, error } = await client
    .from("interview_history")
    .insert({
      id: generateId(),
      user_id: userId,
      resume_id: input.resume_id ?? null,
      interview_date: input.interview_date,
      caller: input.caller ?? null,
      interviewer: input.interviewer ?? null,
      call_type: input.call_type ?? null,
      video_name: input.video_name ?? null,
      note: input.note ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;

  let resume: ResumeRecord | undefined;

  if (input.resume_id && isFirstInterview) {
    const { data: resumeRow, error: resumeError } = await client
      .from("resume_history")
      .select("bid_status")
      .eq("id", input.resume_id)
      .single();

    if (resumeError) throw resumeError;

    if (isAppliedStatus(resumeRow.bid_status)) {
      resume = await updateResumeBidStatus(input.resume_id, "interviewing", client);
    }
  }

  return { interview: data as InterviewRecord, resume };
}

export async function updateInterview(
  interviewId: string,
  input: Partial<InterviewFormInput>,
  client: SupabaseClient = supabase
): Promise<InterviewRecord> {
  const { data, error } = await client
    .from("interview_history")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", interviewId)
    .select("*")
    .single();

  if (error) throw error;
  return data as InterviewRecord;
}

export async function deleteInterview(
  interviewId: string,
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client.from("interview_history").delete().eq("id", interviewId);
  if (error) throw error;
}
