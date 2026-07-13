import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  JD_STORAGE_BUCKET,
  RESUME_STORAGE_BUCKET,
} from "@/lib/supabase/database.types";

export function buildJdStoragePath(userId: string, resumeId: string): string {
  return `${userId}/jds/${resumeId}.txt`;
}

export function buildResumeJsonStoragePath(
  userId: string,
  resumeId: string
): string {
  return `${userId}/resumes/${resumeId}.json`;
}

/** Cover letters stored as JSON alongside resume artifacts (same bucket). */
export function buildCoverLetterJsonStoragePath(
  userId: string,
  resumeId: string
): string {
  return `${userId}/cover-letters/${resumeId}.json`;
}

async function uploadTextFile(
  client: SupabaseClient,
  bucket: string,
  path: string,
  content: string,
  contentType: string
): Promise<string> {
  const { error } = await client.storage.from(bucket).upload(path, content, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw error;
  }

  return path;
}

async function downloadTextFile(
  client: SupabaseClient,
  bucket: string,
  path: string
): Promise<string> {
  const { data, error } = await client.storage.from(bucket).download(path);

  if (error) {
    throw error;
  }

  return data.text();
}

export async function uploadJd(
  userId: string,
  resumeId: string,
  jdText: string,
  client: SupabaseClient = supabase
): Promise<string> {
  const path = buildJdStoragePath(userId, resumeId);
  return uploadTextFile(client, JD_STORAGE_BUCKET, path, jdText, "text/plain");
}

export async function uploadResumeJson(
  userId: string,
  resumeId: string,
  resumeJson: unknown,
  client: SupabaseClient = supabase
): Promise<string> {
  const path = buildResumeJsonStoragePath(userId, resumeId);
  const content = JSON.stringify(resumeJson, null, 2);
  return uploadTextFile(
    client,
    RESUME_STORAGE_BUCKET,
    path,
    content,
    "application/json"
  );
}

export async function downloadJd(
  jdFilePath: string,
  client: SupabaseClient = supabase
): Promise<string> {
  return downloadTextFile(client, JD_STORAGE_BUCKET, jdFilePath);
}

export async function downloadResumeJson<T = unknown>(
  resumeFilePath: string,
  client: SupabaseClient = supabase
): Promise<T> {
  const text = await downloadTextFile(
    client,
    RESUME_STORAGE_BUCKET,
    resumeFilePath
  );
  return JSON.parse(text) as T;
}

export async function deleteJd(
  jdFilePath: string,
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client.storage.from(JD_STORAGE_BUCKET).remove([jdFilePath]);
  if (error) {
    throw error;
  }
}

export async function deleteResumeJson(
  resumeFilePath: string,
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client.storage
    .from(RESUME_STORAGE_BUCKET)
    .remove([resumeFilePath]);
  if (error) {
    throw error;
  }
}

export async function uploadCoverLetterJson(
  userId: string,
  resumeId: string,
  coverLetterJson: unknown,
  client: SupabaseClient = supabase
): Promise<string> {
  const path = buildCoverLetterJsonStoragePath(userId, resumeId);
  const content = JSON.stringify(coverLetterJson, null, 2);
  return uploadTextFile(
    client,
    RESUME_STORAGE_BUCKET,
    path,
    content,
    "application/json"
  );
}

export async function downloadCoverLetterJson<T = unknown>(
  coverLetterFilePath: string,
  client: SupabaseClient = supabase
): Promise<T> {
  const text = await downloadTextFile(
    client,
    RESUME_STORAGE_BUCKET,
    coverLetterFilePath
  );
  return JSON.parse(text) as T;
}

export async function deleteCoverLetterJson(
  coverLetterFilePath: string,
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client.storage
    .from(RESUME_STORAGE_BUCKET)
    .remove([coverLetterFilePath]);
  if (error) {
    throw error;
  }
}
