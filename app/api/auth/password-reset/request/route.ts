import { NextResponse } from "next/server";

import { requestPasswordResetCode } from "@/lib/password-reset";
import { passwordResetRequestSchema } from "@/lib/schemas/auth";

export const runtime = "nodejs";

const SUCCESS_MESSAGE =
  "Se o e-mail estiver cadastrado, enviaremos um codigo de recuperacao.";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = passwordResetRequestSchema.safeParse(body);

  if (!parsed.success) {
    const firstError =
      Object.values(parsed.error.flatten().fieldErrors).flat().find(Boolean) ??
      "Nao foi possivel validar o e-mail.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const result = await requestPasswordResetCode(parsed.data.email);

  if (result.userFound && !result.emailSent && !result.throttled) {
    console.warn(`Password reset email not sent: ${result.reason ?? "unknown reason"}`);
  }

  return NextResponse.json({ message: SUCCESS_MESSAGE }, { status: 200 });
}
