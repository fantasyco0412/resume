import { NextRequest, NextResponse } from "next/server";
import { generateResumePdfBase64 } from "@/lib/generate-resume-pdf";
import { writePdfBase64ToDownloads } from "@/lib/save-pdf-to-disk";
import { isValidResumeTemplate } from "@/lib/resume-templates";
import { AuthError, requireAuthClient } from "@/lib/supabase/server-client";

export const maxDuration = 300;

function isServerDiskSaveEnabled(): boolean {
  const raw = process.env.SAVE_PDF_TO_SERVER_DISK?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    await requireAuthClient(request);

    if (!isServerDiskSaveEnabled()) {
      return NextResponse.json(
        {
          error:
            "Server disk save is disabled. Use /api/generate-pdf and download in the browser.",
        },
        { status: 403 }
      );
    }

    const { resume, template, companyName, jobRole, personName, fileName } =
      await request.json();

    if (!resume || typeof resume !== "object") {
      return NextResponse.json({ error: "Resume data is required" }, { status: 400 });
    }

    const selectedTemplate = isValidResumeTemplate(template || "") ? template : undefined;
    console.log("[save-resume-pdf] Generating PDF…");
    const pdfBase64 = await generateResumePdfBase64(resume, selectedTemplate);
    console.log("[save-resume-pdf] Saving to Downloads…");

    const { savedPath, paths } = await writePdfBase64ToDownloads(
      pdfBase64,
      typeof companyName === "string" ? companyName : "",
      typeof jobRole === "string" ? jobRole : "",
      typeof personName === "string" ? personName : "resume",
      typeof fileName === "string" ? fileName : undefined
    );

    return NextResponse.json({ savedPath, paths });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to save resume PDF:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save PDF" },
      { status: 500 }
    );
  }
}
