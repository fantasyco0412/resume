"use client";

import {
  DIRECT_AI_PROVIDERS,
  formatDirectProviderLabel,
  type DirectAIProvider,
  type DirectProviderModels,
} from "@/lib/direct-ai-shared";

interface DirectProviderModelSelectProps {
  aiProvider: DirectAIProvider;
  aiModel: string;
  directModels: DirectProviderModels;
  onProviderChange: (provider: DirectAIProvider) => void;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

export default function DirectProviderModelSelect({
  aiProvider,
  aiModel,
  directModels,
  onProviderChange,
  onModelChange,
  disabled = false,
}: DirectProviderModelSelectProps) {
  return (
    <div className="contents">
      <div>
        <label htmlFor="directAiProvider" className="label-kicker mb-2 block">
          AI provider
        </label>
        <select
          id="directAiProvider"
          value={aiProvider}
          disabled={disabled}
          onChange={(e) => {
            const provider = e.target.value as DirectAIProvider;
            onProviderChange(provider);
            onModelChange(directModels[provider]);
          }}
          className="select-shell w-full text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {DIRECT_AI_PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {formatDirectProviderLabel(provider)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="directAiModel" className="label-kicker mb-2 block">
          Model
        </label>
        <input
          id="directAiModel"
          type="text"
          value={aiModel}
          readOnly
          disabled={disabled}
          className="input-shell w-full text-xs disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    </div>
  );
}
