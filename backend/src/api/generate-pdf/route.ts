import { NextRequest, NextResponse } from "next/server";
import { generateResumePdfBase64 } from "@/lib/generate-resume-pdf";
import { isValidResumeTemplate } from "@/lib/resume-templates";
import { AuthError, requireAuthClient } from "@/lib/supabase/server-client";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    await requireAuthClient(request);
    console.log("[generate-pdf] Auth OK", { elapsedMs: Date.now() - started });

    const { resume, template } = await request.json();
    console.log("[generate-pdf] Request parsed", {
      hasResume: Boolean(resume),
      template: typeof template === "string" ? template : undefined,
      elapsedMs: Date.now() - started,
    });

    if (!resume || typeof resume !== "object") {
      return NextResponse.json({ error: "Resume data is required" }, { status: 400 });
    }

    const selectedTemplate = isValidResumeTemplate(template || "") ? template : undefined;
    console.log("[generate-pdf] Calling generateResumePdfBase64", {
      template: selectedTemplate ?? "default",
      resumeName: typeof resume.name === "string" ? resume.name : undefined,
      experienceCount: Array.isArray(resume.experience) ? resume.experience.length : 0,
      elapsedMs: Date.now() - started,
    });

    const pdfBase64 = await generateResumePdfBase64(resume, selectedTemplate);

    console.log("[generate-pdf] Done", {
      base64Chars: pdfBase64.length,
      elapsedMs: Date.now() - started,
    });

    return NextResponse.json({ pdfBase64 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[generate-pdf] Failed", {
      elapsedMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
