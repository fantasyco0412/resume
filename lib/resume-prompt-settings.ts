import type { DefaultSettings } from "@/lib/supabase/database.types";

export const RESUME_PROMPT_SETTING_KEY = "resume_generate_prompt";

export const RESUME_PROMPT_PLACEHOLDERS = [
  { token: "{{jd}}", description: "Job description text" },
  { token: "{{jobDescription}}", description: "Alias for job description" },
  { token: "{{resumeContent}}", description: "Existing resume reference content" },
  { token: "{{resume}}", description: "Alias for resume content" },
  {
    token: "{{industryBuzzwords}}",
    description: "JD-scoped industry buzzwords block (optional)",
  },
] as const;

/** Returns trimmed custom template, or null to use the built-in default. */
export function parseCustomResumeGeneratePrompt(
  settings: DefaultSettings | null | undefined
): string | null {
  const raw = settings?.[RESUME_PROMPT_SETTING_KEY];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateResumeGeneratePromptTemplate(template: string): string | null {
  const trimmed = template.trim();
  if (!trimmed) return null;

  const hasJd = /\{\{(jd|jobDescription)\}\}/.test(trimmed);
  const hasResume = /\{\{(resumeContent|resume)\}\}/.test(trimmed);

  if (!hasJd || !hasResume) {
    return "Template must include {{jd}} and {{resumeContent}} placeholders.";
  }

  return null;
}

export function customResumeGeneratePromptToDefaultSettings(
  current: DefaultSettings | null | undefined,
  prompt: string | null
): DefaultSettings {
  const next = { ...(current ?? {}) };
  const trimmed = prompt?.trim() ?? "";

  if (trimmed) {
    next[RESUME_PROMPT_SETTING_KEY] = trimmed;
  } else {
    delete next[RESUME_PROMPT_SETTING_KEY];
  }

  return next;
}
