import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ensureProfile } from "@/lib/supabase/ensure-profile";
import { createEmptyProfileBundle } from "@/lib/supabase/empty-profile-bundle";
import { getUserId } from "@/lib/supabase/get-user-id";
import type {
  Profile,
  ProfileBundle,
  UserCertification,
  UserCompany,
  UserEducation,
  UserProject,
  UserSkill,
} from "@/lib/supabase/database.types";
import { parseStoredUserLevel } from "@/lib/user-level";

function normalizeProfile(row: Profile): Profile {
  return {
    ...row,
    user_level: parseStoredUserLevel(row.user_level),
    default_settings: row.default_settings ?? {},
  };
}

/**
 * Loads profile + all related user-owned rows for resume generation and profile UI.
 */
export async function loadProfileBundle(
  client: SupabaseClient = supabase
): Promise<ProfileBundle> {
  const userId = await getUserId(client);
  const ensured = await ensureProfile(userId, client);
  const profile = normalizeProfile(
    ensured ?? createEmptyProfileBundle(userId).profile
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

/**
 * Loads profile bundle for a specific user id (must match authenticated user via RLS).
 */
export async function loadProfileBundleForUser(
  userId: string,
  client: SupabaseClient = supabase
): Promise<ProfileBundle> {
  const profileRow =
    (await ensureProfile(userId, client)) ??
    createEmptyProfileBundle(userId).profile;

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
    profile: normalizeProfile(profileRow),
    educations: (educationsResult.data ?? []) as UserEducation[],
    skills: (skillsResult.data ?? []) as UserSkill[],
    certifications: (certificationsResult.data ?? []) as UserCertification[],
    projects: (projectsResult.data ?? []) as UserProject[],
    companies: (companiesResult.data ?? []) as UserCompany[],
  };
}
