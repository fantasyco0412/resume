import path from "path";
import os from "os";

export interface ResumeDownloadPaths {
  dirName: string;
  fileName: string;
}

export function sanitizePathSegment(value: string, fallback: string): string {
  const cleaned = (value.trim() || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return cleaned || fallback;
}

export function buildResumeDownloadPaths(
  companyName: string,
  jobRole: string,
  personName: string
): ResumeDownloadPaths {
  const company = sanitizePathSegment(companyName, "company");
  const role = sanitizePathSegment(jobRole, "role");
  const name = sanitizePathSegment(personName, "resume");
  return {
    dirName: `${company}_${role}`,
    fileName: `${name}.pdf`,
  };
}

export function getSystemDownloadsDir(): string {
  if (process.platform === "win32") {
    const userProfile = process.env.USERPROFILE;
    if (userProfile) {
      return path.join(userProfile, "Downloads");
    }
  }

  return path.join(os.homedir(), "Downloads");
}

export function buildResumeDownloadFilePath(
  companyName: string,
  jobRole: string,
  personName: string
): { paths: ResumeDownloadPaths; absolutePath: string; dirPath: string } {
  const paths = buildResumeDownloadPaths(companyName, jobRole, personName);
  const dirPath = path.join(getSystemDownloadsDir(), paths.dirName);
  const absolutePath = path.join(dirPath, paths.fileName);
  return { paths, absolutePath, dirPath };
}

export function buildJobFolderDownloadPaths(
  companyName: string,
  jobRole: string,
  fileName: string
): ResumeDownloadPaths {
  const company = sanitizePathSegment(companyName, "company");
  const role = sanitizePathSegment(jobRole, "role");
  return {
    dirName: `${company}_${role}`,
    fileName,
  };
}

export function buildJobFolderDownloadFilePath(
  companyName: string,
  jobRole: string,
  fileName: string
): { paths: ResumeDownloadPaths; absolutePath: string; dirPath: string } {
  const paths = buildJobFolderDownloadPaths(companyName, jobRole, fileName);
  const dirPath = path.join(getSystemDownloadsDir(), paths.dirName);
  const absolutePath = path.join(dirPath, paths.fileName);
  return { paths, absolutePath, dirPath };
}

export function buildCoverLetterDownloadPaths(
  companyName: string,
  jobRole: string,
  _personName?: string
): ResumeDownloadPaths {
  return buildJobFolderDownloadPaths(companyName, jobRole, "Cover Letter.pdf");
}

export function buildJobDescriptionDownloadPaths(
  companyName: string,
  jobRole: string
): ResumeDownloadPaths {
  return buildJobFolderDownloadPaths(companyName, jobRole, "Job Description.txt");
}

export function buildJobDescriptionDownloadFilePath(
  companyName: string,
  jobRole: string
): { paths: ResumeDownloadPaths; absolutePath: string; dirPath: string } {
  return buildJobFolderDownloadFilePath(companyName, jobRole, "Job Description.txt");
}

export function buildCoverLetterDownloadFilePath(
  companyName: string,
  jobRole: string,
  personName: string
): { paths: ResumeDownloadPaths; absolutePath: string; dirPath: string } {
  return buildJobFolderDownloadFilePath(companyName, jobRole, "Cover Letter.pdf");
}

export function formatPdfSaveMessage(savedPath: string, savedToHistory: boolean): string {
  if (savedToHistory) {
    return `Saved to History and downloaded to ${savedPath}`;
  }
  return `PDF saved to ${savedPath}`;
}
