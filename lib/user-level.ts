/** Stored on profiles — admin is determined by ADMIN_EMAILS env, not this column. */
export type StoredUserLevel = "manager" | "bidder" | "member";

export type UserLevel = "admin" | StoredUserLevel;

export const DEFAULT_STORED_USER_LEVEL: StoredUserLevel = "member";

export const STORED_USER_LEVELS: StoredUserLevel[] = ["manager", "bidder", "member"];

export function parseStoredUserLevel(value: unknown): StoredUserLevel {
  if (value === "manager") return "manager";
  if (value === "bidder") return "bidder";
  return DEFAULT_STORED_USER_LEVEL;
}

export function resolveUserLevel(
  stored: StoredUserLevel | null | undefined,
  isAdmin: boolean
): UserLevel {
  if (isAdmin) return "admin";
  return parseStoredUserLevel(stored);
}

export function userLevelLabel(level: UserLevel): string {
  switch (level) {
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "bidder":
      return "Bidder";
    case "member":
      return "Member";
  }
}

export function userLevelBadgeClass(level: UserLevel): string {
  switch (level) {
    case "admin":
      return "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-300";
    case "manager":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300";
    case "bidder":
      return "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600/50 dark:bg-slate-800/80 dark:text-slate-200";
  }
}

export function isStoredUserLevel(value: unknown): value is StoredUserLevel {
  return value === "manager" || value === "bidder" || value === "member";
}
