import { mkdir, writeFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { buildJobFolderDownloadFilePath } from "@/lib/pdf-download-paths";
import { AuthError, requireAuthClient } from "@/lib/supabase/server-client";

export async function POST(request: NextRequest) {
  try {
    await requireAuthClient(request);

    const { content, companyName, jobRole, fileName } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Text content is required" }, { status: 400 });
    }

    const resolvedFileName =
      typeof fileName === "string" && fileName.trim() ? fileName.trim() : "Cover Letter.txt";

    const { paths, absolutePath, dirPath } = buildJobFolderDownloadFilePath(
      typeof companyName === "string" ? companyName : "",
      typeof jobRole === "string" ? jobRole : "",
      resolvedFileName
    );

    await mkdir(dirPath, { recursive: true });
    await writeFile(absolutePath, content, "utf-8");

    return NextResponse.json({
      savedPath: absolutePath,
      paths,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to save text to Downloads:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save text file" },
      { status: 500 }
    );
  }
}
