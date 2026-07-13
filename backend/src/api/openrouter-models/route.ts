import { NextResponse } from "next/server";
import {
  FALLBACK_OPENROUTER_MODELS,
  formatProviderLabel,
  getSortedProviders,
  groupModelsByProvider,
  normalizeOpenRouterModel,
  type OpenRouterModel,
} from "@/lib/openrouter";
import { createFetchWithTimeout } from "@/lib/proxy-fetch";

const MODELS_CACHE_MS = 60 * 60 * 1000;
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
let cachedModels: OpenRouterModel[] | null = null;
let cachedAt = 0;
let lastFetchSource: "openrouter" | "fallback" = "fallback";

async function fetchModelsDirect(timeoutMs: number): Promise<Response> {
  return fetch(OPENROUTER_MODELS_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const now = Date.now();
  if (cachedModels && now - cachedAt < MODELS_CACHE_MS) {
    return cachedModels;
  }

  try {
    let response: Response;
    try {
      response = await fetchModelsDirect(12_000);
    } catch (directError) {
      console.warn("Direct OpenRouter models fetch failed, trying proxy:", directError);
      const fetchWithTimeout = createFetchWithTimeout(12_000);
      response = await fetchWithTimeout(OPENROUTER_MODELS_URL, {
        headers: { Accept: "application/json" },
      });
    }

    if (!response.ok) {
      throw new Error(`OpenRouter models API returned ${response.status}`);
    }

    const payload = (await response.json()) as { data?: unknown[] };
    const models = (payload.data ?? [])
      .map((item) =>
        normalizeOpenRouterModel(item as Parameters<typeof normalizeOpenRouterModel>[0])
      )
      .filter((item): item is OpenRouterModel => item !== null);

    if (models.length === 0) {
      throw new Error("OpenRouter models list was empty");
    }

    cachedModels = models;
    cachedAt = now;
    lastFetchSource = "openrouter";
    console.log(`[openrouter-models] Loaded ${models.length} models from OpenRouter`);
    return models;
  } catch (error) {
    console.warn("Failed to load OpenRouter models, using fallback list:", error);
    cachedModels = FALLBACK_OPENROUTER_MODELS;
    cachedAt = now;
    lastFetchSource = "fallback";
    return FALLBACK_OPENROUTER_MODELS;
  }
}

export async function GET() {
  const models = await fetchOpenRouterModels();
  const grouped = groupModelsByProvider(models);
  const providers = getSortedProviders(models).map((id) => ({
    id,
    label: formatProviderLabel(id),
    modelCount: grouped.get(id)?.length ?? 0,
  }));

  return NextResponse.json({
    models,
    providers,
    source: lastFetchSource,
  });
}
