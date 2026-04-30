import { NextResponse } from "next/server";

import { confirmPasswordResetCode } from "@/lib/password-reset";
import { passwordResetConfirmSchema } from "@/lib/schemas/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = passwordResetConfirmSchema.safeParse(body);

  if (!parsed.success) {
    const firstError =
      Object.values(parsed.error.flatten().fieldErrors).flat().find(Boolean) ??
      "Nao foi possivel validar os dados.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const result = await confirmPasswordResetCode({
    email: parsed.data.email,
    code: parsed.data.code,
    password: parsed.data.password,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ message: "Senha alterada com sucesso." }, { status: 200 });
}
