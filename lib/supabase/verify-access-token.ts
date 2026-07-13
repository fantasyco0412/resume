import { createHmac, createPublicKey, timingSafeEqual, verify as cryptoVerify } from "crypto";
import { createFetchWithTimeout } from "@/lib/proxy-fetch";
import { isSupabaseNetworkError, SUPABASE_FETCH_TIMEOUT_MS } from "@/lib/supabase/network";

const jwksFetch = createFetchWithTimeout(SUPABASE_FETCH_TIMEOUT_MS, { retries: 0 });
const JWKS_CACHE_MS = 10 * 60 * 1000;

type EcJwk = {
  kty: string;
  crv?: string;
  x?: string;
  y?: string;
  kid?: string;
  alg?: string;
};

let jwksCache: { fetchedAt: number; keys: EcJwk[] } | null = null;
let cachedEnvJwk: EcJwk | null | undefined;

export type VerifiedAccessToken = {
  userId: string;
  email?: string;
};

type JwtPayload = {
  sub?: string;
  exp?: number;
  role?: string;
  email?: string;
};

function decodeBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
}

function parseJwtParts(token: string): {
  header: { alg?: string; kid?: string };
  payload: JwtPayload;
  signingInput: string;
  signature: Buffer;
} | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(decodeBase64Url(parts[0]).toString("utf8")) as {
      alg?: string;
      kid?: string;
    };
    const payload = JSON.parse(decodeBase64Url(parts[1]).toString("utf8")) as JwtPayload;

    return {
      header,
      payload,
      signingInput: `${parts[0]}.${parts[1]}`,
      signature: decodeBase64Url(parts[2]),
    };
  } catch {
    return null;
  }
}

function payloadToVerified(payload: JwtPayload): VerifiedAccessToken | null {
  const exp = Number(payload.exp);
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return null;
  if (payload.role && payload.role !== "authenticated") return null;

  const userId = typeof payload.sub === "string" ? payload.sub : null;
  if (!userId) return null;

  return {
    userId,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}

function verifyHs256Signature(signingInput: string, signature: Buffer, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(signingInput).digest();
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(expected, signature);
}

function isTokenExpired(payload: JwtPayload): boolean {
  const exp = Number(payload.exp);
  return !Number.isFinite(exp) || exp * 1000 <= Date.now();
}

function normalizePublicKeyPem(pem: string): string {
  return pem.replace(/\\n/g, "\n").trim();
}

function verifyEs256SignatureWithJwk(
  signingInput: string,
  signature: Buffer,
  jwk: EcJwk
): boolean {
  try {
    if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.x || !jwk.y) return false;
    const key = createPublicKey({
      key: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y },
      format: "jwk",
    });
    return cryptoVerify(
      "sha256",
      Buffer.from(signingInput),
      { key, dsaEncoding: "ieee-p1363" },
      signature
    );
  } catch {
    return false;
  }
}

function verifyEs256Signature(
  signingInput: string,
  signature: Buffer,
  publicKeyPem: string
): boolean {
  try {
    const key = createPublicKey(normalizePublicKeyPem(publicKeyPem));
    return cryptoVerify(
      "sha256",
      Buffer.from(signingInput),
      { key, dsaEncoding: "ieee-p1363" },
      signature
    );
  } catch {
    return false;
  }
}

export function getAccessTokenAlgorithm(token: string): string | null {
  const parsed = parseJwtParts(token);
  return parsed?.header.alg ?? null;
}

/** Verify Supabase HS256 access JWT locally (no network). Returns null if unsupported or invalid. */
export function verifySupabaseAccessToken(
  token: string,
  secret: string
): VerifiedAccessToken | null {
  const parsed = parseJwtParts(token);
  if (!parsed || parsed.header.alg !== "HS256") return null;
  if (!verifyHs256Signature(parsed.signingInput, parsed.signature, secret)) return null;
  return payloadToVerified(parsed.payload);
}

function verifyEs256AccessTokenWithJwk(token: string, jwk: EcJwk): VerifiedAccessToken | null {
  const parsed = parseJwtParts(token);
  if (!parsed || parsed.header.alg !== "ES256") return null;
  if (!verifyEs256SignatureWithJwk(parsed.signingInput, parsed.signature, jwk)) return null;
  return payloadToVerified(parsed.payload);
}

function getEnvJwk(): EcJwk | null {
  if (cachedEnvJwk !== undefined) return cachedEnvJwk;

  const raw = process.env.SUPABASE_JWK_JSON?.trim();
  if (!raw) {
    cachedEnvJwk = null;
    return null;
  }

  try {
    cachedEnvJwk = JSON.parse(raw) as EcJwk;
  } catch {
    cachedEnvJwk = null;
  }
  return cachedEnvJwk;
}

function supabaseJwksUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`;
}

async function fetchSupabaseJwks(supabaseUrl: string): Promise<EcJwk[]> {
  const now = Date.now();
  if (jwksCache && now - jwksCache.fetchedAt < JWKS_CACHE_MS) {
    return jwksCache.keys;
  }

  const response = await jwksFetch(supabaseJwksUrl(supabaseUrl));
  if (!response.ok) {
    throw new Error(`JWKS fetch failed (${response.status})`);
  }

  const data = (await response.json()) as { keys?: EcJwk[] };
  const keys = Array.isArray(data.keys) ? data.keys : [];
  jwksCache = { fetchedAt: now, keys };
  return keys;
}

function pickJwkForToken(keys: EcJwk[], kid: string | undefined): EcJwk | null {
  if (kid) {
    const match = keys.find((key) => key.kid?.toLowerCase() === kid.toLowerCase());
    if (match) return match;
  }
  return keys.find((key) => key.kty === "EC" && key.crv === "P-256" && key.x && key.y) ?? null;
}

/** Verify ES256 token using env JWK or Supabase JWKS endpoint (cached). */
export async function verifySupabaseAccessTokenViaJwks(
  token: string,
  supabaseUrl: string
): Promise<VerifiedAccessToken | null> {
  const parsed = parseJwtParts(token);
  if (!parsed || parsed.header.alg !== "ES256") return null;

  const envJwk = getEnvJwk();
  if (envJwk) {
    const verified = verifyEs256AccessTokenWithJwk(token, envJwk);
    if (verified) return verified;
  }

  if (!supabaseUrl) return null;

  try {
    const keys = await fetchSupabaseJwks(supabaseUrl);
    const jwk = pickJwkForToken(keys, parsed.header.kid);
    if (!jwk) return null;
    return verifyEs256AccessTokenWithJwk(token, jwk);
  } catch (err) {
    if (isSupabaseNetworkError(err)) throw err;
    return null;
  }
}

/** Prefetch JWKS on startup so the first ES256 auth request does not wait on fetch. */
export async function warmSupabaseJwksCache(supabaseUrl?: string): Promise<void> {
  const url = supabaseUrl?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return;

  try {
    const keys = await fetchSupabaseJwks(url);
    if (process.env.NODE_ENV === "development") {
      console.log(`[auth] JWKS ready (${keys.length} key(s) from Supabase)`);
    }
  } catch (err) {
    if (isSupabaseNetworkError(err)) {
      console.warn(
        "[auth] JWKS auto-fetch unavailable — Supabase unreachable. " +
          "Start VPN/proxy or use SUPABASE_JWK_JSON in backend/.env.local."
      );
      return;
    }
    console.warn("[auth] JWKS prefetch failed:", err);
  }
}

function verifyEs256AccessToken(
  token: string,
  publicKeyPem: string
): VerifiedAccessToken | null {
  const parsed = parseJwtParts(token);
  if (!parsed || parsed.header.alg !== "ES256") return null;
  if (!verifyEs256Signature(parsed.signingInput, parsed.signature, publicKeyPem)) return null;
  return payloadToVerified(parsed.payload);
}

/** Try local JWT verification using configured secrets/keys (no network). */
export function verifySupabaseAccessTokenLocally(
  token: string,
  options?: { jwtSecret?: string; jwtPublicKey?: string }
): VerifiedAccessToken | null {
  const jwtSecret = options?.jwtSecret ?? process.env.SUPABASE_JWT_SECRET?.trim();
  const jwtPublicKey = options?.jwtPublicKey ?? process.env.SUPABASE_JWT_PUBLIC_KEY?.trim();

  if (jwtSecret) {
    const verified = verifySupabaseAccessToken(token, jwtSecret);
    if (verified) return verified;
  }

  if (jwtPublicKey) {
    const verified = verifyEs256AccessToken(token, jwtPublicKey);
    if (verified) return verified;
  }

  return null;
}

/** Human-readable reason when local verify fails (no token contents leaked). */
export function explainLocalVerifyFailure(
  token: string,
  options?: { jwtSecret?: string; jwtPublicKey?: string }
): string {
  const parsed = parseJwtParts(token);
  if (!parsed) return "Session token is not a valid JWT.";

  const alg = parsed.header.alg ?? "unknown";
  const jwtSecret = options?.jwtSecret ?? process.env.SUPABASE_JWT_SECRET?.trim();
  const jwtPublicKey = options?.jwtPublicKey ?? process.env.SUPABASE_JWT_PUBLIC_KEY?.trim();

  if (isTokenExpired(parsed.payload)) {
    return "Session token expired — sign out and sign in again.";
  }

  if (alg === "ES256") {
    if (jwtPublicKey) {
      return "ES256 session token could not be verified — check SUPABASE_JWT_PUBLIC_KEY.";
    }
    if (getEnvJwk()) {
      return "ES256 session token could not be verified — check SUPABASE_JWK_JSON.";
    }
    return (
      "ES256 session could not be verified. JWKS was fetched but the token signature did not match. " +
      "Try signing out and signing in again."
    );
  }

  if (alg === "HS256") {
    if (!jwtSecret) {
      return "Session token uses HS256 — set SUPABASE_JWT_SECRET in backend/.env.local.";
    }
    if (!verifyHs256Signature(parsed.signingInput, parsed.signature, jwtSecret)) {
      return (
        "HS256 session token did not match SUPABASE_JWT_SECRET. " +
        "Use the JWT Secret from Supabase → Project Settings → API → JWT Settings (Legacy JWT secret). " +
        "Do not use the anon or service_role key."
      );
    }
  }

  if (parsed.payload.role && parsed.payload.role !== "authenticated") {
    return "Session token is not an authenticated user token.";
  }

  if (typeof parsed.payload.sub !== "string" || !parsed.payload.sub) {
    return "Session token is missing a user id.";
  }

  return `Session token could not be verified locally (alg=${alg}).`;
}
