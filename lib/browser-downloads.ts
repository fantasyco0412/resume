/**
 * Save under the user's Downloads/<company_role>/ when possible.
 *
 * Reality check:
 * - A normal PDF download cannot create folders (browser security).
 * - Creating a real folder needs the File System Access API → HTTPS (or localhost) + Chrome/Edge.
 * - On plain http://IP (typical VPS today), we download a ZIP that contains
 *   company_role/Name.pdf — extract it in Downloads to get the folder.
 */

import { downloadFolderAsZip } from "@/lib/browser-zip";

const IDB_NAME = "resume-app-downloads";
const IDB_STORE = "handles";
const IDB_KEY = "downloadsRoot";
const PICKER_ID = "resume-app-downloads-v1";

/** Chromium File System Access permission helpers (not in all TS DOM lib versions). */
type DirectoryHandleWithPermission = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: {
    mode?: "read" | "readwrite";
  }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: {
    mode?: "read" | "readwrite";
  }) => Promise<PermissionState>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: "read" | "readwrite";
    startIn?: string;
  }) => Promise<FileSystemDirectoryHandle>;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

async function loadStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => {
        const value = req.result;
        resolve(value && typeof value === "object" ? (value as FileSystemDirectoryHandle) : null);
      };
      req.onerror = () => reject(req.error ?? new Error("IndexedDB read failed"));
    });
  } catch {
    return null;
  }
}

async function storeDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });
}

async function ensureReadWritePermission(
  handle: FileSystemDirectoryHandle
): Promise<boolean> {
  const opts = { mode: "readwrite" as const };
  const withPerm = handle as DirectoryHandleWithPermission;
  if (typeof withPerm.queryPermission === "function") {
    if ((await withPerm.queryPermission(opts)) === "granted") return true;
  }
  if (typeof withPerm.requestPermission === "function") {
    if ((await withPerm.requestPermission(opts)) === "granted") return true;
  }
  return typeof withPerm.queryPermission !== "function";
}

/** True only on secure contexts (HTTPS / localhost) with Chrome/Edge folder API. */
export function canSaveToBrowserFolder(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
}

async function resolveDownloadsRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (!canSaveToBrowserFolder()) return null;

  const existing = await loadStoredDirectoryHandle();
  if (existing) {
    try {
      if (await ensureReadWritePermission(existing)) return existing;
    } catch {
      // Stale handle — ask again below
    }
  }

  try {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker!;
    const handle = await picker({
      id: PICKER_ID,
      mode: "readwrite",
      startIn: "downloads",
    });
    await storeDirectoryHandle(handle);
    return handle;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    console.warn("Directory picker failed:", err);
    return null;
  }
}

async function tryWriteBlobToSubfolder(
  blob: Blob,
  folderName: string,
  fileName: string
): Promise<string | null> {
  const root = await resolveDownloadsRoot();
  if (!root) return null;

  const dir = await root.getDirectoryHandle(folderName, { create: true });
  const file = await dir.getFileHandle(fileName, { create: true });
  const writable = await file.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }

  return `Downloads/${folderName}/${fileName}`;
}

function pdfBase64ToBytes(pdfBase64: string): Uint8Array {
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Save PDF into Downloads/<folderName>/<fileName> when possible;
 * otherwise download a ZIP that extracts to that folder structure.
 */
export async function savePdfBase64ToBrowserSubfolder(
  pdfBase64: string,
  folderName: string,
  fileName: string
): Promise<string> {
  const bytes = pdfBase64ToBytes(pdfBase64);
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });

  try {
    const direct = await tryWriteBlobToSubfolder(blob, folderName, fileName);
    if (direct) return direct;
  } catch (err) {
    console.warn("Direct folder save failed, using ZIP:", err);
  }

  return downloadFolderAsZip(folderName, fileName, bytes);
}

export async function saveTextToBrowserSubfolder(
  text: string,
  folderName: string,
  fileName: string
): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy as BlobPart], { type: "text/plain;charset=utf-8" });

  try {
    const direct = await tryWriteBlobToSubfolder(blob, folderName, fileName);
    if (direct) return direct;
  } catch (err) {
    console.warn("Direct folder save failed, using ZIP:", err);
  }

  return downloadFolderAsZip(folderName, fileName, copy);
}

/** @deprecated Prefer savePdfBase64ToBrowserSubfolder which always returns a path. */
export async function saveBlobToBrowserSubfolder(
  blob: Blob,
  folderName: string,
  fileName: string
): Promise<string | null> {
  return tryWriteBlobToSubfolder(blob, folderName, fileName);
}
