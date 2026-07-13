import {
  parseUseOpenRouter,
  requireAIConfigured,
  resolveExtractMaxTokens,
  resolveExtractModel,
  resolveExtractProvider,
} from "@/lib/ai-api";
import { callAI, extractFirstJson, formatAIProviderError } from "@/lib/ai-provider";
import { cleanJsonText } from "@/lib/analyze-json";
import { buildJobPageExtractPrompt } from "@/lib/prompts/job-page-extract";
import type { JobWorkType } from "@/lib/prompts/job-page-extract";
import { analyzeJobWorkType } from "@/lib/job-work-type";
import {
  extractPostedDateFromText,
  normalizePostedDate,
  pageHasRelativePostedDate,
} from "@/lib/job-posted-date";
import { normalizeJobDescription } from "@/lib/normalize-job-description";
import { inferIndustryLabelFromJd } from "@/lib/prompts/resume-industry-buzzwords";
import {
  extractSecurityClearanceFromText,
  normalizeSecurityClearance,
} from "@/lib/job-security-clearance";

export interface ExtractedJobInfo {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  jobLocation: string;
  industry: string;
  securityClearance: string;
  jobType: JobWorkType;
  jobTypes: JobWorkType[];
  requiresTravel: boolean;
  salary: string;
  postedDate: string;
}

const MAX_PAGE_CHARS = 48_000;

function normalizeField(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function parseExtractedJobJson(raw: unknown): ExtractedJobInfo {
  const data =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const jobTitle = normalizeField(data.jobTitle ?? data.title ?? data.job_title);
  const companyName = normalizeField(
    data.companyName ?? data.company ?? data.company_name
  );
  const jobDescription = normalizeJobDescription(
    data.jobDescription ?? data.job_description ?? data.description ?? data.jd
  );
  const salary = normalizeField(data.salary ?? data.compensation ?? data.pay);
  let jobLocation = normalizeField(
    data.jobLocation ?? data.job_location ?? data.location ?? data.workLocation
  );
  let industry = normalizeField(data.industry ?? data.jobIndustry ?? data.job_industry);
  let securityClearance = normalizeSecurityClearance(
    data.securityClearance ??
      data.security_clearance ??
      data.clearance ??
      data.requiredClearance ??
      data.required_clearance
  );
  const postedDate = normalizePostedDate(
    data.postedDate ??
      data.posted_date ??
      data.datePosted ??
      data.date_posted ??
      data.postingDate ??
      data.posting_date
  );

  const workTypeAnalysis = analyzeJobWorkType(
    jobDescription,
    data.jobType ?? data.job_type ?? data.workType ?? data.work_type,
    data.jobTypes ?? data.job_types ?? data.workTypes ?? data.work_types
  );

  if (!jobDescription) {
    throw new Error(
      "Could not extract a job description from the pasted content. Try pasting more of the posting."
    );
  }

  if (!industry) {
    industry = inferIndustryLabelFromJd(jobDescription);
  }

  if (!securityClearance) {
    securityClearance = extractSecurityClearanceFromText(jobDescription);
  }

  return {
    jobTitle,
    companyName,
    jobDescription,
    jobLocation,
    industry,
    securityClearance,
    jobType: workTypeAnalysis.jobType,
    jobTypes: workTypeAnalysis.jobTypes,
    requiresTravel: workTypeAnalysis.requiresTravel,
    salary,
    postedDate,
  };
}

function extractJobLocationFromText(text: string): string {
  const patterns = [
    /\b(?:job\s+location|work\s+location|office\s+location|location)\s*[:\-–]\s*([^\n|•]+)/i,
    /\b(?:based in|located in)\s+([A-Z][^.\n]{2,80})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = match[1].trim().replace(/\s+/g, " ");
      if (value.length > 0 && value.length <= 120) {
        return value;
      }
    }
  }

  return "";
}

function parseExtractAiResponse(aiResp: { json: unknown; text: string }): unknown {
  if (aiResp.json) return aiResp.json;

  const fromText = extractFirstJson(aiResp.text || "");
  if (fromText) return fromText;

  try {
    return JSON.parse(cleanJsonText(aiResp.text || "{}"));
  } catch {
    const preview = aiResp.text.slice(0, 100).replace(/\s+/g, " ").trim();
    throw new Error(
      `Job extract returned plain text instead of JSON${preview ? ` ("${preview}…")` : ""}. ` +
        "Try EXTRACT_MODEL=deepseek-chat or set EXTRACT_MAX_TOKENS=4096 in backend/.env.local."
    );
  }
}

export interface ExtractJobPageResult {
  extracted: ExtractedJobInfo;
  extractCostUsd?: number;
}

export async function extractJobFromPageContent(
  pageContent: string,
  options?: { useOpenRouter?: boolean }
): Promise<ExtractJobPageResult> {
  const trimmed = pageContent.trim();
  if (!trimmed) {
    throw new Error("Job page content is required");
  }

  const useOpenRouter = parseUseOpenRouter(options?.useOpenRouter);
  const extractProvider = resolveExtractProvider(useOpenRouter);
  requireAIConfigured(useOpenRouter, extractProvider);
  const extractModel = resolveExtractModel(useOpenRouter);
  const clipped =
    trimmed.length > MAX_PAGE_CHARS
      ? `${trimmed.slice(0, MAX_PAGE_CHARS)}\n\n[truncated]`
      : trimmed;

  try {
    const aiResp = await callAI({
      useOpenRouter,
      model: extractModel,
      ...(extractProvider ? { provider: extractProvider } : {}),
      messages: [
        {
          role: "system",
          content:
            "You extract job posting fields. Respond with a single valid JSON object only — no markdown, no prose, no explanation.",
        },
        { role: "user", content: buildJobPageExtractPrompt(clipped) },
      ],
      temperature: 0.1,
      max_tokens: resolveExtractMaxTokens(),
      tryParseJson: true,
    });

    const parsed = parseExtractAiResponse(aiResp);

    let extracted = parseExtractedJobJson(parsed);
    const fromPage = extractPostedDateFromText(clipped);
    if (fromPage && (pageHasRelativePostedDate(clipped) || !extracted.postedDate)) {
      extracted = { ...extracted, postedDate: fromPage };
    }
    if (!extracted.jobLocation) {
      const fromPage =
        extractJobLocationFromText(clipped) ||
        extractJobLocationFromText(extracted.jobDescription);
      if (fromPage) {
        extracted = { ...extracted, jobLocation: fromPage };
      }
    }
    if (!extracted.securityClearance) {
      const fromPage =
        extractSecurityClearanceFromText(clipped) ||
        extractSecurityClearanceFromText(extracted.jobDescription);
      if (fromPage) {
        extracted = { ...extracted, securityClearance: fromPage };
      }
    }

    return {
      extracted,
      extractCostUsd: aiResp.costUsd,
    };
  } catch (err: unknown) {
    const elapsedMs =
      err && typeof err === "object" && "elapsedMs" in err
        ? Number((err as { elapsedMs?: number }).elapsedMs)
        : undefined;
    throw new Error(
      formatAIProviderError(err, extractModel, elapsedMs, {
        useOpenRouter,
        provider: extractProvider,
      })
    );
  }
}
