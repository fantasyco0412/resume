import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  applyAlertSettingsToDefaultSettings,
  parseApplyAlertSettings,
  type ApplyAlertSettings,
} from "@/lib/apply-alert-settings";
import { loadProfileBundleForUser } from "@/lib/supabase/load-profile-bundle";
import { mergeAndSaveProfileDefaultSettings } from "@/lib/supabase/services/profile-default-settings";

export async function loadApplyAlertSettings(
  userId: string,
  client: SupabaseClient = supabase
): Promise<ApplyAlertSettings> {
  const bundle = await loadProfileBundleForUser(userId, client);
  return parseApplyAlertSettings(bundle.profile.default_settings);
}

export async function saveApplyAlertSettings(
  userId: string,
  settings: ApplyAlertSettings,
  client: SupabaseClient = supabase
): Promise<ApplyAlertSettings> {
  const updated = await mergeAndSaveProfileDefaultSettings(
    userId,
    (current) => applyAlertSettingsToDefaultSettings(current, settings),
    client
  );
  return parseApplyAlertSettings(updated);
}
