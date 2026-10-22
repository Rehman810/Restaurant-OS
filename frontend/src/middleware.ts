import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * UX + defense in depth only. API routes enforce real auth; this only checks that
 * the HttpOnly session cookie is present — it does not validate the JWT or call the API.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsSession = pathname.startsWith("/admin") || pathname.startsWith("/rider");
  if (!needsSession) return NextResponse.next();

  const token =
    request.cookies.get("__Host-ros_session")?.value || request.cookies.get("ros_session")?.value;
  if (!token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/rider/:path*"],
};
