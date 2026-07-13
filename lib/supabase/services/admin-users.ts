import type { User } from "@supabase/supabase-js";
import { createEmptyProfileBundle } from "@/lib/supabase/empty-profile-bundle";
import { createServiceSupabaseClient } from "@/lib/supabase/service-client";
import type {
  Profile,
  ProfileBundle,
  StoredUserLevel,
  UserCertification,
  UserCompany,
  UserEducation,
  UserLevel,
  UserProject,
  UserSkill,
} from "@/lib/supabase/database.types";
import {
  DEFAULT_STORED_USER_LEVEL,
  parseStoredUserLevel,
  resolveUserLevel,
} from "@/lib/user-level";
import { isAdminEmail } from "@/lib/admin";

export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  level: UserLevel;
  storedLevel: StoredUserLevel;
  adminNote: string | null;
}
export interface AdminUsersResult {
  users: AdminUserRow[];
  total: number;
  page: number;
  perPage: number;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  lastSignInAt: string | null;
  authCreatedAt: string;
  resumeCount: number;
  interviewCount: number;
  level: UserLevel;
  storedLevel: StoredUserLevel;
  bundle: ProfileBundle;
}

function normalizeProfile(row: Profile): Profile {
  return {
    ...row,
    user_level: parseStoredUserLevel(row.user_level),
    admin_note: row.admin_note ?? null,
    default_settings: row.default_settings ?? {},
  };
}

