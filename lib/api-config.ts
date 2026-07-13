/**
 * Base URL for the standalone API server (no trailing slash).
 * In production set NEXT_PUBLIC_API_URL to your backend origin, e.g. https://api.example.com
 * Leave empty in local dev to use Next.js rewrites to the backend (see frontend/next.config.js).
 */
export function getApiBaseUrl(): string {
  let raw = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) {
    raw = `http://${raw}`;
  }
  return raw;
}

/** Build a full API path. Paths should start with /api/… */
export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}
