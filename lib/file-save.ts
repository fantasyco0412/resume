/**
 * Save a Blob via the native "Save As" dialog when available
 * (Chrome/Edge + HTTPS or localhost). Falls back to a normal download.
 */

export class SaveCancelledError extends Error {
  constructor(message = "Save cancelled") {
    super(message);
    this.name = "SaveCancelledError";
  }
}

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
    excludeAcceptAllOption?: boolean;
    startIn?: string;
  }) => Promise<FileSystemFileHandle>;
};

function downloadBlobViaAnchor(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function canUseSaveFilePicker(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  return typeof (window as SaveFilePickerWindow).showSaveFilePicker === "function";
}

/**
 * Opens a file save dialog (when supported) so the user picks folder + filename.
 * Returns the saved file name. Throws SaveCancelledError if the user cancels.
 */
export async function saveBlobWithDialog(
  blob: Blob,
  suggestedFileName: string,
  options?: {
    description?: string;
    mimeType?: string;
    extension?: string;
  }
): Promise<string> {
  const fileName = suggestedFileName.trim() || "download.bin";
  const mimeType = options?.mimeType || blob.type || "application/octet-stream";
  const extension = options?.extension || (fileName.includes(".") ? `.${fileName.split(".").pop()}` : "");
  const description = options?.description || "File";

  if (canUseSaveFilePicker()) {
    try {
      const picker = (window as SaveFilePickerWindow).showSaveFilePicker!;
      const accept: Record<string, string[]> = {};
      if (extension) {
        accept[mimeType] = [extension.startsWith(".") ? extension : `.${extension}`];
      }

      const handle = await picker({
        suggestedName: fileName,
        startIn: "downloads",
        types: [
          {
            description,
            accept: Object.keys(accept).length > 0 ? accept : { [mimeType]: [] },
          },
        ],
      });

      const writable = await handle.createWritable();
      try {
        await writable.write(blob);
      } finally {
        await writable.close();
      }

      return handle.name || fileName;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new SaveCancelledError();
      }
      // Permission / unsupported quirks → fall back
      console.warn("Save file picker failed, falling back to download:", err);
    }
  }

  downloadBlobViaAnchor(blob, fileName);
  return fileName;
}

export async function savePdfBase64WithDialog(
  pdfBase64: string,
  suggestedFileName: string
): Promise<string> {
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  return saveBlobWithDialog(blob, suggestedFileName, {
    description: "PDF document",
    mimeType: "application/pdf",
    extension: ".pdf",
  });
}
