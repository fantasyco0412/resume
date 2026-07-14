import { apiUrl, shouldSavePdfToServerDisk } from "@/lib/api-config";
import {
  savePdfBase64ToBrowserSubfolder,
  saveTextToBrowserSubfolder,
} from "@/lib/browser-downloads";
import {
  buildCoverLetterDownloadPaths,
  buildJobFolderDownloadPaths,
  buildResumeDownloadPaths,
  formatPdfSaveMessage,
  type ResumeDownloadPaths,
} from "@/lib/pdf-download-paths";
import type { UpdatedResume } from "@/lib/types/resume";

export type { ResumeDownloadPaths };
export { buildResumeDownloadPaths, formatPdfSaveMessage };

function downloadPdfViaBrowser(pdfBase64: string, fileName: string): void {
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Prefer company_role/ folder under the user’s Downloads; flat file if picker unavailable. */
async function savePdfInBrowser(
  pdfBase64: string,
  paths: ResumeDownloadPaths
): Promise<string> {
  const saved = await savePdfBase64ToBrowserSubfolder(
    pdfBase64,
    paths.dirName,
    paths.fileName
  );
  if (saved) return saved;
  downloadPdfViaBrowser(pdfBase64, `${paths.dirName} - ${paths.fileName}`);
  return `${paths.dirName} - ${paths.fileName}`;
}

async function saveTextInBrowser(
  content: string,
  paths: ResumeDownloadPaths
): Promise<string> {
  const saved = await saveTextToBrowserSubfolder(
    content,
    paths.dirName,
    paths.fileName
  );
  if (saved) return saved;
  downloadTextFile(content, `${paths.dirName} - ${paths.fileName}`);
  return `${paths.dirName} - ${paths.fileName}`;
}

const SAVE_PDF_API_TIMEOUT_MS = 120_000;
const SAVE_RESUME_PDF_API_TIMEOUT_MS = 180_000;

async function postSavePdf(
  endpoint: string,
  body: Record<string, unknown>,
  accessToken: string,
  _timeoutMs = SAVE_PDF_API_TIMEOUT_MS
): Promise<{ paths: ResumeDownloadPaths; savedPath: string }> {
  try {
    const response = await fetch(apiUrl(endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        typeof err.error === "string" ? err.error : "Failed to save PDF to Downloads"
      );
    }

    return (await response.json()) as { savedPath: string; paths: ResumeDownloadPaths };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    if (/aborted|abort/i.test(message)) {
      throw new Error(
        "PDF request was cancelled or timed out. Try again — the first PDF may take a minute while Chrome starts."
      );
    }
    throw error;
  }
}

async function generateResumePdfBase64(
  resume: UpdatedResume | Record<string, unknown>,
  accessToken: string,
  template?: string
): Promise<string> {
  const response = await fetch(apiUrl("/api/generate-pdf"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ resume, template }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : "Failed to generate PDF"
    );
  }

  const { pdfBase64 } = (await response.json()) as { pdfBase64?: string };
  const normalized = pdfBase64 ? String(pdfBase64).trim() : "";
  if (!normalized) {
    throw new Error("PDF generation returned empty data");
  }
  return normalized;
}

