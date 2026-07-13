import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createFetchWithTimeout } from "@/lib/proxy-fetch";
import { SUPABASE_FETCH_TIMEOUT_MS } from "@/lib/supabase/network";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const serverFetch = createFetchWithTimeout(SUPABASE_FETCH_TIMEOUT_MS);

/** Supabase client with service role — bypasses RLS. Server-only. */
export function createServiceSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or Supabase URL");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: serverFetch,
    },
  });
}
