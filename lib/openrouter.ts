export {
  DEFAULT_OPENROUTER_MODEL,
  FALLBACK_OPENROUTER_MODELS,
  formatProviderLabel,
  getGenerationMaxTokens,
  getModelProvider,
  getSortedProviders,
  groupModelsByProvider,
  isDeepSeekModel,
  isDeepSeekReasoningModel,
  normalizeOpenRouterModel,
  pickDefaultModelForProvider,
  resolveJsonFriendlyModel,
  type OpenRouterModel,
} from "./openrouter-shared";

import { DEFAULT_OPENROUTER_MODEL } from "./openrouter-shared";

/** Server-side default; honors OPENROUTER_DEFAULT_MODEL from .env.local */
export function resolveDefaultOpenRouterModel(): string {
  const fromEnv = process.env.OPENROUTER_DEFAULT_MODEL?.trim();
  return fromEnv || DEFAULT_OPENROUTER_MODEL;
}
