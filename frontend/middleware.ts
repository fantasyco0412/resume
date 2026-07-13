import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Paths like /209.145.53.40:7843/209.145.53.40:7843/... from bad relative redirects. */
function isCorruptedHostLoopPath(pathname: string): boolean {
  return /^\/(\d{1,3}\.){3}\d{1,3}:\d+(?:\/|$)/.test(pathname);
}

export function middleware(request: NextRequest) {
  if (isCorruptedHostLoopPath(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
