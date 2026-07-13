import { mkdir, writeFile } from "fs/promises";
import {
  buildJobFolderDownloadFilePath,
  buildResumeDownloadFilePath,
  type ResumeDownloadPaths,
} from "@/lib/pdf-download-paths";

export async function writePdfBase64ToDownloads(
  pdfBase64: string,
  companyName: string,
  jobRole: string,
  personName: string,
  fileName?: string
): Promise<{ savedPath: string; paths: ResumeDownloadPaths }> {
  const { paths, absolutePath, dirPath } =
    fileName?.trim()
      ? buildJobFolderDownloadFilePath(companyName, jobRole, fileName.trim())
      : buildResumeDownloadFilePath(companyName, jobRole, personName);

  const pdfBuffer = Buffer.from(pdfBase64, "base64");
  if (pdfBuffer.length === 0) {
    throw new Error("Invalid PDF data");
  }

  await mkdir(dirPath, { recursive: true });
  await writeFile(absolutePath, pdfBuffer);

  return { savedPath: absolutePath, paths };
}
