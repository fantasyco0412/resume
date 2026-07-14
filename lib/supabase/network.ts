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
    e.name === "TimeoutError" ||
    e.name === "FetchError" ||
    e.code === "ETIMEDOUT" ||
    e.code === "ECONNRESET" ||
    e.code === "ENOTFOUND" ||
    e.cause?.code === "ETIMEDOUT" ||
    e.cause?.code === "ENOTFOUND" ||
    e.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    /failed to fetch|network|timed out|timeout|aborted|err_timed_out|connect timeout|signal is aborted/i.test(
      String(e.message || e.cause?.message || "")
    )
  );
}

export function formatSupabaseConnectionError(error?: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  if (/timed out|timeout|signal is aborted|aborted/i.test(raw)) {
    return (
      "Connection to Supabase timed out. Check internet/VPN/firewall, " +
      "or increase NEXT_PUBLIC_SUPABASE_FETCH_TIMEOUT_MS (e.g. 45000), then retry."
    );
  }

  return (
    "Cannot reach Supabase. Check your internet connection, VPN/firewall, " +
    "and that your Supabase project is not paused in the dashboard. " +
    "Try again in a moment."
  );
}

/** Client + server. Default 30s for slow laptops / VPN. Override via env. */
export const SUPABASE_FETCH_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_SUPABASE_FETCH_TIMEOUT_MS || 30_000
);

export function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = SUPABASE_FETCH_TIMEOUT_MS;
  const timeoutId = setTimeout(() => {
    // Always pass a reason — bare abort() shows "signal is aborted without reason".
    controller.abort(`Supabase request timed out after ${timeoutMs}ms`);
  }, timeoutMs);

  if (init?.signal) {
    if (init.signal.aborted) {
      controller.abort(init.signal.reason ?? "Request was cancelled");
    } else {
      init.signal.addEventListener(
        "abort",
        () => controller.abort(init.signal?.reason ?? "Request was cancelled"),
        { once: true }
      );
    }
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
}
