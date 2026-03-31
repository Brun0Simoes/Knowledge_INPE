import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import { PUBLIC_AUTH_ROUTES } from "@/lib/constants";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.some((route) => pathname === route);
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET ?? "dev-secret-change-me",
  });

  if (!token && !isPublicAuthRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token && isPublicAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|seed|uploads).*)"],
};
