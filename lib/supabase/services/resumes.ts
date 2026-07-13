import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { BidStatus, ResumeRecord } from "@/lib/supabase/database.types";
import type { JobsiteId } from "@/lib/jobsites";
import type { JobWorkType } from "@/lib/prompts/job-page-extract";
import {
  jobTypesForStorage,
  optionalAtsScore,
  optionalCostUsd,
  optionalText,
} from "@/lib/resume-record-metadata";
import {
  uploadJd,
  uploadResumeJson,
  downloadJd,
  downloadResumeJson,
} from "@/lib/supabase/storage";
import type { UpdatedResume } from "@/lib/types/resume";
import { generateId } from "@/lib/generate-id";

export interface CreateResumeParams {
  userId: string;
  jd: string;
  resume: UpdatedResume;
  aiType?: string | null;
  model?: string | null;
  jobSite?: JobsiteId | null;
  jobLink?: string | null;
  jobTitle?: string | null;
  jobCompany?: string | null;
  jobLocation?: string | null;
  industry?: string | null;
  securityClearance?: string | null;
  salary?: string | null;
  postedDate?: string | null;
  jobTypes?: JobWorkType[] | null;
  requiresTravel?: boolean | null;
  extractCostUsd?: number | null;
  generationCostUsd?: number | null;
  atsCostUsd?: number | null;
  answersCostUsd?: number | null;
}

export interface UpdateResumeAiCostsParams {
  extractCostUsd?: number | null;
  generationCostUsd?: number | null;
  atsCostUsd?: number | null;
  answersCostUsd?: number | null;
  atsScore?: number | null;
}

function buildResumeInsertRow(params: CreateResumeParams, resumeId: string) {
  return {
    id: resumeId,
    user_id: params.userId,
    ai_type: params.aiType ?? null,
    model: params.model ?? null,
    job_site: params.jobSite ?? null,
    job_link: params.jobLink ?? null,
    job_title: optionalText(params.jobTitle),
    job_company: optionalText(params.jobCompany),
    job_location: optionalText(params.jobLocation),
    industry: optionalText(params.industry),
    security_clearance: optionalText(params.securityClearance),
    salary: optionalText(params.salary),
    posted_date: optionalText(params.postedDate),
    job_types: jobTypesForStorage(params.jobTypes),
    requires_travel: Boolean(params.requiresTravel),
    extract_cost_usd: optionalCostUsd(params.extractCostUsd),
    generation_cost_usd: optionalCostUsd(params.generationCostUsd),
    ats_cost_usd: optionalCostUsd(params.atsCostUsd),
    answers_cost_usd: optionalCostUsd(params.answersCostUsd),
    bid_status: "applied" as const,
  };
}

export async function createResumeWithArtifacts(
  params: CreateResumeParams,
  client: SupabaseClient = supabase
): Promise<ResumeRecord> {
  const resumeId = generateId();

  const jdFilePath = await uploadJd(params.userId, resumeId, params.jd, client);
  const resumeFilePath = await uploadResumeJson(
    params.userId,
    resumeId,
    params.resume,
    client
  );

  const { data, error } = await client
    .from("resume_history")
    .insert({
      ...buildResumeInsertRow(params, resumeId),
      jd_file_path: jdFilePath,
      resume_file_path: resumeFilePath,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as ResumeRecord;
}

export async function updateResumeAiCosts(
  resumeId: string,
  costs: UpdateResumeAiCostsParams,
  client: SupabaseClient = supabase
): Promise<ResumeRecord> {
  const updates: Record<string, number | null | string> = {
    updated_at: new Date().toISOString(),
  };

  if (costs.extractCostUsd !== undefined) {
    updates.extract_cost_usd = optionalCostUsd(costs.extractCostUsd);
  }
  if (costs.generationCostUsd !== undefined) {
    updates.generation_cost_usd = optionalCostUsd(costs.generationCostUsd);
  }
  if (costs.atsCostUsd !== undefined) {
    updates.ats_cost_usd = optionalCostUsd(costs.atsCostUsd);
  }
  if (costs.answersCostUsd !== undefined) {
    updates.answers_cost_usd = optionalCostUsd(costs.answersCostUsd);
  }
  if (costs.atsScore !== undefined) {
    updates.ats_score = optionalAtsScore(costs.atsScore);
  }

  const { data, error } = await client
    .from("resume_history")
    .update(updates)
    .eq("id", resumeId)
    .select("*")
    .single();

  if (error) throw error;
  return data as ResumeRecord;
}

export async function listResumes(
  userId: string,
  client: SupabaseClient = supabase
): Promise<ResumeRecord[]> {
  const { data, error } = await client
    .from("resume_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ResumeRecord[];
}

export async function updateResumeBidStatus(
  resumeId: string,
  bidStatus: BidStatus,
  client: SupabaseClient = supabase
): Promise<ResumeRecord> {
  const { data, error } = await client
    .from("resume_history")
    .update({ bid_status: bidStatus, updated_at: new Date().toISOString() })
    .eq("id", resumeId)
    .select("*")
    .single();

  if (error) throw error;
  return data as ResumeRecord;
}

export async function updateResumeJsonArtifact(
  userId: string,
  resumeId: string,
  resume: UpdatedResume,
  client: SupabaseClient = supabase
): Promise<void> {
  await uploadResumeJson(userId, resumeId, resume, client);

  const { error } = await client
    .from("resume_history")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", resumeId);

  if (error) throw error;
}

export async function getResumeArtifacts(
  record: ResumeRecord,
  client: SupabaseClient = supabase
): Promise<{ jd: string; resume: UpdatedResume }> {
  const [jd, resume] = await Promise.all([
    record.jd_file_path
      ? downloadJd(record.jd_file_path, client)
      : Promise.resolve(""),
    record.resume_file_path
      ? downloadResumeJson<UpdatedResume>(record.resume_file_path, client)
      : Promise.resolve({} as UpdatedResume),
  ]);

  return { jd, resume };
}
