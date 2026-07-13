import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { CompanyFormRow } from "@/lib/mappers/profile-form";
import { companyFormRowToDbPayload } from "@/lib/mappers/profile-form";

export async function syncCompanies(
  userId: string,
  rows: CompanyFormRow[],
  client: SupabaseClient = supabase
): Promise<void> {
  const { data: existing, error: fetchError } = await client
    .from("user_companies")
    .select("id")
    .eq("user_id", userId);

  if (fetchError) throw fetchError;

  const keepIds = new Set(rows.filter((row) => row.id).map((row) => row.id!));
  const deleteIds = (existing ?? [])
    .map((row) => row.id as string)
    .filter((id) => !keepIds.has(id));

  if (deleteIds.length > 0) {
    const { error } = await client
      .from("user_companies")
      .delete()
      .in("id", deleteIds);
    if (error) throw error;
  }

  for (let i = 0; i < rows.length; i++) {
    const payload = companyFormRowToDbPayload(rows[i], userId, i);

    if (rows[i].id) {
      const { id, ...updateFields } = payload;
      const { error } = await client
        .from("user_companies")
        .update({ ...updateFields, updated_at: new Date().toISOString() })
        .eq("id", rows[i].id!);
      if (error) throw error;
    } else {
      const { error } = await client.from("user_companies").insert(payload);
      if (error) throw error;
    }
  }
}
