import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  aiSettingsToDefaultSettings,
  parseAiSettings,
  type AiSettings,
} from "@/lib/ai-settings";
import { loadProfileBundleForUser } from "@/lib/supabase/load-profile-bundle";
import { mergeAndSaveProfileDefaultSettings } from "@/lib/supabase/services/profile-default-settings";

export async function loadAiSettings(
  userId: string,
  client: SupabaseClient = supabase
): Promise<AiSettings> {
  const bundle = await loadProfileBundleForUser(userId, client);
  return parseAiSettings(bundle.profile.default_settings);
}

export async function saveAiSettings(
  userId: string,
  settings: AiSettings,
  client: SupabaseClient = supabase
): Promise<AiSettings> {
  const updated = await mergeAndSaveProfileDefaultSettings(
    userId,
    (current) => aiSettingsToDefaultSettings(current, settings),
    client
  );
  return parseAiSettings(updated);
}
