import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/supabase/database.types";
import { DEFAULT_STORED_USER_LEVEL, parseStoredUserLevel } from "@/lib/user-level";
import { isSupabaseNetworkError } from "@/lib/supabase/network";

/**
 * Ensures a profiles row exists for the given auth user id.
 * Safe to call after sign-in; no-op when the profile already exists.
 * Returns null when Supabase is unreachable (does not throw).
 */
export async function ensureProfile(
  userId: string,
  client: SupabaseClient = supabase
): Promise<Profile | null> {
  try {
    const { data: existing, error: selectError } = await client
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (selectError) {
      if (isSupabaseNetworkError(selectError)) return null;
      throw selectError;
    }

    if (existing) {
      return {
        ...existing,
        user_level: parseStoredUserLevel(existing.user_level),
        default_settings: existing.default_settings ?? {},
      } as Profile;
    }

    const { data: created, error: insertError } = await client
      .from("profiles")
      .insert({ id: userId, default_settings: {}, user_level: DEFAULT_STORED_USER_LEVEL })
      .select("*")
      .single();

    if (insertError) {
      if (isSupabaseNetworkError(insertError)) return null;
      throw insertError;
    }

    return {
      ...created,
      user_level: parseStoredUserLevel(created.user_level),
      default_settings: created.default_settings ?? {},
    } as Profile;
  } catch (error) {
    if (isSupabaseNetworkError(error)) return null;
    throw error;
  }
}
