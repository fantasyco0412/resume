"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Paths like /209.145.53.40:7843/209.145.53.40:7843/... from bad relative redirects. */
export function isCorruptedHostLoopPath(pathname: string): boolean {
  return /^\/(\d{1,3}\.){3}\d{1,3}:\d+(?:\/|$)/.test(pathname);
}

/**
 * Clean OpenWeb-mangled URLs without a full navigation.
 * history.replaceState avoids Astrill OpenWeb rewriting Location headers again.
 */
export default function CorruptedPathGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isCorruptedHostLoopPath(pathname)) return;
    window.history.replaceState(null, "", "/");
    router.replace("/");
  }, [pathname, router]);

  return null;
}
