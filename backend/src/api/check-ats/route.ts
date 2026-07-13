import { NextRequest, NextResponse } from "next/server";
import {
  parseUseOpenRouter,
  requireAIConfigured,
  resolveExtractMaxTokens,
  resolveExtractModel,
  resolveExtractProvider,
} from "@/lib/ai-api";
import { callAI, formatAIProviderError } from "@/lib/ai-provider";
import type { AIMessage } from "@/lib/ai-provider";
import { buildAtsMatchPrompt } from "@/lib/prompts/ats-match";
import {
  isEmptyAtsMatchResult,
  parseAtsFromAiResponse,
} from "@/lib/types/ats-match";
import { AuthError, requireAuthClient } from "@/lib/supabase/server-client";

export async function POST(request: NextRequest) {
  try {
    await requireAuthClient(request);

    const {
      resume,
      jd,
      useOpenRouter: useOpenRouterBody,
    } = await request.json();

    if (!resume || typeof resume !== "object") {
      return NextResponse.json({ error: "Resume data is required" }, { status: 400 });
    }

    const jobDescription = typeof jd === "string" ? jd.trim() : "";
    if (!jobDescription) {
      return NextResponse.json(
        { error: "Job description is required" },
        { status: 400 }
      );
    }

    const useOpenRouter = parseUseOpenRouter(useOpenRouterBody);
    const extractProvider = resolveExtractProvider(useOpenRouter);
    requireAIConfigured(useOpenRouter, extractProvider);

    const extractModel = resolveExtractModel(useOpenRouter);

    const resumeJson = JSON.stringify(resume, null, 2);
    const messages: AIMessage[] = [
      {
        role: "system",
        content:
          "You are an ATS resume analyst. Respond with valid JSON only — no markdown fences or extra commentary.",
      },
      {
        role: "user",
        content: buildAtsMatchPrompt(jobDescription, resumeJson),
      },
    ];

    const aiResp = await callAI({
      useOpenRouter,
      model: extractModel,
      ...(extractProvider ? { provider: extractProvider } : {}),
      messages,
      temperature: 0.2,
      max_tokens: resolveExtractMaxTokens(),
      tryParseJson: true,
    });

    const result = parseAtsFromAiResponse({
      json: aiResp.json,
      text: aiResp.text,
      raw: aiResp.raw,
    });
    if (isEmptyAtsMatchResult(result)) {
      console.warn("[check-ats] Empty parse result", {
        hasJson: Boolean(aiResp.json),
        textPreview: String(aiResp.text || "").slice(0, 800),
        jsonPreview: aiResp.json ? JSON.stringify(aiResp.json).slice(0, 800) : null,
      });
      throw new Error(
        "ATS analysis returned empty results. Try again or check EXTRACT_MODEL / OPENROUTER_EXTRACT_MODEL in backend .env.local."
      );
    }

    return NextResponse.json({
      ats: result,
      ...(aiResp.costUsd != null ? { atsCostUsd: aiResp.costUsd } : {}),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error checking ATS match:", error);
    const message =
      error instanceof Error ? error.message : "Failed to check ATS match";
    return NextResponse.json(
      {
        error:
          message.startsWith("ATS analysis") || message.includes("API")
            ? message
            : formatAIProviderError(error),
      },
      { status: 500 }
    );
  }
}
