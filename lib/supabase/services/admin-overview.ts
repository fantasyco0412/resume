import type { InterviewRecord, ResumeRecord } from "@/lib/supabase/database.types";
import { createServiceSupabaseClient } from "@/lib/supabase/service-client";
import type { AdminOverviewData, AdminUserLabel } from "@/lib/admin-overview-stats";
import { isAdminEmail } from "@/lib/admin";
import { parseStoredUserLevel, resolveUserLevel, DEFAULT_STORED_USER_LEVEL } from "@/lib/user-level";

async function listAllResumeRecords(): Promise<ResumeRecord[]> {
  const client = createServiceSupabaseClient();
  const rows: ResumeRecord[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await client
      .from("resume_history")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    rows.push(...(data as ResumeRecord[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function listAllInterviewRecords(): Promise<InterviewRecord[]> {
  const client = createServiceSupabaseClient();
  const rows: InterviewRecord[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await client
      .from("interview_history")
      .select("*")
      .order("interview_date", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    rows.push(...(data as InterviewRecord[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function listAdminUserLabels(): Promise<AdminUserLabel[]> {
  const client = createServiceSupabaseClient();
  const authUsers: AdminUserLabel[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    for (const user of data.users) {
      authUsers.push({
        userId: user.id,
        email: user.email ?? "",
        fullName: null,
        level: resolveUserLevel(DEFAULT_STORED_USER_LEVEL, isAdminEmail(user.email)),
      });
    }

    if (data.users.length < perPage) break;
    page += 1;
  }

  const userIds = authUsers.map((user) => user.userId);
  if (userIds.length === 0) return authUsers;

  const { data: profiles, error: profileError } = await client
    .from("profiles")
    .select("id, full_name, user_level")
    .in("id", userIds);

  if (profileError) throw profileError;

  const profileById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      {
        fullName: profile.full_name as string | null,
        storedLevel: parseStoredUserLevel(profile.user_level),
      },
    ])
  );

  return authUsers.map((user) => {
    const profile = profileById.get(user.userId);
    const storedLevel = profile?.storedLevel ?? DEFAULT_STORED_USER_LEVEL;
    return {
      ...user,
      fullName: profile?.fullName ?? null,
      level: resolveUserLevel(storedLevel, isAdminEmail(user.email)),
    };
  });
}

export async function getAdminOverviewData(): Promise<AdminOverviewData> {
  const [records, interviews, users] = await Promise.all([
    listAllResumeRecords(),
    listAllInterviewRecords(),
    listAdminUserLabels(),
  ]);
  return { records, interviews, users };
}
