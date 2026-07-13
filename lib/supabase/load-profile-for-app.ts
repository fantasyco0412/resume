import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getUserIdOrNull } from "@/lib/supabase/get-user-id";
import { loadProfileBundle } from "@/lib/supabase/load-profile-bundle";
import type { ProfileBundle } from "@/lib/supabase/database.types";
import {
  isProfileBundlePopulated,
  legacyAnalyzeProfileFromPreferences,
  profileBundleToLegacyAnalyzeProfile,
  profileBundleToResumeText,
  type LegacyAnalyzeProfile,
} from "@/lib/mappers/profile-to-resume";
import {
  legacyPreferencesToProfileBundle,
  type LegacyUserPreferences,
} from "@/lib/mappers/legacy-preferences";
import { createEmptyProfileBundle } from "@/lib/supabase/empty-profile-bundle";
import {
  formatSupabaseConnectionError,
  isSupabaseNetworkError,
} from "@/lib/supabase/network";
import { readProfileCache, writeProfileCache } from "@/lib/supabase/profile-cache";

export interface LoadProfileForAppOptions {
  email?: string | null;
  userId?: string;
}

export interface LoadedProfileForApp {
  bundle: ProfileBundle;
  legacyAnalyzeProfile: LegacyAnalyzeProfile;
  resumeText: string;
  source: "normalized" | "legacy_fallback" | "empty" | "cache";
}

async function fetchLegacyPreferences(
  userId: string,
  client: SupabaseClient
): Promise<LegacyUserPreferences | null> {
  const { data, error } = await client
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as LegacyUserPreferences | null) ?? null;
}

function legacyPreferencesToAnalyzeInput(preferences: LegacyUserPreferences) {
  return {
    default_resume: preferences.default_resume ?? null,
    company_1: preferences.company_1 ?? null,
    company_2: preferences.company_2 ?? null,
    company_3: preferences.company_3 ?? null,
    company_4: preferences.company_4 ?? null,
    company_5: preferences.company_5 ?? null,
  };
}

function buildLoadedResult(
  bundle: ProfileBundle,
  options: LoadProfileForAppOptions,
  source: LoadedProfileForApp["source"],
  legacyPreferences: LegacyUserPreferences | null
): LoadedProfileForApp {
  const legacyAnalyzeProfile =
    legacyPreferences != null
      ? legacyAnalyzeProfileFromPreferences(
          legacyPreferencesToAnalyzeInput(legacyPreferences)
        )
      : profileBundleToLegacyAnalyzeProfile(bundle, options.email);

  return {
    bundle,
    legacyAnalyzeProfile,
    resumeText: profileBundleToResumeText(bundle, options.email),
    source,
  };
}

async function loadProfileForAppInternal(
  client: SupabaseClient,
  options: LoadProfileForAppOptions
): Promise<LoadedProfileForApp> {
  const userId = options.userId ?? (await getUserIdOrNull(client));
  if (!userId) {
    throw new Error("Authentication required");
  }

  let bundle = await loadProfileBundle(client);
  let source: LoadedProfileForApp["source"] = isProfileBundlePopulated(bundle)
    ? "normalized"
    : "empty";
  let legacyPreferences: LegacyUserPreferences | null = null;

  if (!isProfileBundlePopulated(bundle)) {
    legacyPreferences = await fetchLegacyPreferences(userId, client);
    if (legacyPreferences) {
      bundle = legacyPreferencesToProfileBundle(legacyPreferences, bundle.profile);
      source = "legacy_fallback";
    }
  }

  const result = buildLoadedResult(bundle, options, source, legacyPreferences);
  writeProfileCache(userId, result);
  return result;
}

/**
 * Loads profile for the app: normalized tables first, then legacy fallback.
 * On network failure returns cached or empty profile instead of throwing.
 */
export async function loadProfileForApp(
  client: SupabaseClient = supabase,
  options: LoadProfileForAppOptions = {}
): Promise<LoadedProfileForApp> {
  try {
    return await loadProfileForAppInternal(client, options);
  } catch (error) {
    if (!isSupabaseNetworkError(error)) {
      throw error;
    }

    const userId = options.userId ?? (await getUserIdOrNull(client).catch(() => null));
    const message = formatSupabaseConnectionError(error);

    if (userId) {
      const cached = readProfileCache<LoadedProfileForApp>(userId);
      if (cached) {
        return { ...cached, source: "cache" as const };
      }

      const emptyBundle = createEmptyProfileBundle(userId);
      return buildLoadedResult(emptyBundle, options, "empty", null);
    }

    throw new Error(message);
  }
}