export function downloadTextFile(content: string, fileName: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function savePdfToDownloadsFolder(
  pdfBase64: string,
  options: {
    companyName: string;
    jobRole: string;
    personName: string;
    fileName?: string;
    accessToken?: string | null;
  }
): Promise<{ paths: ResumeDownloadPaths; savedPath: string }> {
  const paths = options.fileName?.trim()
    ? buildJobFolderDownloadPaths(options.companyName, options.jobRole, options.fileName.trim())
    : buildResumeDownloadPaths(options.companyName, options.jobRole, options.personName);

  const browserFileName = `${paths.dirName} - ${paths.fileName}`;

  // Remote API (VPS): save under user's Downloads/<company_role>/ via folder picker.
  if (!shouldSavePdfToServerDisk() || !options.accessToken) {
    const savedPath = await savePdfInBrowser(pdfBase64, paths);
    return { paths, savedPath };
  }

  try {
    return await postSavePdf(
      "/api/save-pdf",
      {
        pdfBase64,
        companyName: options.companyName,
        jobRole: options.jobRole,
        personName: options.personName,
        fileName: options.fileName,
      },
      options.accessToken
    );
  } catch (error) {
    console.warn("Server save to Downloads failed, falling back to browser download:", error);
    const savedPath = await savePdfInBrowser(pdfBase64, paths);
    return { paths, savedPath };
  }
}

export async function saveResumePdfToDownloadsFolder(
  resume: UpdatedResume | Record<string, unknown>,
  options: {
    companyName: string;
    jobRole: string;
    personName: string;
    template?: string;
    fileName?: string;
    accessToken?: string | null;
  }
): Promise<{ paths: ResumeDownloadPaths; savedPath: string }> {
  const paths = options.fileName?.trim()
    ? buildJobFolderDownloadPaths(options.companyName, options.jobRole, options.fileName.trim())
    : buildResumeDownloadPaths(options.companyName, options.jobRole, options.personName);

  if (!options.accessToken) {
    throw new Error("You must be signed in to save PDF to Downloads");
  }

  if (!shouldSavePdfToServerDisk()) {
    const pdfBase64 = await generateResumePdfBase64(
      resume,
      options.accessToken,
      options.template
    );
    const savedPath = await savePdfInBrowser(pdfBase64, paths);
    return { paths, savedPath };
  }

  return postSavePdf(
    "/api/save-resume-pdf",
    {
      resume,
      template: options.template,
      companyName: options.companyName,
      jobRole: options.jobRole,
      personName: options.personName,
      fileName: options.fileName,
    },
    options.accessToken,
    SAVE_RESUME_PDF_API_TIMEOUT_MS
  );
}

/** Generate PDF on server, then download to the user's machine (browser) when API is remote. */
export async function saveGeneratedResumeToDownloads(
  resume: UpdatedResume | Record<string, unknown>,
  _pdfBase64: string | undefined,
  options: {
    companyName: string;
    jobRole: string;
    personName: string;
    template?: string;
    accessToken?: string | null;
  }
): Promise<{ paths: ResumeDownloadPaths; savedPath: string }> {
  const paths = buildResumeDownloadPaths(
    options.companyName,
    options.jobRole,
    options.personName
  );

  if (!options.accessToken) {
    throw new Error("You must be signed in to download a resume");
  }

  const normalized = await generateResumePdfBase64(
    resume,
    options.accessToken,
    options.template
  );

  return savePdfToDownloadsFolder(normalized, {
    companyName: options.companyName,
    jobRole: options.jobRole,
    personName: options.personName,
    accessToken: options.accessToken,
  });
}

export async function saveCoverLetterPdfToDownloadsFolder(
  text: string,
  options: {
    companyName: string;
    jobRole: string;
    accessToken?: string | null;
  }
): Promise<{ paths: ResumeDownloadPaths; savedPath: string }> {
  const paths = buildCoverLetterDownloadPaths(options.companyName, options.jobRole);

  const response = await fetch(apiUrl("/api/generate-cover-letter-pdf"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || response.statusText || "Failed to generate cover letter PDF");
  }

  const { pdfBase64 } = (await response.json()) as { pdfBase64: string };

  return savePdfToDownloadsFolder(pdfBase64, {
    companyName: options.companyName,
    jobRole: options.jobRole,
    personName: "cover-letter",
    fileName: paths.fileName,
    accessToken: options.accessToken,
  });
}

export async function saveTextToDownloadsFolder(
  content: string,
  options: {
    companyName: string;
    jobRole: string;
    personName?: string;
    fileName?: string;
    accessToken?: string | null;
  }
): Promise<{ paths: ResumeDownloadPaths; savedPath: string }> {
  const fileName = options.fileName?.trim() || "Cover Letter.txt";
  const paths = buildJobFolderDownloadPaths(
    options.companyName,
    options.jobRole,
    fileName
  );

  if (!shouldSavePdfToServerDisk() || !options.accessToken) {
    const savedPath = await saveTextInBrowser(content, paths);
    return { paths, savedPath };
  }

  const response = await fetch(apiUrl("/api/save-text"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.accessToken}`,
    },
    body: JSON.stringify({
      content,
      companyName: options.companyName,
      jobRole: options.jobRole,
      personName: options.personName ?? "resume",
      fileName,
    }),
  });

  if (response.ok) {
    const data = (await response.json()) as { savedPath: string; paths: ResumeDownloadPaths };
    return { paths: data.paths, savedPath: data.savedPath };
  }

  const savedPath = await saveTextInBrowser(content, paths);
  return { paths, savedPath };
}
