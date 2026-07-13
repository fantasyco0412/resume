import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { certificationFormRowToDbPayload } from "@/lib/mappers/profile-form";

export async function syncCertifications(
  userId: string,
  rows: Array<{ id?: string; name: string }>,
  client: SupabaseClient = supabase
): Promise<void> {
  const { data: existing, error: fetchError } = await client
    .from("user_certifications")
    .select("id")
    .eq("user_id", userId);

  if (fetchError) throw fetchError;

  const keepIds = new Set(rows.filter((row) => row.id).map((row) => row.id!));
  const deleteIds = (existing ?? [])
    .map((row) => row.id as string)
    .filter((id) => !keepIds.has(id));

  if (deleteIds.length > 0) {
    const { error } = await client
      .from("user_certifications")
      .delete()
      .in("id", deleteIds);
    if (error) throw error;
  }

  for (const row of rows) {
    const payload = certificationFormRowToDbPayload(row, userId);

    if (row.id) {
      const { error } = await client
        .from("user_certifications")
        .update({
          certification_name: payload.certification_name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;
    } else {
      const { error } = await client.from("user_certifications").insert(payload);
      if (error) throw error;
    }
  }
}
