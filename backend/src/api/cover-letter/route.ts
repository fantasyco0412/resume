import { NextRequest, NextResponse } from "next/server";
import { requireAIConfigured, resolveAIRequest } from "@/lib/ai-api";
import { callAI } from "@/lib/ai-provider";
import type { AIMessage } from "@/lib/ai-provider";
import { normalizeCoverLetterText } from "@/lib/cover-letter-text";
import { AuthError, requireAuthClient } from "@/lib/supabase/server-client";

export async function POST(request: NextRequest) {
  try {
    await requireAuthClient(request);

    const { resume, jd, apiModel, apiProvider, useOpenRouter: useOpenRouterBody } =
      await request.json();

    if (!resume || typeof resume !== "object") {
      return NextResponse.json(
        { error: "Resume data is required" },
        { status: 400 }
      );
    }

    const aiRequest = resolveAIRequest({
      useOpenRouter: useOpenRouterBody,
      apiModel,
      apiProvider,
    });
    requireAIConfigured(aiRequest.useOpenRouter, aiRequest.provider);
    const selectedModel = aiRequest.model;

    const resumeJson = JSON.stringify(resume, null, 2);
    const jobDesc = typeof jd === "string" && jd.trim() ? jd.trim() : "this role";
    const candidateName = (resume.name && String(resume.name).trim()) || "Candidate";

    const coverLetterInstructions = `You are writing a short cover letter for a job application. Given the candidate's resume (JSON) and the job context, write a cover letter.

STRICT FORMAT REQUIREMENTS:
1. The letter MUST start with exactly: "Dear Hiring Team,"
2. After that, write 3 to 4 sentences in the body. Be professional and concise. Use only information from the resume.
3. The letter MUST end with exactly (on separate lines):
   "Best Regards."
   (blank line)
   the candidate's name from the resume

CRITICAL OUTPUT RULES:
- Return ONLY plain text (the letter itself).
- Do NOT return JSON, arrays, objects, markdown fences, or quoted string lists.
- Do NOT wrap sentences in ["...","..."].`;

    const userPrompt = `Resume (JSON):
${resumeJson}

Job context:
${jobDesc}

Candidate name for sign-off: ${candidateName}

Write the cover letter as plain text only.`;

    let coverLetterCostUsd: number | undefined;

    const messages: AIMessage[] = [
      { role: "system", content: coverLetterInstructions },
      { role: "user", content: userPrompt },
    ];

    const aiResp = await callAI({
      useOpenRouter: aiRequest.useOpenRouter,
      model: selectedModel,
      ...(aiRequest.provider ? { provider: aiRequest.provider } : {}),
      messages,
      temperature: 0.4,
      max_tokens: 1024,
      tryParseJson: false,
    });

    const raw = aiResp.text || "";
    if (aiResp.costUsd != null) {
      coverLetterCostUsd = aiResp.costUsd;
    }

    if (!raw.trim()) {
      throw new Error("Cover letter response was empty");
    }

    const coverLetter = normalizeCoverLetterText(raw, candidateName);

    return NextResponse.json({
      coverLetter,
      ...(coverLetterCostUsd != null ? { coverLetterCostUsd } : {}),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error generating cover letter:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate cover letter",
      },
      { status: 500 }
    );
  }
}
