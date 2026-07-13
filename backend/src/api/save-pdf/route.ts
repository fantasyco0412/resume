import { NextRequest, NextResponse } from "next/server";
import { writePdfBase64ToDownloads } from "@/lib/save-pdf-to-disk";
import { AuthError, requireAuthClient } from "@/lib/supabase/server-client";

export async function POST(request: NextRequest) {
  try {
    await requireAuthClient(request);

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
