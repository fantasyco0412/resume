import { NextRequest, NextResponse } from "next/server";
import { writePdfBase64ToDownloads } from "@/lib/save-pdf-to-disk";
import { AuthError, requireAuthClient } from "@/lib/supabase/server-client";

/** Local same-machine only. On VPS set SAVE_PDF_TO_SERVER_DISK=false (or leave frontend to skip). */
function isServerDiskSaveEnabled(): boolean {
  const raw = process.env.SAVE_PDF_TO_SERVER_DISK?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  // Default: allow (local Windows workflow). Frontend skips calling this on remote APIs.
  return true;
}

export async function POST(request: NextRequest) {
  try {
    await requireAuthClient(request);

    if (!isServerDiskSaveEnabled()) {
      return NextResponse.json(
        {
          error:
            "Server disk save is disabled. PDFs are downloaded in the browser instead.",
        },
        { status: 403 }
      );
    }

    const { pdfBase64, companyName, jobRole, personName, fileName } = await request.json();

    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return NextResponse.json({ error: "PDF data is required" }, { status: 400 });
    }

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
    console.error("Failed to save PDF to Downloads:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save PDF" },
      { status: 500 }
    );
  }
}
