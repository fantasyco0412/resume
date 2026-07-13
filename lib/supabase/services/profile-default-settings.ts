import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { DefaultSettings } from "@/lib/supabase/database.types";
import { loadProfileBundleForUser } from "@/lib/supabase/load-profile-bundle";
import { updateProfile } from "@/lib/supabase/services/profiles";

export async function mergeAndSaveProfileDefaultSettings(
  userId: string,
  merge: (current: DefaultSettings) => DefaultSettings,
  client: SupabaseClient = supabase
): Promise<DefaultSettings> {
  const bundle = await loadProfileBundleForUser(userId, client);
  const current = bundle.profile.default_settings ?? {};
  const updated = await updateProfile(
    userId,
    { default_settings: merge(current) },
    client
  );
  return updated.default_settings ?? {};
}
