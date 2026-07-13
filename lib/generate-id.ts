/** UUID v4 fallback when crypto.randomUUID is unavailable (e.g. HTTP on a bare IP). */
function fallbackRandomUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.trunc(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/** Cross-environment UUID suitable for client-side IDs and DB primary keys. */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return fallbackRandomUUID();
}
