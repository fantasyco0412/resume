const CACHE_PREFIX = "resume-app-profile-cache:";

function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`;
}

export function readProfileCache<T>(userId: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeProfileCache(userId: string, data: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(data));
  } catch {
    // Storage full or unavailable — ignore
  }
}

export function clearProfileCache(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(cacheKey(userId));
  } catch {
    // ignore
  }
}
