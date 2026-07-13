import { NextRequest, NextResponse } from "next/server";
import { extractJobFromPageContent } from "@/lib/extract-job-page";
import { AuthError, requireAuthClient } from "@/lib/supabase/server-client";

export async function POST(request: NextRequest) {
  try {
    await requireAuthClient(request);

    const { pageContent, useOpenRouter: useOpenRouterBody } = await request.json();
    if (!pageContent || typeof pageContent !== "string") {
      return NextResponse.json(
        { error: "Job page content is required" },
        { status: 400 }
      );
    }

    const { extracted, extractCostUsd } = await extractJobFromPageContent(pageContent, {
      useOpenRouter: useOpenRouterBody,
    });
    return NextResponse.json({ ...extracted, extractCostUsd });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error extracting job info:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to extract job information",
      },
      { status: 500 }
    );
  }
}
