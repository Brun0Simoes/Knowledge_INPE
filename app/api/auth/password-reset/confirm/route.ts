import { NextResponse } from "next/server";

import { confirmPasswordResetCode } from "@/lib/password-reset";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { enforceSameOriginRequest } from "@/lib/request-security";
import { passwordResetConfirmSchema } from "@/lib/schemas/auth";

export const runtime = "nodejs";

const RESET_CONFIRM_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RESET_CONFIRM_RATE_LIMIT_ATTEMPTS = 10;

export async function POST(request: Request) {
  const originError = enforceSameOriginRequest(request);
  if (originError) {
    return originError;
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = passwordResetConfirmSchema.safeParse(body);

  if (!parsed.success) {
    const firstError =
      Object.values(parsed.error.flatten().fieldErrors).flat().find(Boolean) ??
      "Nao foi possivel validar os dados.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const rateLimitKey = `password-reset-confirm:${parsed.data.email}`;
  const rateLimit = checkRateLimit(rateLimitKey, {
    limit: RESET_CONFIRM_RATE_LIMIT_ATTEMPTS,
    windowMs: RESET_CONFIRM_RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Codigo invalido ou expirado." },
      {
        status: 400,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const result = await confirmPasswordResetCode({
    email: parsed.data.email,
    code: parsed.data.code,
    password: parsed.data.password,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  clearRateLimit(rateLimitKey);

  return NextResponse.json({ message: "Senha alterada com sucesso." }, { status: 200 });
}
