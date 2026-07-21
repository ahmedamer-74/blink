import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const protectedPaths = ["/chat"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!isProtected) return NextResponse.next();

  const refreshToken = request.cookies.get("refreshToken")?.value;

  if (!refreshToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/chat/:path*"],
};
