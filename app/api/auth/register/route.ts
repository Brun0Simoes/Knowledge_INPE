import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { enforceSameOriginRequest } from "@/lib/request-security";
import { registerSchema } from "@/lib/schemas/auth";

const REGISTER_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const REGISTER_RATE_LIMIT_ATTEMPTS = 5;

export async function POST(request: Request) {
  const originError = enforceSameOriginRequest(request);
  if (originError) {
    return originError;
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    const firstError =
      Object.values(parsed.error.flatten().fieldErrors).flat().find(Boolean) ??
      "Nao foi possivel validar o cadastro.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const rateLimit = checkRateLimit(`register:${parsed.data.email}`, {
    limit: REGISTER_RATE_LIMIT_ATTEMPTS,
    windowMs: REGISTER_RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente mais tarde." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json({ error: "Ja existe uma conta com este e-mail." }, { status: 409 });
  }

  const passwordHash = await hash(parsed.data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: user.id }, { status: 201 });
}