async function loadProfileBundleWithServiceClient(userId: string): Promise<ProfileBundle> {
  const client = createServiceSupabaseClient();

  const { data: profileRow } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const profile = normalizeProfile(
    (profileRow as Profile | null) ?? createEmptyProfileBundle(userId).profile
  );

  const [
    educationsResult,
    skillsResult,
    certificationsResult,
    projectsResult,
    companiesResult,
  ] = await Promise.all([
    client
      .from("user_educations")
      .select("*")
      .eq("user_id", userId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    client
      .from("user_skills")
      .select("*")
      .eq("user_id", userId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    client
      .from("user_certifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    client
      .from("user_projects")
      .select("*")
      .eq("user_id", userId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    client
      .from("user_companies")
      .select("*")
      .eq("user_id", userId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const errors = [
    educationsResult.error,
    skillsResult.error,
    certificationsResult.error,
    projectsResult.error,
    companiesResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw errors[0];
  }

  return {
    profile,
    educations: (educationsResult.data ?? []) as UserEducation[],
    skills: (skillsResult.data ?? []) as UserSkill[],
    certifications: (certificationsResult.data ?? []) as UserCertification[],
    projects: (projectsResult.data ?? []) as UserProject[],
    companies: (companiesResult.data ?? []) as UserCompany[],
  };
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const client = createServiceSupabaseClient();

  const { data: authData, error: authError } = await client.auth.admin.getUserById(userId);
  if (authError) throw authError;
  if (!authData.user) {
    throw new Error("User not found");
  }

  const [bundle, resumeCountResult, interviewCountResult] = await Promise.all([
    loadProfileBundleWithServiceClient(userId),
    client
      .from("resume_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    client
      .from("interview_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  if (resumeCountResult.error) throw resumeCountResult.error;
  if (interviewCountResult.error) throw interviewCountResult.error;

  return {
    id: authData.user.id,
    email: authData.user.email ?? "",
    lastSignInAt: authData.user.last_sign_in_at ?? null,
    authCreatedAt: authData.user.created_at,
    resumeCount: resumeCountResult.count ?? 0,
    interviewCount: interviewCountResult.count ?? 0,
    level: resolveUserLevel(bundle.profile.user_level, isAdminEmail(authData.user.email)),
    storedLevel: bundle.profile.user_level,
    bundle,
  };
}

async function listAllAuthUsers(): Promise<User[]> {
  const client = createServiceSupabaseClient();
  const users: User[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    users.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }

  return users;
}

export async function listAdminUsers(options: {
  page?: number;
  perPage?: number;
  query?: string;
}): Promise<AdminUsersResult> {
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(100, Math.max(1, options.perPage ?? 20));
  const query = options.query?.trim() ?? "";

  const authUsers = await listAllAuthUsers();
  const client = createServiceSupabaseClient();
  const userIds = authUsers.map((user) => user.id);

  const profileById = new Map<
    string,
    {
      full_name: string | null;
      created_at: string;
      user_level: StoredUserLevel;
      admin_note: string | null;
    }
  >();
  if (userIds.length > 0) {
    const { data: profiles, error } = await client
      .from("profiles")
      .select("id, full_name, created_at, user_level, admin_note")
      .in("id", userIds);

    if (error) throw error;

    for (const profile of profiles ?? []) {
      profileById.set(profile.id, {
        full_name: profile.full_name,
        created_at: profile.created_at,
        user_level: parseStoredUserLevel(profile.user_level),
        admin_note: profile.admin_note ?? null,
      });
    }
  }

  const rows: AdminUserRow[] = authUsers
    .map((user) => mapAuthUserToRow(user, profileById.get(user.id)))
    .filter((row) => matchesQuery(row, query))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = rows.length;
  const start = (page - 1) * perPage;

  return {
    users: rows.slice(start, start + perPage),
    total,
    page,
    perPage,
  };
}

function matchesQuery(row: AdminUserRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.email, row.fullName ?? "", row.level, row.storedLevel, row.adminNote ?? ""].some(
    (value) => String(value).toLowerCase().includes(q)
  );
}

function mapAuthUserToRow(
  user: User,
  profile?: {
    full_name: string | null;
    created_at: string;
    user_level: StoredUserLevel;
    admin_note?: string | null;
  } | null
): AdminUserRow {
  const storedLevel = profile?.user_level ?? DEFAULT_STORED_USER_LEVEL;
  const email = user.email ?? "";

  return {
    id: user.id,
    email,
    fullName: profile?.full_name ?? null,
    createdAt: profile?.created_at ?? user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    storedLevel,
    level: resolveUserLevel(storedLevel, isAdminEmail(email)),
    adminNote: profile?.admin_note ?? null,
  };
}

export async function createAdminUser(input: {
  email: string;
  password: string;
  fullName?: string | null;
  userLevel?: StoredUserLevel;
}): Promise<AdminUserRow> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const fullName = input.fullName?.trim() || null;
  const userLevel = input.userLevel ?? DEFAULT_STORED_USER_LEVEL;

  if (!email) {
    throw new Error("Email is required");
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const client = createServiceSupabaseClient();

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });

  if (error) throw error;
  if (!data.user) {
    throw new Error("Failed to create user");
  }

  const userId = data.user.id;

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .upsert(
      {
        id: userId,
        full_name: fullName,
        user_level: userLevel,
        default_settings: {},
      },
      { onConflict: "id" }
    )
    .select("full_name, created_at, user_level, admin_note")
    .single();

  if (profileError) throw profileError;

  return mapAuthUserToRow(data.user, {
    full_name: profile.full_name,
    created_at: profile.created_at,
    user_level: parseStoredUserLevel(profile.user_level),
    admin_note: profile.admin_note ?? null,
  });
}

export async function updateAdminUser(
  userId: string,
  input: { userLevel?: StoredUserLevel; adminNote?: string | null }
): Promise<AdminUserRow> {
  if (input.userLevel === undefined && input.adminNote === undefined) {
    throw new Error("Nothing to update");
  }

  const client = createServiceSupabaseClient();

  const { data: authData, error: authError } = await client.auth.admin.getUserById(userId);
  if (authError) throw authError;
  if (!authData.user) {
    throw new Error("User not found");
  }

  const updatePayload: {
    user_level?: StoredUserLevel;
    admin_note?: string | null;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (input.userLevel !== undefined) {
    updatePayload.user_level = input.userLevel;
  }
  if (input.adminNote !== undefined) {
    updatePayload.admin_note = input.adminNote?.trim() || null;
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId)
    .select("full_name, created_at, user_level, admin_note")
    .maybeSingle();

  if (profileError) throw profileError;

  let profileRow = profile;
  if (!profileRow) {
    const { data: created, error: createError } = await client
      .from("profiles")
      .insert({
        id: userId,
        user_level: input.userLevel ?? DEFAULT_STORED_USER_LEVEL,
        admin_note: input.adminNote?.trim() || null,
        default_settings: {},
      })
      .select("full_name, created_at, user_level, admin_note")
      .single();
    if (createError) throw createError;
    profileRow = created;
  }

  return mapAuthUserToRow(authData.user, {
    full_name: profileRow.full_name,
    created_at: profileRow.created_at,
    user_level: parseStoredUserLevel(profileRow.user_level),
    admin_note: profileRow.admin_note ?? null,
  });
}

export async function updateAdminUserLevel(
  userId: string,
  userLevel: StoredUserLevel
): Promise<AdminUserRow> {
  return updateAdminUser(userId, { userLevel });
}

const USER_OWNED_TABLES = [
  "interview_history",
  "resume_history",
  "user_educations",
  "user_skills",
  "user_certifications",
  "user_projects",
  "user_companies",
] as const;

export async function deleteAdminUser(userId: string): Promise<void> {
  const client = createServiceSupabaseClient();

  for (const table of USER_OWNED_TABLES) {
    const { error } = await client.from(table).delete().eq("user_id", userId);
    if (error) throw error;
  }

  const { error: profileError } = await client.from("profiles").delete().eq("id", userId);
  if (profileError) throw profileError;

  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) throw error;
}
