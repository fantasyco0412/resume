import { NextRequest, NextResponse } from "next/server";
import { requireAIConfigured, resolveAIRequest } from "@/lib/ai-api";
import { callAI } from "@/lib/ai-provider";
import type { AIMessage } from "@/lib/ai-provider";
import { AuthError, requireAuthClient } from "@/lib/supabase/server-client";

export async function POST(request: NextRequest) {
  try {
    await requireAuthClient(request);

    const { questions, resume, apiModel, apiProvider, useOpenRouter: useOpenRouterBody } =
      await request.json();

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "At least one question is required" },
        { status: 400 }
      );
    }

    if (!resume || typeof resume !== "object") {
      return NextResponse.json(
        { error: "Resume data is required" },
        { status: 400 }
      );
    }

    const questionsList = questions
      .map((q: string) => String(q).trim())
      .filter(Boolean);
    if (questionsList.length === 0) {
      return NextResponse.json(
        { error: "No valid questions provided" },
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
    const questionsText = questionsList.map((q, i) => `${i + 1}. ${q}`).join("\n");

    const systemPrompt = `You are the candidate in a job interview. Answer each question as the candidate would, in first person using "I". Do NOT use the candidate's name (e.g. never say "Daniel" or the candidate's name in the answer). Be concise (2–4 sentences per answer). Use details from the resume when relevant. When asked whether the candidate has experience with a skill, technology, or domain, answer yes when it is plausible from the resume; do not say no solely because it is not explicitly listed—frame answers positively. If the resume does not contain enough information, answer briefly in first person without using the candidate's name.`;

    const userPrompt = `Resume (JSON):
${resumeJson}

Questions to answer (use resume content only):
${questionsText}

Return a JSON array with one object per question in the same order: [{"question": "exact question text", "answer": "your answer based on resume"}]`;

    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const aiResp = await callAI({
      useOpenRouter: aiRequest.useOpenRouter,
      model: selectedModel,
      ...(aiRequest.provider ? { provider: aiRequest.provider } : {}),
      messages,
      temperature: 0.3,
      max_tokens: 2048,
      tryParseJson: true,
    });

    let jsonText: string;
    if (aiResp.json) {
      jsonText = typeof aiResp.json === "string" ? aiResp.json : JSON.stringify(aiResp.json);
    } else {
      jsonText = aiResp.text || "";
    }

    let parsed: { answers?: { question: string; answer: string }[] } | { question: string; answer: string }[];
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    parsed = JSON.parse(jsonText);

    const raw = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { answers?: unknown[] }).answers)
        ? (parsed as { answers: { question: string; answer: string }[] }).answers
        : [];

    const answers: { question: string; answer: string }[] = questionsList.map((q, i) => {
      const item = raw[i];
      if (item && typeof item === "object" && "answer" in item) {
        return { question: String((item as { question?: string }).question ?? q), answer: String((item as { answer: string }).answer) };
      }
      return { question: q, answer: "Could not generate an answer for this question." };
    });

    return NextResponse.json({
      answers,
      ...(aiResp.costUsd != null ? { answersCostUsd: aiResp.costUsd } : {}),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error answering questions:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate answers",
      },
      { status: 500 }
    );
  }
}
