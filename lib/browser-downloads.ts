/**
 * Write files under Downloads/<company_role>/ via the File System Access API
 * (Chrome / Edge). A normal <a download> cannot create folders.
 *
 * First successful save asks the user to pick their Downloads folder once;
 * the handle is stored in IndexedDB for later writes.
 */

const IDB_NAME = "resume-app-downloads";
const IDB_STORE = "handles";
const IDB_KEY = "downloadsRoot";
const PICKER_ID = "resume-app-downloads-v1";

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
  if ((await handle.queryPermission(opts)) === "granted") return true;
  if ((await handle.requestPermission(opts)) === "granted") return true;
  return false;
}

export function canSaveToBrowserFolder(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.showDirectoryPicker === "function"
  );
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
    const handle = await window.showDirectoryPicker({
      id: PICKER_ID,
      mode: "readwrite",
      startIn: "downloads",
    });
    await storeDirectoryHandle(handle);
    return handle;
  } catch (err) {
    // User cancelled or browser blocked the picker
    if (err instanceof DOMException && err.name === "AbortError") return null;
    console.warn("Directory picker failed:", err);
    return null;
  }
}

/**
 * Create Downloads/<folderName>/<fileName> when the user allows folder access.
 * Returns the display path, or null if folder save is unavailable / cancelled
 * (caller should fall back to a flat browser download).
 */
export async function saveBlobToBrowserSubfolder(
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

export async function saveTextToBrowserSubfolder(
  text: string,
  folderName: string,
  fileName: string
): Promise<string | null> {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  return saveBlobToBrowserSubfolder(blob, folderName, fileName);
}

export async function savePdfBase64ToBrowserSubfolder(
  pdfBase64: string,
  folderName: string,
  fileName: string
): Promise<string | null> {
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  return saveBlobToBrowserSubfolder(blob, folderName, fileName);
}
