import { execSync } from "child_process";
import { connect } from "net";
import { Agent, ProxyAgent, type Dispatcher } from "undici";

const LOCAL_PROXY_PROBE_MS = 400;
const PROXY_PROBE_TTL_MS = 30_000;

let cachedConfiguredProxyUrl: string | null | undefined;
let cachedActiveProxyUrl: string | null | undefined;
let lastProxyProbeAt = 0;
const dispatcherCache = new Map<string, Dispatcher>();

function normalizeProxyUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function isLoopbackHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
}

function parseProxyEndpoint(proxyUrl: string): { host: string; port: number } | undefined {
  try {
    const url = new URL(proxyUrl);
    const port = url.port
      ? Number(url.port)
      : url.protocol === "https:"
        ? 443
        : 80;
    if (!Number.isFinite(port)) return undefined;
    return { host: url.hostname, port };
  } catch {
    return undefined;
  }
}

/** Windows ProxyServer can be `host:port` or `http=host:port;https=host:port`. */
function parseWindowsProxyServer(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  if (trimmed.includes("=")) {
    const byProtocol = new Map<string, string>();
    for (const entry of trimmed.split(";")) {
      const part = entry.trim();
      const eq = part.indexOf("=");
      if (eq <= 0) continue;
      const host = part.slice(eq + 1).trim();
      if (host) byProtocol.set(part.slice(0, eq).toLowerCase(), host);
    }

    const host =
      byProtocol.get("https") ||
      byProtocol.get("http") ||
      byProtocol.get("socks") ||
      undefined;

    return host ? normalizeProxyUrl(host) : undefined;
  }

  return normalizeProxyUrl(trimmed);
}

