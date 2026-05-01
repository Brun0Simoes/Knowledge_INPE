import { NextResponse } from "next/server";

import { requestPasswordResetCode } from "@/lib/password-reset";
import { checkRateLimit } from "@/lib/rate-limit";
import { enforceSameOriginRequest } from "@/lib/request-security";
import { passwordResetRequestSchema } from "@/lib/schemas/auth";

export const runtime = "nodejs";

const SUCCESS_MESSAGE =
  "Se o e-mail estiver cadastrado, enviaremos um codigo de recuperacao.";
const RESET_REQUEST_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RESET_REQUEST_RATE_LIMIT_ATTEMPTS = 5;

export async function POST(request: Request) {
  const originError = enforceSameOriginRequest(request);
  if (originError) {
    return originError;
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = passwordResetRequestSchema.safeParse(body);

  if (!parsed.success) {
    const firstError =
      Object.values(parsed.error.flatten().fieldErrors).flat().find(Boolean) ??
      "Nao foi possivel validar o e-mail.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const rateLimit = checkRateLimit(`password-reset-request:${parsed.data.email}`, {
    limit: RESET_REQUEST_RATE_LIMIT_ATTEMPTS,
    windowMs: RESET_REQUEST_RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: SUCCESS_MESSAGE },
      {
        status: 200,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const result = await requestPasswordResetCode(parsed.data.email);

  if (result.userFound && !result.emailSent && !result.throttled) {
    console.warn(`Password reset email not sent: ${result.reason ?? "unknown reason"}`);
  }

  return NextResponse.json({ message: SUCCESS_MESSAGE }, { status: 200 });
}
