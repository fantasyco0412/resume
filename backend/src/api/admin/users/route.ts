import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser,
} from "@/lib/supabase/services/admin-users";
import { isStoredUserLevel } from "@/lib/user-level";
import { AuthError } from "@/lib/supabase/server-client";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const perPage = Number(url.searchParams.get("perPage") ?? "20");
    const query = url.searchParams.get("q") ?? "";

    const result = await listAdminUsers({ page, perPage, query });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[GET /api/admin/users]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load users" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = (await request.json()) as {
      email?: string;
      password?: string;
      fullName?: string;
      userLevel?: string;
    };

    const user = await createAdminUser({
      email: body.email ?? "",
      password: body.password ?? "",
      fullName: body.fullName ?? null,
      userLevel: isStoredUserLevel(body.userLevel) ? body.userLevel : undefined,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[POST /api/admin/users]", error);
    const message = error instanceof Error ? error.message : "Failed to create user";
    const status = message.includes("already") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId: adminUserId } = await requireAdmin(request);

    const targetUserId = new URL(request.url).searchParams.get("userId")?.trim();
    if (!targetUserId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (targetUserId === adminUserId) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    await deleteAdminUser(targetUserId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message === "User not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[DELETE /api/admin/users]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete user" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = (await request.json()) as {
      userId?: string;
      userLevel?: string;
      adminNote?: string | null;
    };

    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const hasUserLevel = body.userLevel !== undefined;
    const hasAdminNote = body.adminNote !== undefined;

    if (!hasUserLevel && !hasAdminNote) {
      return NextResponse.json(
        { error: "userLevel or adminNote is required" },
        { status: 400 }
      );
    }

    if (hasUserLevel && !isStoredUserLevel(body.userLevel)) {
      return NextResponse.json(
        { error: "userLevel must be manager, bidder, or member" },
        { status: 400 }
      );
    }

    const user = await updateAdminUser(userId, {
      userLevel: hasUserLevel ? body.userLevel : undefined,
      adminNote: hasAdminNote ? body.adminNote : undefined,
    });
    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message === "User not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[PATCH /api/admin/users]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update user" },
      { status: 500 }
    );
  }
}
