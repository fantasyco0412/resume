import {
  DEFAULT_DIRECT_MODELS,
  isDirectAIProvider,
  type DirectAIProvider,
} from "@/lib/direct-ai-shared";
import { getGenerationMaxTokens, getModelProvider } from "@/lib/openrouter";

/** Cheap/fast model for parsing pasted job pages before resume generation. */
export function resolveExtractModel(useOpenRouter = true): string {
  if (useOpenRouter) {
    const fromEnv = process.env.OPENROUTER_EXTRACT_MODEL?.trim();
    if (fromEnv && fromEnv.includes("/")) return fromEnv;
    return "openai/gpt-4.1-mini";
  }

  const provider = resolveDirectExtractProvider();
  return resolveDirectModel(provider, process.env.EXTRACT_MODEL);
}

/** Job extract JSON includes the full JD text — needs a higher cap than chat replies. */
export function resolveExtractMaxTokens(): number {
  const fromEnv = Number(process.env.EXTRACT_MAX_TOKENS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return 4096;
}

function resolveDirectExtractProvider(): DirectAIProvider {
  const fromEnv = process.env.EXTRACT_PROVIDER?.trim().toLowerCase();
  if (fromEnv && isDirectAIProvider(fromEnv)) return fromEnv;
  return "openai";
}

export function resolveExtractProvider(useOpenRouter = true): DirectAIProvider | undefined {
  if (useOpenRouter) return undefined;
  return resolveDirectExtractProvider();
}

export function parseUseOpenRouter(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

export function requireOpenRouterApiKey(): void {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(
      "OpenRouter API key is not configured. Set OPENROUTER_API_KEY in .env.local"
    );
  }
}

export function requireDirectProviderApiKey(provider: DirectAIProvider): void {
  const keys: Record<DirectAIProvider, { env: string; label: string }> = {
    openai: { env: "OPENAI_API_KEY", label: "OpenAI" },
    anthropic: { env: "ANTHROPIC_API_KEY", label: "Anthropic" },
    deepseek: { env: "DEEPSEEK_API_KEY", label: "DeepSeek" },
  };
  const { env, label } = keys[provider];
  if (!process.env[env]?.trim()) {
    throw new Error(
      `${label} API key is not configured. Set ${env} in backend .env.local`
    );
  }
}

export function requireAIConfigured(useOpenRouter: boolean, provider?: DirectAIProvider): void {
  if (useOpenRouter) {
    requireOpenRouterApiKey();
    return;
  }
  if (!provider) {
    throw new Error("AI provider is required when not using OpenRouter");
  }
  requireDirectProviderApiKey(provider);
}

export function resolveApiModel(apiModel: unknown): string {
  const model = typeof apiModel === "string" ? apiModel.trim() : "";
  if (!model) {
    throw new Error("AI model is required");
  }
  if (!model.includes("/")) {
    throw new Error("Invalid OpenRouter model id");
  }
  return model;
}

export function resolveDirectProvider(apiProvider: unknown): DirectAIProvider {
  const provider =
    typeof apiProvider === "string" ? apiProvider.trim().toLowerCase() : "";
  if (!isDirectAIProvider(provider)) {
    throw new Error("AI provider must be openai, anthropic, or deepseek");
  }
  return provider;
}

export function resolveDirectModel(
  provider: DirectAIProvider,
  apiModel?: unknown
): string {
  const model = typeof apiModel === "string" ? apiModel.trim() : "";
  if (model) return model;

  const envKeys: Record<DirectAIProvider, string | undefined> = {
    openai: process.env.OPENAI_MODEL,
    anthropic: process.env.ANTHROPIC_MODEL,
    deepseek: process.env.DEEPSEEK_MODEL,
  };
  const fromEnv = envKeys[provider]?.trim();
  return fromEnv || DEFAULT_DIRECT_MODELS[provider];
}

export function getConfiguredDirectModels(): Record<DirectAIProvider, string> {
  return {
    openai: resolveDirectModel("openai"),
    anthropic: resolveDirectModel("anthropic"),
    deepseek: resolveDirectModel("deepseek"),
  };
}

export interface ResolvedAIRequest {
  useOpenRouter: boolean;
  model: string;
  provider?: DirectAIProvider;
}

export function resolveAIRequest(body: {
  useOpenRouter?: unknown;
  apiModel?: unknown;
  apiProvider?: unknown;
}): ResolvedAIRequest {
  const useOpenRouter = parseUseOpenRouter(body.useOpenRouter);

  if (useOpenRouter) {
    return {
      useOpenRouter: true,
      model: resolveApiModel(body.apiModel),
    };
  }

  const provider = resolveDirectProvider(body.apiProvider);
  return {
    useOpenRouter: false,
    provider,
    model: resolveDirectModel(provider, body.apiModel),
  };
}

export function providerLabelFromModel(modelId: string): string {
  return getModelProvider(modelId);
}

export function generationMaxTokensForRequest(
  resolved: ResolvedAIRequest
): number {
  if (resolved.useOpenRouter) {
    return getGenerationMaxTokens(resolved.model);
  }
  return getGenerationMaxTokens(resolved.model, resolved.provider);
}

export { getGenerationMaxTokens };
