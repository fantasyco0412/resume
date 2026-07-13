import { apiUrl } from "@/lib/api-config";
import type { AnalysisResult } from "@/lib/types/resume";
import type { AtsMatchResult } from "@/lib/types/ats-match";

export interface AtsMatchResponse {
  ats: AtsMatchResult;
  atsCostUsd?: number;
}

export async function fetchAtsMatch(options: {
  resume: AnalysisResult;
  jd: string;
  apiModel: string;
  apiProvider: string;
  useOpenRouter: boolean;
  accessToken: string;
}): Promise<AtsMatchResponse> {
  const response = await fetch(apiUrl("/api/check-ats"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.accessToken}`,
    },
    body: JSON.stringify({
      resume: options.resume,
      jd: options.jd,
      apiModel: options.apiModel,
      apiProvider: options.apiProvider,
      useOpenRouter: options.useOpenRouter,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : "Failed to check ATS match"
    );
  }

  const data = (await response.json()) as { ats?: AtsMatchResult; atsCostUsd?: number };
  if (!data.ats) {
    throw new Error("ATS analysis returned empty results");
  }
  return { ats: data.ats, atsCostUsd: data.atsCostUsd };
}

export function formatAtsScoreLabel(score: number): string {
  if (score >= 80) return "Strong match";
  if (score >= 60) return "Moderate match";
  return "Weak match";
}

export function atsScoreTextClass(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}
