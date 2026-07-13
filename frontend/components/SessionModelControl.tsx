"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_OPENROUTER_MODEL,
  FALLBACK_OPENROUTER_MODELS,
  formatProviderLabel,
  getSortedProviders,
  pickDefaultModelForProvider,
  type OpenRouterModel,
} from "@/lib/openrouter-shared";
import {
  DIRECT_AI_PROVIDERS,
  formatDirectProviderLabel,
  isDirectAIProvider,
  type DirectAIProvider,
  type DirectProviderModels,
} from "@/lib/direct-ai-shared";
import { apiUrl } from "@/lib/api-config";

const MODELS_FETCH_TIMEOUT_MS = 25_000;

const compactSelectClass =
  "h-6 max-w-[9rem] truncate rounded-md border border-slate-200 bg-white px-1.5 text-[11px] text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-blue-500 dark:focus:ring-blue-500/30";

interface SessionModelControlProps {
  useOpenRouter: boolean;
  aiProvider: string;
  aiModel: string;
  directModels: DirectProviderModels;
  disabled?: boolean;
  onChange: (next: { aiProvider: string; aiModel: string }) => void;
}

export default function SessionModelControl({
  useOpenRouter,
  aiProvider,
  aiModel,
  directModels,
  disabled = false,
  onChange,
}: SessionModelControlProps) {
  const [editing, setEditing] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>(
    FALLBACK_OPENROUTER_MODELS
  );

  useEffect(() => {
    if (!useOpenRouter) return;

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort("OpenRouter models fetch timed out");
    }, MODELS_FETCH_TIMEOUT_MS);

    void (async () => {
      try {
        const response = await fetch(apiUrl("/api/openrouter-models"), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Failed to load models");
        const data = (await response.json()) as { models?: OpenRouterModel[] };
        if (!cancelled && data.models?.length) {
          setOpenRouterModels(data.models);
        }
      } catch {
        // fallback list already set
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [useOpenRouter]);

  const openRouterProviders = useMemo(
    () => getSortedProviders(openRouterModels),
    [openRouterModels]
  );

  const openRouterModelsForProvider = useMemo(
    () => openRouterModels.filter((model) => model.provider === aiProvider),
    [openRouterModels, aiProvider]
  );

  const closeEditing = useCallback(() => setEditing(false), []);

  useEffect(() => {
    if (!editing) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeEditing();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEditing();
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeEditing, editing]);

  if (!aiModel.trim()) return null;

  if (editing && !disabled) {
    if (useOpenRouter) {
      return (
        <span ref={rootRef} className="inline-flex flex-wrap items-center gap-1">
          <span className="font-medium text-slate-400 dark:text-slate-500">Model</span>
          <select
            value={aiProvider}
            onChange={(event) => {
              const provider = event.target.value;
              const nextModel =
                pickDefaultModelForProvider(
                  openRouterModels.filter((model) => model.provider === provider),
                  provider
                ) || DEFAULT_OPENROUTER_MODEL;
              onChange({ aiProvider: provider, aiModel: nextModel });
            }}
            className={compactSelectClass}
            aria-label="AI provider"
          >
            {openRouterProviders.map((provider) => (
              <option key={provider} value={provider}>
                {formatProviderLabel(provider)}
              </option>
            ))}
          </select>
          <select
            value={aiModel}
            onChange={(event) => onChange({ aiProvider, aiModel: event.target.value })}
            className={`${compactSelectClass} max-w-[11rem]`}
            aria-label="AI model"
          >
            {openRouterModelsForProvider.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </span>
      );
    }

    const directProvider: DirectAIProvider = isDirectAIProvider(aiProvider)
      ? aiProvider
      : "openai";

    return (
      <span ref={rootRef} className="inline-flex flex-wrap items-center gap-1">
        <span className="font-medium text-slate-400 dark:text-slate-500">Model</span>
        <select
          value={directProvider}
          onChange={(event) => {
            const provider = event.target.value as DirectAIProvider;
            onChange({ aiProvider: provider, aiModel: directModels[provider] });
          }}
          className={compactSelectClass}
          aria-label="AI provider"
        >
          {DIRECT_AI_PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {formatDirectProviderLabel(provider)}
            </option>
          ))}
        </select>
        <span
          className="max-w-[11rem] truncate text-slate-700 dark:text-slate-200"
          title={directModels[directProvider]}
        >
          {directModels[directProvider]}
        </span>
      </span>
    );
  }

  return (
    <span ref={rootRef}>
      <span className="font-medium text-slate-400 dark:text-slate-500">Model</span>{" "}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        className="max-w-[14rem] truncate text-left text-slate-700 underline decoration-slate-300 decoration-dotted underline-offset-2 hover:text-[#007fff] hover:decoration-[#007fff]/50 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50 dark:text-slate-200 dark:decoration-slate-600 dark:hover:text-blue-300"
        title={disabled ? undefined : "Change AI model for this job"}
      >
        {aiModel}
      </button>
    </span>
  );
}
