export type DirectAIProvider = "openai" | "anthropic" | "deepseek";

export const DIRECT_AI_PROVIDERS: DirectAIProvider[] = [
  "openai",
  "anthropic",
  "deepseek",
];

/** Default model ids when using direct provider API keys (server env may override). */
export const DEFAULT_DIRECT_MODELS: Record<DirectAIProvider, string> = {
  openai: "gpt-4o",
  anthropic: "claude-haiku-4-5-20251001",
  deepseek: "deepseek-chat",
};

export type DirectProviderModels = Record<DirectAIProvider, string>;

export interface DirectAiModelsResponse {
  models: DirectProviderModels;
  extractProvider: DirectAIProvider;
  extractModel: string;
}

export function isDirectAIProvider(value: string): value is DirectAIProvider {
  return DIRECT_AI_PROVIDERS.includes(value as DirectAIProvider);
}

export function formatDirectProviderLabel(provider: DirectAIProvider): string {
  const labels: Record<DirectAIProvider, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic (Claude)",
    deepseek: "DeepSeek",
  };
  return labels[provider];
}
