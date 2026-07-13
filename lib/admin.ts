import { AuthError, requireAuthClient, type AuthRequest } from "@/lib/supabase/server-client";

function parseAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = parseAdminEmails();
  if (admins.size === 0) return false;
  return admins.has(email.trim().toLowerCase());
}

export async function requireAdmin(request: AuthRequest): Promise<{
  userId: string;
  email: string;
}> {
  const { userId, email } = await requireAuthClient(request);

  if (!email) {
    throw new AuthError("Invalid or expired session", 401);
  }

  if (!isAdminEmail(email)) {
    throw new AuthError("Admin access required", 403);
  }

  return { userId, email };
}
