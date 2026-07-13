import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  applyAlertSettingsToDefaultSettings,
  parseApplyAlertSettings,
  type ApplyAlertSettings,
} from "@/lib/apply-alert-settings";
import {
  aiSettingsToDefaultSettings,
  parseAiSettings,
  type AiSettings,
} from "@/lib/ai-settings";
import { mergeAndSaveProfileDefaultSettings } from "@/lib/supabase/services/profile-default-settings";

export async function saveGeneralSettings(
  userId: string,
  alerts: ApplyAlertSettings,
  ai: AiSettings,
  client: SupabaseClient = supabase
): Promise<{ alerts: ApplyAlertSettings; ai: AiSettings }> {
  const updated = await mergeAndSaveProfileDefaultSettings(
    userId,
    (current) =>
      applyAlertSettingsToDefaultSettings(
        aiSettingsToDefaultSettings(current, ai),
        alerts
      ),
    client
  );

  return {
    alerts: parseApplyAlertSettings(updated),
    ai: parseAiSettings(updated),
  };
}
