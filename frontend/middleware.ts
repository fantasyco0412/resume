import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Paths like /209.145.53.40:3847/209.145.53.40:3847/...
 * Astrill OpenWeb often turns absolute Location redirects into relative
 * "ip:port" paths; StealthVPN does not. Prefer rewrite over redirect.
 */
function isCorruptedHostLoopPath(pathname: string): boolean {
  return /^\/(\d{1,3}\.){3}\d{1,3}:\d+(?:\/|$)/.test(pathname);
}

export function middleware(request: NextRequest) {
  if (!isCorruptedHostLoopPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Rewrite (no Location header) so OpenWeb cannot re-append host:port.
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: "/:path*",
};
