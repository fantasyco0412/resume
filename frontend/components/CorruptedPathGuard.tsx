"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Paths like /209.145.53.40:7843/209.145.53.40:7843/... from bad relative redirects. */
export function isCorruptedHostLoopPath(pathname: string): boolean {
  return /^\/(\d{1,3}\.){3}\d{1,3}:\d+(?:\/|$)/.test(pathname);
}

/** Reset corrupted client-side navigations back to the app root. */
export default function CorruptedPathGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (isCorruptedHostLoopPath(pathname)) {
      window.location.replace(`${window.location.origin}/`);
    }
  }, [pathname]);

  return null;
}
