import { NextRequest, NextResponse } from "next/server";
import { generateCoverLetterPdfBase64 } from "@/lib/pdf-from-html";
import { AuthError, requireAuthClient } from "@/lib/supabase/server-client";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    await requireAuthClient(request);

    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Cover letter text is required" }, { status: 400 });
    }

    const pdfBase64 = await generateCoverLetterPdfBase64(text);

    return NextResponse.json({ pdfBase64 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to generate cover letter PDF:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate cover letter PDF" },
      { status: 500 }
    );
  }
}
