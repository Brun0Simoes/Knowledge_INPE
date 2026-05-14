import { randomInt } from "crypto";

import { compare, hash } from "bcryptjs";

import { sendPasswordResetEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

const RESET_CODE_TTL_MINUTES = 15;
const RESET_CODE_MAX_ATTEMPTS = 5;
const RESET_REQUEST_COOLDOWN_MS = 60_000;

type RequestResetResult = {
  userFound: boolean;
  emailSent: boolean;
  throttled: boolean;
  reason?: string;
};

type ConfirmResetPayload = {
  email: string;
  code: string;
  password: string;
};

export async function requestPasswordResetCode(email: string): Promise<RequestResetResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
    },
  });

  if (!user) {
    return {
      userFound: false,
      emailSent: false,
      throttled: false,
    };
  }

  const cooldownStartedAt = new Date(Date.now() - RESET_REQUEST_COOLDOWN_MS);
  const recentCode = await prisma.passwordResetCode.findFirst({
    where: {
      userId: user.id,
      consumedAt: null,
      createdAt: {
        gte: cooldownStartedAt,
      },
    },
    select: { id: true },
  });

  if (recentCode) {
    return {
      userFound: true,
      emailSent: false,
      throttled: true,
      reason: "Aguarde antes de solicitar outro codigo.",
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_CODE_TTL_MINUTES * 60_000);
  const code = generateResetCode();
  const codeHash = await hash(code, 12);

  const [, resetCode] = await prisma.$transaction([
    prisma.passwordResetCode.updateMany({
      where: {
        userId: user.id,
        consumedAt: null,
      },
      data: {
        consumedAt: now,
        updatedAt: now,
      },
    }),
    prisma.passwordResetCode.create({
      data: {
        userId: user.id,
        email: normalizedEmail,
        codeHash,
        expiresAt,
      },
      select: {
        id: true,
      },
    }),
  ]);

  try {
    const emailResult = await sendPasswordResetEmail({
      to: user.email,
      code,
      expiresAt,
    });

    await recordPasswordResetEmailDelivery({
      id: resetCode.id,
      sent: emailResult.sent,
      reason: emailResult.reason,
    });

    return {
      userFound: true,
      emailSent: emailResult.sent,
      throttled: Boolean(emailResult.throttled),
      reason: emailResult.reason ?? undefined,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Falha no envio do email.";
    await recordPasswordResetEmailDelivery({
      id: resetCode.id,
      sent: false,
      reason,
    });

    return {
      userFound: true,
      emailSent: false,
      throttled: false,
      reason,
    };
  }
}

export async function confirmPasswordResetCode({
  email,
  code,
  password,
}: ConfirmResetPayload) {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();
  const resetCode = await prisma.passwordResetCode.findFirst({
    where: {
      email: normalizedEmail,
      consumedAt: null,
      expiresAt: {
        gt: now,
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      email: true,
      codeHash: true,
      attemptCount: true,
    },
  });

  if (!resetCode) {
    return {
      ok: false,
      error: "Codigo invalido ou expirado.",
    };
  }

  if (resetCode.attemptCount >= RESET_CODE_MAX_ATTEMPTS) {
    await consumeResetCode(resetCode.id, now);
    return {
      ok: false,
      error: "Codigo invalido ou expirado.",
    };
  }

  const codeMatches = await compare(code.trim(), resetCode.codeHash);

  if (!codeMatches) {
    const nextAttemptCount = resetCode.attemptCount + 1;
    await prisma.passwordResetCode.update({
      where: { id: resetCode.id },
      data: {
        attemptCount: nextAttemptCount,
        consumedAt: nextAttemptCount >= RESET_CODE_MAX_ATTEMPTS ? now : null,
        updatedAt: now,
      },
    });

    return {
      ok: false,
      error: "Codigo invalido ou expirado.",
    };
  }

  const passwordHash = await hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetCode.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetCode.updateMany({
      where: {
        userId: resetCode.userId,
        email: resetCode.email,
        consumedAt: null,
      },
      data: {
        consumedAt: now,
        updatedAt: now,
      },
    }),
  ]);

  return {
    ok: true,
    error: null,
  };
}

function generateResetCode() {
  return randomInt(100000, 1_000_000).toString();
}

async function consumeResetCode(id: string, consumedAt: Date) {
  await prisma.passwordResetCode.update({
    where: { id },
    data: {
      consumedAt,
      updatedAt: consumedAt,
    },
  });
}

async function recordPasswordResetEmailDelivery({
  id,
  sent,
  reason,
}: {
  id: string;
  sent: boolean;
  reason?: string | null;
}) {
  await prisma.passwordResetCode.update({
    where: { id },
    data: {
      emailSentAt: sent ? new Date() : null,
      emailSendError: sent ? null : truncateReason(reason ?? "Falha no envio do email."),
    },
  });
}

function truncateReason(reason: string) {
  return reason.length > 500 ? `${reason.slice(0, 497)}...` : reason;
}
