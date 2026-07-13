export interface OpenRouterModel {
  id: string;
  name: string;
  provider: string;
  contextLength?: number;
}

/** Curated fallbacks when OpenRouter models API is unavailable. */
export const FALLBACK_OPENROUTER_MODELS: OpenRouterModel[] = [
  { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "openai" },
  { id: "openai/gpt-4.1", name: "GPT-4.1", provider: "openai" },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "anthropic" },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", provider: "anthropic" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek Chat", provider: "deepseek" },
  { id: "google/gemini-2.5-flash-preview", name: "Gemini 2.5 Flash", provider: "google" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", provider: "meta-llama" },
];

/** Client-safe default; server may override via OPENROUTER_DEFAULT_MODEL. */
export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4.1-mini";

export function getModelProvider(modelId: string): string {
  const slash = modelId.indexOf("/");
  if (slash <= 0) return modelId.toLowerCase();
  return modelId.slice(0, slash).toLowerCase();
}

export function formatProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    deepseek: "DeepSeek",
    google: "Google",
    "meta-llama": "Meta Llama",
    mistralai: "Mistral",
    qwen: "Qwen",
    cohere: "Cohere",
  };
  return labels[provider] || provider.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeOpenRouterModel(raw: {
  id?: string;
  name?: string;
  context_length?: number;
}): OpenRouterModel | null {
  const id = String(raw.id || "").trim();
  if (!id.includes("/")) return null;
  const provider = getModelProvider(id);
  return {
    id,
    name: String(raw.name || id).trim(),
    provider,
    contextLength: typeof raw.context_length === "number" ? raw.context_length : undefined,
  };
}

export function groupModelsByProvider(models: OpenRouterModel[]): Map<string, OpenRouterModel[]> {
  const map = new Map<string, OpenRouterModel[]>();
  for (const model of models) {
    const list = map.get(model.provider) ?? [];
    list.push(model);
    map.set(model.provider, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return map;
}

export function getSortedProviders(models: OpenRouterModel[]): string[] {
  const preferred = ["openai", "anthropic", "deepseek", "google", "meta-llama", "mistralai"];
  const providers = [...new Set(models.map((m) => m.provider))];
  return providers.sort((a, b) => {
    const ai = preferred.indexOf(a);
    const bi = preferred.indexOf(b);
    if (ai !== -1 || bi !== -1) {
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    }
    return formatProviderLabel(a).localeCompare(formatProviderLabel(b));
  });
}

export function pickDefaultModelForProvider(
  models: OpenRouterModel[],
  provider: string
): string | undefined {
  const match = models.find((m) => m.provider === provider);
  return match?.id;
}

export function getGenerationMaxTokens(
  modelId: string,
  directProvider?: string
): number {
  const envOverride = Number(process.env.RESUME_GENERATION_MAX_TOKENS);
  if (Number.isFinite(envOverride) && envOverride > 0) {
    return envOverride;
  }

  const provider = directProvider || getModelProvider(modelId);
  if (provider === "deepseek") {
    return isDeepSeekReasoningModel(modelId) ? 8192 : 4096;
  }
  if (provider === "openai") return 3072;
  if (provider === "anthropic") return 4096;
  return 4096;
}

export function isDeepSeekModel(modelId: string): boolean {
  return getModelProvider(modelId) === "deepseek";
}

/** Reasoning-class DeepSeek models often emit planning prose instead of JSON. */
export function isDeepSeekReasoningModel(modelId: string): boolean {
  const slug = modelId.includes("/") ? modelId.split("/").pop()! : modelId;
  const lower = slug.toLowerCase();
  return (
    lower.includes("reasoner") ||
    lower.includes("r1") ||
    lower.includes("v4-pro") ||
    lower.includes("v3.2-speciale")
  );
}

/** Use a chat model for structured JSON when a reasoning model is selected. */
export function resolveJsonFriendlyModel(
  modelId: string,
  directProvider?: string
): string {
  if (!isDeepSeekReasoningModel(modelId)) return modelId;

  const fallback = process.env.DEEPSEEK_JSON_MODEL?.trim() || "deepseek-chat";
  const provider = directProvider || getModelProvider(modelId);

  if (provider !== "deepseek") return modelId;

  if (modelId.includes("/")) {
    return `deepseek/${fallback}`;
  }
  return fallback;
}
