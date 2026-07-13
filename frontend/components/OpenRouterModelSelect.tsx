"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_OPENROUTER_MODEL,
  FALLBACK_OPENROUTER_MODELS,
  formatProviderLabel,
  getSortedProviders,
  pickDefaultModelForProvider,
  type OpenRouterModel,
} from "@/lib/openrouter-shared";
import { apiUrl } from "@/lib/api-config";

const MODELS_FETCH_TIMEOUT_MS = 25_000;

interface OpenRouterModelSelectProps {
  aiProvider: string;
  aiModel: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

export default function OpenRouterModelSelect({
  aiProvider,
  aiModel,
  onProviderChange,
  onModelChange,
  disabled = false,
}: OpenRouterModelSelectProps) {
  const [models, setModels] = useState<OpenRouterModel[]>(FALLBACK_OPENROUTER_MODELS);
  const [refreshing, setRefreshing] = useState(true);
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort("OpenRouter models fetch timed out");
    }, MODELS_FETCH_TIMEOUT_MS);

    (async () => {
      try {
        const response = await fetch(apiUrl("/api/openrouter-models"), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Failed to load models");
        const data = (await response.json()) as {
          models?: OpenRouterModel[];
          source?: string;
        };
        if (!cancelled && data.models?.length) {
          setModels(data.models);
          setUsingFallback(data.source === "fallback");
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Using fallback OpenRouter models:", error);
          setUsingFallback(true);
        }
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setRefreshing(false);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  const providers = useMemo(() => getSortedProviders(models), [models]);

  const modelsForProvider = useMemo(
    () => models.filter((model) => model.provider === aiProvider),
    [models, aiProvider]
  );

  useEffect(() => {
    if (!providers.length) return;

    const providerExists = providers.includes(aiProvider);
    const nextProvider = providerExists ? aiProvider : providers[0];
    if (nextProvider !== aiProvider) {
      onProviderChange(nextProvider);
    }
  }, [providers, aiProvider, onProviderChange]);

  useEffect(() => {
    if (!modelsForProvider.length) return;

    const modelExists = modelsForProvider.some((model) => model.id === aiModel);
    if (!modelExists) {
      const fallback =
        pickDefaultModelForProvider(modelsForProvider, aiProvider) ||
        modelsForProvider[0]?.id ||
        DEFAULT_OPENROUTER_MODEL;
      if (fallback && fallback !== aiModel) {
        onModelChange(fallback);
      }
    }
  }, [modelsForProvider, aiProvider, aiModel, onModelChange]);

  return (
    <div className="contents">
      <div>
        <label htmlFor="aiProvider" className="label-kicker mb-2 block">
          AI provider
        </label>
        <select
          id="aiProvider"
          value={aiProvider}
          disabled={disabled}
          onChange={(e) => {
            const provider = e.target.value;
            onProviderChange(provider);
            const nextModel =
              pickDefaultModelForProvider(
                models.filter((m) => m.provider === provider),
                provider
              ) || DEFAULT_OPENROUTER_MODEL;
            onModelChange(nextModel);
          }}
          className="select-shell w-full text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {formatProviderLabel(provider)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="aiModel" className="label-kicker mb-2 block">
          Model
        </label>
        <select
          id="aiModel"
          value={aiModel}
          disabled={disabled || modelsForProvider.length === 0}
          onChange={(e) => onModelChange(e.target.value)}
          title={aiModel || undefined}
          className="select-shell w-full text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {modelsForProvider.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
        {refreshing && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Loading models from OpenRouter…
          </p>
        )}
        {!refreshing && usingFallback && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Offline list — restart the backend if models look wrong.
          </p>
        )}
      </div>
    </div>
  );
}
