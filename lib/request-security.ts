import { NextResponse } from "next/server";

import { getConfiguredAppOrigin } from "@/lib/app-origin";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function enforceSameOriginRequest(request: Request) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return null;
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const candidate = origin ?? referer;

  if (!candidate) {
    return null;
  }

  let candidateUrl: URL;
  try {
    candidateUrl = new URL(candidate);
  } catch {
    return forbiddenOrigin();
  }

  const allowedOrigins = buildAllowedOrigins(requestUrl.origin, getConfiguredAppOrigin());

  if (!allowedOrigins.has(candidateUrl.origin)) {
    return forbiddenOrigin();
  }

  return null;
}

function buildAllowedOrigins(...origins: string[]) {
  const allowedOrigins = new Set(origins);

  for (const origin of origins) {
    try {
      const parsed = new URL(origin);

      if (parsed.hostname === "localhost") {
        parsed.hostname = "127.0.0.1";
        allowedOrigins.add(parsed.origin);
      } else if (parsed.hostname === "127.0.0.1") {
        parsed.hostname = "localhost";
        allowedOrigins.add(parsed.origin);
      }
    } catch {
      // Invalid origins are ignored; configured origin validation handles production.
    }
  }

  return allowedOrigins;
}

function forbiddenOrigin() {
  return NextResponse.json({ error: "Origem da requisicao nao permitida." }, { status: 403 });
}
