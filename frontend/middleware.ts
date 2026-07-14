import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Paths like /209.145.53.40:7843/209.145.53.40:7843/... from bad relative redirects. */
function isCorruptedHostLoopPath(pathname: string): boolean {
  return /^\/(\d{1,3}\.){3}\d{1,3}:\d+(?:\/|$)/.test(pathname);
}

/** Absolute origin for redirects — never emit host:port without a scheme. */
function requestOrigin(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.host;
  const proto =
    request.headers.get("x-forwarded-proto") ||
    request.nextUrl.protocol.replace(/:$/, "") ||
    "http";
  return `${proto}://${host}`;
}

export function middleware(request: NextRequest) {
  if (isCorruptedHostLoopPath(request.nextUrl.pathname)) {
    return NextResponse.redirect(`${requestOrigin(request)}/`, 302);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
