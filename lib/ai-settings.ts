import type { DefaultSettings } from "@/lib/supabase/database.types";

export interface AiSettings {
  /** When true, use OpenRouter with a model id (e.g. openai/gpt-4.1-mini). */
  use_openrouter: boolean;
  /** When true, run ATS match automatically after resume + PDF generation. */
  auto_ats_after_resume: boolean;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  use_openrouter: true,
  auto_ats_after_resume: false,
};

export function parseAiSettings(
  settings: DefaultSettings | null | undefined
): AiSettings {
  const raw = settings ?? {};
  return {
    use_openrouter:
      typeof raw.use_openrouter === "boolean"
        ? raw.use_openrouter
        : DEFAULT_AI_SETTINGS.use_openrouter,
    auto_ats_after_resume:
      typeof raw.auto_ats_after_resume === "boolean"
        ? raw.auto_ats_after_resume
        : DEFAULT_AI_SETTINGS.auto_ats_after_resume,
  };
}

export function aiSettingsToDefaultSettings(
  current: DefaultSettings | null | undefined,
  ai: AiSettings
): DefaultSettings {
  return {
    ...(current ?? {}),
    use_openrouter: ai.use_openrouter,
    auto_ats_after_resume: ai.auto_ats_after_resume,
  };
}
