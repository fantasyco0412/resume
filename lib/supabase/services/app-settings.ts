import {
  APP_SETTINGS_GENERAL_KEY,
  DEFAULT_GENERAL_APP_SETTINGS,
  generalAppSettingsToJson,
  parseGeneralAppSettings,
  type GeneralAppSettings,
} from "@/lib/general-app-settings";
import { createServiceSupabaseClient } from "@/lib/supabase/service-client";

export async function getGeneralAppSettings(): Promise<GeneralAppSettings> {
  const client = createServiceSupabaseClient();

  const { data, error } = await client
    .from("app_settings")
    .select("value")
    .eq("key", APP_SETTINGS_GENERAL_KEY)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      return DEFAULT_GENERAL_APP_SETTINGS;
    }
    throw error;
  }

  if (!data?.value) {
    return DEFAULT_GENERAL_APP_SETTINGS;
  }

  return parseGeneralAppSettings(data.value);
}

export async function saveGeneralAppSettings(
  settings: GeneralAppSettings
): Promise<GeneralAppSettings> {
  const parsed = parseGeneralAppSettings(settings);
  const client = createServiceSupabaseClient();

  const { data, error } = await client
    .from("app_settings")
    .upsert(
      {
        key: APP_SETTINGS_GENERAL_KEY,
        value: generalAppSettingsToJson(parsed),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )
    .select("value")
    .single();

  if (error) throw error;
  return parseGeneralAppSettings(data.value);
}
