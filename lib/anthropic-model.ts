export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
}
