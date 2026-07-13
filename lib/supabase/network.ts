/** Detect Supabase / network failures (timeout, offline, blocked). */
export function isSupabaseNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return /failed to fetch|network|timed out|timeout|aborted/i.test(String(error));
  }

  const e = error as {
    name?: string;
    message?: string;
    code?: string;
    cause?: { code?: string; message?: string };
  };

  return (
    e.name === "AbortError" ||
    e.name === "FetchError" ||
    e.code === "ETIMEDOUT" ||
    e.code === "ECONNRESET" ||
    e.code === "ENOTFOUND" ||
    e.cause?.code === "ETIMEDOUT" ||
    e.cause?.code === "ENOTFOUND" ||
    e.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    /failed to fetch|network|timed out|timeout|aborted|err_timed_out|connect timeout/i.test(
      String(e.message || e.cause?.message || "")
    )
  );
}

export function formatSupabaseConnectionError(error?: unknown): string {
  return (
    "Cannot reach Supabase. Check your internet connection, VPN/firewall, " +
    "and that your Supabase project is not paused in the dashboard. " +
    "Try again in a moment."
  );
}

export const SUPABASE_FETCH_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_SUPABASE_FETCH_TIMEOUT_MS || 15_000
);

export function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);

  const signals = [controller.signal];
  if (init?.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
}
