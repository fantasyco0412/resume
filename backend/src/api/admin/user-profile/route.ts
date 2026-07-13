import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminUserDetail } from "@/lib/supabase/services/admin-users";
import { AuthError } from "@/lib/supabase/server-client";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const userId = new URL(request.url).searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const detail = await getAdminUserDetail(userId);
    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message === "User not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[GET /api/admin/user-profile]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load user profile" },
      { status: 500 }
    );
  }
}
