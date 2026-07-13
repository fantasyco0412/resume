import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createFetchWithTimeout } from "@/lib/proxy-fetch";
import {
  formatSupabaseConnectionError,
  isSupabaseNetworkError,
  SUPABASE_FETCH_TIMEOUT_MS,
} from "@/lib/supabase/network";
import {
  explainLocalVerifyFailure,
  getAccessTokenAlgorithm,
  verifySupabaseAccessTokenLocally,
  verifySupabaseAccessTokenViaJwks,
} from "@/lib/supabase/verify-access-token";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const serverFetch = createFetchWithTimeout(SUPABASE_FETCH_TIMEOUT_MS);
const authFallbackFetch = createFetchWithTimeout(
  Math.min(SUPABASE_FETCH_TIMEOUT_MS, 10_000),
  { retries: 0 }
);

/** Minimal request shape for auth (Next.js, Express adapter, etc.) */
export type AuthRequest = {
  headers: {
    get(name: string): string | null;
  };
};

export function getAccessTokenFromRequest(request: AuthRequest): string | null {
  const auth = request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7).trim() || null;
  }
  return null;
}

/** Supabase client scoped to the user's JWT (respects RLS). */
export function createServerSupabaseClient(accessToken: string): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      fetch: serverFetch,
    },
  });
}

export async function requireAuthClient(
  request: AuthRequest
): Promise<{
  client: SupabaseClient;
  accessToken: string;
  userId: string;
  email?: string;
}> {
  const accessToken = getAccessTokenFromRequest(request);
  if (!accessToken) {
    throw new AuthError("Missing authorization token", 401);
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET?.trim();
  const jwtPublicKey = process.env.SUPABASE_JWT_PUBLIC_KEY?.trim();
  const hasLocalAuthConfig = Boolean(jwtSecret || jwtPublicKey);

  if (hasLocalAuthConfig) {
    const verified = verifySupabaseAccessTokenLocally(accessToken, {
      jwtSecret,
      jwtPublicKey,
    });
    if (verified) {
      return {
        client: createServerSupabaseClient(accessToken),
        accessToken,
        userId: verified.userId,
        email: verified.email,
      };
    }

    const alg = getAccessTokenAlgorithm(accessToken);
    if (alg === "ES256") {
      try {
        const jwksVerified = await verifySupabaseAccessTokenViaJwks(accessToken, supabaseUrl);
        if (jwksVerified) {
          if (process.env.NODE_ENV === "development") {
            console.log("[auth] ES256 session verified via Supabase JWKS");
          }
          return {
            client: createServerSupabaseClient(accessToken),
            accessToken,
            userId: jwksVerified.userId,
            email: jwksVerified.email,
          };
        }
      } catch (err) {
        if (isSupabaseNetworkError(err)) {
          throw new AuthError(
            `${formatSupabaseConnectionError(err)} ES256 auth needs JWKS from Supabase on first use.`,
            503
          );
        }
        throw err;
      }
    }

    const reason = explainLocalVerifyFailure(accessToken, { jwtSecret, jwtPublicKey });
    if (process.env.NODE_ENV === "development") {
      console.warn(`[auth] Local JWT verify failed (alg=${alg ?? "unknown"}): ${reason}`);
    }

    throw new AuthError(reason, 401);
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      fetch: authFallbackFetch,
    },
  });
  let user;
  let error;
  try {
    ({ data: { user }, error } = await client.auth.getUser());
  } catch (err) {
    if (isSupabaseNetworkError(err)) {
      throw new AuthError(formatSupabaseConnectionError(err), 503);
    }
    throw err;
  }

  if (error || !user) {
    if (error && isSupabaseNetworkError(error)) {
      throw new AuthError(formatSupabaseConnectionError(error), 503);
    }
    throw new AuthError("Invalid or expired session", 401);
  }

  return {
    client: createServerSupabaseClient(accessToken),
    accessToken,
    userId: user.id,
    email: user.email ?? undefined,
  };
}

export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
