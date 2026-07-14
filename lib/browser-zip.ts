/**
 * Minimal ZIP (store / no compression) for packaging folder/file paths in the browser.
 * Used when we cannot create real Downloads subfolders (non-HTTPS / no File System Access).
 */

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i]!;
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Build a ZIP containing one entry at `folderName/fileName`. */
export function buildSingleFileZip(
  folderName: string,
  fileName: string,
  fileBytes: Uint8Array
): Blob {
  const entryName = `${folderName.replace(/\\/g, "/").replace(/\/+$/, "")}/${fileName}`;
  const nameBytes = new TextEncoder().encode(entryName);
  const crc = crc32(fileBytes);
  const size = fileBytes.length;

  const localHeader = concat([
    u32(0x04034b50),
    u16(20),
    u16(0),
    u16(0), // store
    u16(0),
    u16(0),
    u32(crc),
    u32(size),
    u32(size),
    u16(nameBytes.length),
    u16(0),
    nameBytes,
  ]);

  const localOffset = 0;
  const centralHeader = concat([
    u32(0x02014b50),
    u16(20),
    u16(20),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(crc),
    u32(size),
    u32(size),
    u16(nameBytes.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(localOffset),
    nameBytes,
  ]);

  const localSize = localHeader.length + fileBytes.length;
  const endRecord = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(1),
    u16(1),
    u32(centralHeader.length),
    u32(localSize),
    u16(0),
  ]);

  const zipBytes = concat([localHeader, fileBytes, centralHeader, endRecord]);
  return new Blob([zipBytes], { type: "application/zip" });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Download a ZIP that extracts to Downloads/<folderName>/<fileName>. */
export function downloadFolderAsZip(
  folderName: string,
  fileName: string,
  fileBytes: Uint8Array
): string {
  const zip = buildSingleFileZip(folderName, fileName, fileBytes);
  downloadBlob(zip, `${folderName}.zip`);
  return `Downloads/${folderName}.zip → ${folderName}/${fileName}`;
}
