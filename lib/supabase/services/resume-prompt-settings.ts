import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  customResumeGeneratePromptToDefaultSettings,
  parseCustomResumeGeneratePrompt,
} from "@/lib/resume-prompt-settings";
import { loadProfileBundleForUser } from "@/lib/supabase/load-profile-bundle";
import { mergeAndSaveProfileDefaultSettings } from "@/lib/supabase/services/profile-default-settings";

export async function loadResumeGeneratePrompt(
  userId: string,
  client: SupabaseClient = supabase
): Promise<string | null> {
  const bundle = await loadProfileBundleForUser(userId, client);
  return parseCustomResumeGeneratePrompt(bundle.profile.default_settings);
}

export async function saveResumeGeneratePrompt(
  userId: string,
  prompt: string | null,
  client: SupabaseClient = supabase
): Promise<string | null> {
  const updated = await mergeAndSaveProfileDefaultSettings(
    userId,
    (current) => customResumeGeneratePromptToDefaultSettings(current, prompt),
    client
  );
  return parseCustomResumeGeneratePrompt(updated);
}
