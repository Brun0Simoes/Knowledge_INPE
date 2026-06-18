import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import { getAuthSecret } from "@/lib/auth-secret";
import { PUBLIC_AUTH_ROUTES } from "@/lib/constants";

const PUBLIC_PAGE_ROUTES = ["/", "/dashboard"];
const PUBLIC_PAGE_PREFIXES = ["/courses/"];
const PROTECTED_PAGE_PREFIXES = ["/admin", "/notifications"];
const PUBLIC_GET_API_ROUTES = [
  "/api/calendar/events",
  "/api/calendar/export",
  "/api/youtube/playlists",
];

function stripBasePath(pathname: string, basePath: string) {
  if (!basePath || !pathname.startsWith(basePath)) {
    return pathname;
  }

  return pathname.slice(basePath.length) || "/";
}

function withBasePath(pathname: string, basePath: string) {
  return `${basePath}${pathname}`;
}

export async function proxy(request: NextRequest) {
  const routePath = stripBasePath(request.nextUrl.pathname, request.nextUrl.basePath);
  const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.some((route) => routePath === route);
  const isInternalEmailProcessorRoute = routePath === "/api/internal/email/process";
  const isPublicPageRoute =
    PUBLIC_PAGE_ROUTES.includes(routePath) ||
    PUBLIC_PAGE_PREFIXES.some((route) => routePath.startsWith(route));
  const isPublicGetApiRoute =
    request.method === "GET" && PUBLIC_GET_API_ROUTES.includes(routePath);
  const isProtectedPageRoute = PROTECTED_PAGE_PREFIXES.some((route) => routePath.startsWith(route));

  // Proxy is used only as a fast optimistic gate. The real authorization still
  // happens inside server components and route handlers.
  const token = await getToken({
    req: request,
    secret: getAuthSecret(),
  });

  if (!token && isProtectedPageRoute) {
    const loginUrl = new URL(withBasePath("/login", request.nextUrl.basePath), request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token && isPublicAuthRoute) {
    return NextResponse.redirect(
      new URL(withBasePath("/dashboard", request.nextUrl.basePath), request.url),
    );
  }

  if (isPublicPageRoute || isPublicAuthRoute || isPublicGetApiRoute || isInternalEmailProcessorRoute) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|seed|uploads).*)"],
};
