import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile, ProfileUpdate } from "@/lib/supabase/database.types";

export async function updateProfile(
  userId: string,
  updates: ProfileUpdate,
  client: SupabaseClient = supabase
): Promise<Profile> {
  const { data, error } = await client
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return data as Profile;
}
