import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  fetchWithTimeout,
  SUPABASE_FETCH_TIMEOUT_MS,
} from "@/lib/supabase/network";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

const authOptions = {
  autoRefreshToken: true,
  persistSession: true,
  // Password-only auth — no OAuth/magic-link callbacks. Avoids URL rewrites on HTTP + bare IP.
  detectSessionInUrl: false,
  storageKey: "resume-app-auth",
} as const;

const clientOptions = {
  auth: authOptions,
  global: {
    fetch: fetchWithTimeout,
  },
} as const;

let browserClient: SupabaseClient | undefined;

function createBrowserClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, clientOptions);
}

/** Singleton Supabase client — avoids duplicate auth refresh loops in the browser. */
export const supabase: SupabaseClient =
  typeof window === "undefined"
    ? createBrowserClient()
    : (browserClient ??= createBrowserClient());

export { supabaseUrl, supabaseAnonKey, SUPABASE_FETCH_TIMEOUT_MS };
