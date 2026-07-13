import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export class AuthRequiredError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

/**
 * Returns the authenticated user's id (auth.users.id / profiles.id).
 */
export async function getUserId(
  client: SupabaseClient = supabase
): Promise<string> {
  const {
    data: { session },
    error,
  } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  const userId = session?.user?.id;
  if (!userId) {
    throw new AuthRequiredError();
  }

  return userId;
}

/**
 * Returns the authenticated user's id, or null when not signed in.
 */
export async function getUserIdOrNull(
  client: SupabaseClient = supabase
): Promise<string | null> {
  try {
    const {
      data: { session },
      error,
    } = await client.auth.getSession();

    if (error) {
      return null;
    }

    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}
