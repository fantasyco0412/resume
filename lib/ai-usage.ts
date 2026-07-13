/** Token usage from an AI completion response. */
export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type AICostSource = "provider" | "estimated";

export interface AICostInfo {
  usage: AIUsage;
  costUsd: number;
  costSource: AICostSource;
}

interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

/** USD per 1M tokens — approximate; used when the provider does not return cost. */
const MODEL_PRICING: Array<{ match: RegExp; pricing: ModelPricing }> = [
  { match: /gpt-4\.1-mini/i, pricing: { inputPer1M: 0.4, outputPer1M: 1.6 } },
  { match: /gpt-4\.1(?!-mini)/i, pricing: { inputPer1M: 2.0, outputPer1M: 8.0 } },
  { match: /gpt-4o-mini/i, pricing: { inputPer1M: 0.15, outputPer1M: 0.6 } },
  { match: /gpt-4o/i, pricing: { inputPer1M: 2.5, outputPer1M: 10.0 } },
  { match: /deepseek-chat/i, pricing: { inputPer1M: 0.27, outputPer1M: 1.1 } },
  {
    match: /deepseek-v4-pro|deepseek-reasoner|deepseek-r1/i,
    pricing: { inputPer1M: 0.55, outputPer1M: 2.19 },
  },
  { match: /claude-sonnet-4/i, pricing: { inputPer1M: 3.0, outputPer1M: 15.0 } },
  { match: /claude-3\.5-sonnet|claude-sonnet/i, pricing: { inputPer1M: 3.0, outputPer1M: 15.0 } },
  { match: /claude-haiku/i, pricing: { inputPer1M: 0.8, outputPer1M: 4.0 } },
  { match: /gemini.*flash/i, pricing: { inputPer1M: 0.1, outputPer1M: 0.4 } },
  { match: /llama.*70b/i, pricing: { inputPer1M: 0.35, outputPer1M: 0.4 } },
];

function findModelPricing(modelId: string): ModelPricing {
  const slug = modelId.includes("/") ? modelId.split("/").pop()! : modelId;
  for (const { match, pricing } of MODEL_PRICING) {
    if (match.test(slug) || match.test(modelId)) return pricing;
  }
  return { inputPer1M: 1.0, outputPer1M: 3.0 };
}

function readProviderCostUsd(usage: Record<string, unknown>): number | undefined {
  for (const key of ["cost", "total_cost", "generation_cost"] as const) {
    const value = usage[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }
  return undefined;
}

/** Parse usage from OpenAI-compatible or Anthropic API responses. */
export function extractUsageFromRaw(raw: unknown): AIUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;

  if (record.usage && typeof record.usage === "object") {
    const usage = record.usage as Record<string, unknown>;
    const promptTokens = Number(
      usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? 0
    );
    const completionTokens = Number(
      usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens ?? 0
    );
    const totalTokens = Number(
      usage.total_tokens ?? usage.totalTokens ?? promptTokens + completionTokens
    );
    if (promptTokens > 0 || completionTokens > 0 || totalTokens > 0) {
      return {
        promptTokens,
        completionTokens,
        totalTokens: totalTokens || promptTokens + completionTokens,
      };
    }
  }

  if (typeof record.input_tokens === "number") {
    const promptTokens = record.input_tokens;
    const completionTokens = Number(record.output_tokens ?? 0);
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }

  return null;
}

export function extractProviderCostUsd(raw: unknown): number | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;

  if (record.usage && typeof record.usage === "object") {
    const fromUsage = readProviderCostUsd(record.usage as Record<string, unknown>);
    if (fromUsage !== undefined) return fromUsage;
  }

  return readProviderCostUsd(record);
}

export function estimateCostUsd(modelId: string, usage: AIUsage): number {
  const { inputPer1M, outputPer1M } = findModelPricing(modelId);
  const inputCost = (usage.promptTokens / 1_000_000) * inputPer1M;
  const outputCost = (usage.completionTokens / 1_000_000) * outputPer1M;
  return inputCost + outputCost;
}

export function resolveAICost(modelId: string, raw: unknown): AICostInfo | null {
  const usage = extractUsageFromRaw(raw);
  if (!usage) return null;

  const providerCost = extractProviderCostUsd(raw);
  if (providerCost !== undefined) {
    return { usage, costUsd: providerCost, costSource: "provider" };
  }

  return {
    usage,
    costUsd: estimateCostUsd(modelId, usage),
    costSource: "estimated",
  };
}

export function formatCostUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "$0.00";
  if (usd >= 0.01) return `$${usd.toFixed(2)}`;
  if (usd >= 0.001) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(4)}`;
}

export function sumCosts(...amounts: Array<number | undefined | null>): number {
  return amounts.reduce<number>(
    (sum, value) => sum + (typeof value === "number" && Number.isFinite(value) ? value : 0),
    0
  );
}

export function formatAiCostBreakdown(parts: {
  extractCostUsd?: number;
  generationCostUsd?: number;
  atsCostUsd?: number;
  answersCostUsd?: number;
  coverLetterCostUsd?: number;
}): string {
  const total = sumCosts(
    parts.extractCostUsd,
    parts.generationCostUsd,
    parts.atsCostUsd,
    parts.answersCostUsd,
    parts.coverLetterCostUsd
  );
  if (total <= 0) return "";

  const detail: string[] = [];
  if (parts.extractCostUsd && parts.extractCostUsd > 0) {
    detail.push(`extract ${formatCostUsd(parts.extractCostUsd)}`);
  }
  if (parts.generationCostUsd && parts.generationCostUsd > 0) {
    detail.push(`resume ${formatCostUsd(parts.generationCostUsd)}`);
  }
  if (parts.atsCostUsd && parts.atsCostUsd > 0) {
    detail.push(`ATS ${formatCostUsd(parts.atsCostUsd)}`);
  }
  if (parts.answersCostUsd && parts.answersCostUsd > 0) {
    detail.push(`answers ${formatCostUsd(parts.answersCostUsd)}`);
  }
  if (parts.coverLetterCostUsd && parts.coverLetterCostUsd > 0) {
    detail.push(`cover letter ${formatCostUsd(parts.coverLetterCostUsd)}`);
  }

  const totalLabel = formatCostUsd(total);
  if (detail.length > 1) {
    return `${totalLabel} (${detail.join(", ")})`;
  }
  return totalLabel;
}
