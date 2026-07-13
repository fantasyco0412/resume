import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminOverviewData } from "@/lib/supabase/services/admin-overview";
import { AuthError } from "@/lib/supabase/server-client";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const data = await getAdminOverviewData();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[GET /api/admin/overview]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load admin overview" },
      { status: 500 }
    );
  }
}
