import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { EducationFormRow } from "@/lib/mappers/profile-form";
import { educationFormRowToDbPayload } from "@/lib/mappers/profile-form";

export async function syncEducations(
  userId: string,
  rows: EducationFormRow[],
  client: SupabaseClient = supabase
): Promise<void> {
  const { data: existing, error: fetchError } = await client
    .from("user_educations")
    .select("id")
    .eq("user_id", userId);

  if (fetchError) throw fetchError;

  const keepIds = new Set(rows.filter((row) => row.id).map((row) => row.id!));
  const deleteIds = (existing ?? [])
    .map((row) => row.id as string)
    .filter((id) => !keepIds.has(id));

  if (deleteIds.length > 0) {
    const { error } = await client
      .from("user_educations")
      .delete()
      .in("id", deleteIds);
    if (error) throw error;
  }

  for (let i = 0; i < rows.length; i++) {
    const payload = educationFormRowToDbPayload(rows[i], userId, i);
    const { id, ...insertFields } = payload;

    if (rows[i].id) {
      const { error } = await client
        .from("user_educations")
        .update({ ...insertFields, updated_at: new Date().toISOString() })
        .eq("id", rows[i].id!);
      if (error) throw error;
    } else {
      const { error } = await client.from("user_educations").insert(payload);
      if (error) throw error;
    }
  }
}