function readWindowsSystemProxy(): string | undefined {
  if (process.platform !== "win32") return undefined;

  try {
    const ps = [
      "$s = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'",
      "if ($s.ProxyEnable -ne 1 -or -not $s.ProxyServer) { exit 0 }",
      "Write-Output $s.ProxyServer",
    ].join("; ");

    const output = execSync(`powershell -NoProfile -Command "${ps}"`, {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return output ? parseWindowsProxyServer(output) : undefined;
  } catch {
    return undefined;
  }
}

/** Proxy from env or Windows settings, before reachability checks. */
export function getConfiguredProxyUrl(): string | undefined {
  if (cachedConfiguredProxyUrl !== undefined) {
    return cachedConfiguredProxyUrl ?? undefined;
  }

  const fromEnv =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy ||
    process.env.AI_HTTPS_PROXY ||
    undefined;

  const proxyUrl = fromEnv ? normalizeProxyUrl(fromEnv) : readWindowsSystemProxy();
  cachedConfiguredProxyUrl = proxyUrl ?? null;
  return proxyUrl;
}

/** @deprecated Use getConfiguredProxyUrl; kept for existing imports. */
export function resolveProxyUrl(): string | undefined {
  return getConfiguredProxyUrl();
}

function probeLocalProxy(proxyUrl: string, timeoutMs = LOCAL_PROXY_PROBE_MS): Promise<boolean> {
  const endpoint = parseProxyEndpoint(proxyUrl);
  if (!endpoint || !isLoopbackHost(endpoint.host)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (reachable: boolean) => {
      if (settled) return;
      settled = true;
      resolve(reachable);
    };

    const socket = connect({
      host: endpoint.host,
      port: endpoint.port,
      timeout: timeoutMs,
    });

    socket.once("connect", () => {
      socket.destroy();
      finish(true);
    });
    socket.once("error", () => {
      socket.destroy();
      finish(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      finish(false);
    });

    setTimeout(() => finish(false), timeoutMs + 50);
  });
}

function logProxyChoice(configured: string, active: string | undefined, force: boolean): void {
  if (process.env.NODE_ENV !== "development") return;

  const endpoint = parseProxyEndpoint(configured);
  if (endpoint && isLoopbackHost(endpoint.host) && !active) {
    console.log(
      `[network] Local proxy ${configured} is not running; using direct connection ` +
        "(e.g. Astrill StealthVPN). OpenWeb will use the proxy automatically when active."
    );
    return;
  }

  if (active) {
    const source =
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy
        ? "env"
        : "Windows system proxy";
    if (force) {
      console.log(`[network] Re-probed ${source}: ${active}`);
    } else {
      console.log(`[network] Using ${source}: ${active}`);
    }
  }
}

async function resolveActiveProxyUrl(force = false): Promise<string | undefined> {
  const now = Date.now();
  if (
    !force &&
    cachedActiveProxyUrl !== undefined &&
    now - lastProxyProbeAt < PROXY_PROBE_TTL_MS
  ) {
    return cachedActiveProxyUrl ?? undefined;
  }

  const configured = getConfiguredProxyUrl();
  if (!configured) {
    cachedActiveProxyUrl = null;
    lastProxyProbeAt = now;
    return undefined;
  }

  const reachable = await probeLocalProxy(configured);
  const active = reachable ? configured : undefined;
  const changed = cachedActiveProxyUrl !== (active ?? null);

  cachedActiveProxyUrl = active ?? null;
  lastProxyProbeAt = now;

  if (changed || force) {
    logProxyChoice(configured, active, force);
  }

  return active;
}

function dispatcherCacheKey(proxyUrl: string | undefined, timeoutMs: number): string {
  return `${proxyUrl ?? "direct"}:${timeoutMs}`;
}

function invalidateNetworkCache(): void {
  cachedActiveProxyUrl = undefined;
  lastProxyProbeAt = 0;
  dispatcherCache.clear();
}

function getDispatcherForProxy(proxyUrl: string | undefined, timeoutMs: number): Dispatcher {
  const ms = Math.max(10_000, timeoutMs);
  const key = dispatcherCacheKey(proxyUrl, ms);
  const existing = dispatcherCache.get(key);
  if (existing) return existing;

  const agentOptions = {
    connect: { timeout: ms },
    headersTimeout: ms,
    bodyTimeout: ms,
  };

  const dispatcher: Dispatcher = proxyUrl
    ? new ProxyAgent({ uri: proxyUrl, ...agentOptions })
    : new Agent(agentOptions);

  dispatcherCache.set(key, dispatcher);
  return dispatcher;
}

function isRetryableNetworkError(err: unknown): boolean {
  const codes = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "EPIPE",
    "ETIMEDOUT",
    "ENOTFOUND",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_SOCKET",
  ]);

  let current: unknown = err;
  while (current) {
    if (current instanceof Error) {
      const withCode = current as NodeJS.ErrnoException;
      if (withCode.code && codes.has(withCode.code)) return true;
      const text = `${withCode.message || ""} ${withCode.cause instanceof Error ? withCode.cause.message : ""}`;
      if (/fetch failed|connect timeout|connection timed out|error sending request/i.test(text)) {
        return true;
      }
      current = withCode.cause;
    } else {
      break;
    }
  }

  return false;
}

/** Node fetch ignores Windows system proxy by default; route through undici when needed. */
export function createFetchWithTimeout(
  timeoutMs: number,
  options?: { retries?: number }
): typeof fetch {
  const ms = Math.max(10_000, timeoutMs);
  const maxAttempts = Math.max(1, (options?.retries ?? 1) + 1);

  return async (input, init) => {
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const forceReprobe = attempt > 0;
      const proxyUrl = await resolveActiveProxyUrl(forceReprobe);
      const dispatcher = getDispatcherForProxy(proxyUrl, ms);

      try {
        return await fetch(input, {
          ...init,
          dispatcher,
        } as RequestInit);
      } catch (err) {
        lastError = err;
        if (attempt + 1 < maxAttempts && isRetryableNetworkError(err)) {
          if (process.env.NODE_ENV === "development") {
            console.log("[network] Request failed; re-probing proxy and retrying once.");
          }
          invalidateNetworkCache();
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  };
}

export function getProxySetupHint(): string {
  if (getConfiguredProxyUrl()) {
    return (
      " Local proxies (e.g. Astrill OpenWeb on 127.0.0.1:3213) are used only when reachable; " +
      "StealthVPN uses direct connection automatically. Restart the dev server after changing HTTPS_PROXY."
    );
  }
  return (
    " If OpenWeb needs a proxy, set HTTPS_PROXY in .env.local " +
    "(e.g. http://127.0.0.1:3213). StealthVPN does not need it."
  );
}
