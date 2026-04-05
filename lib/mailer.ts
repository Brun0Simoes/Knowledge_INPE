import {
  EmailBatchStatus,
  EmailRecipientStatus,
  type Course,
  type User,
} from "@prisma/client";
import nodemailer, { type Transporter } from "nodemailer";

import { APP_NAME } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

type PublishPayload = {
  course: Pick<Course, "id" | "slug" | "title" | "summary" | "externalUrl">;
  createdById: string;
  recipients: Array<Pick<User, "id" | "email">>;
};

type ProcessEmailQueueOptions = {
  batchId?: string;
  maxRecipients?: number;
};

type MailRuntimeConfig = {
  from: string;
  replyTo?: string;
  maxAttempts: number;
  batchSize: number;
  recipientInsertChunkSize: number;
  maxRecipientsPerRun: number;
  concurrency: number;
  staleMinutes: number;
  dailySendLimit: number | null;
  dailyWindowHours: number;
};

type MailTransportBundle = MailRuntimeConfig & {
  transporter: Transporter;
};

const BLOCKED_REASON = "SMTP nao configurado neste ambiente.";
const DAILY_LIMIT_REASON = "Limite diario de envio atingido; aguardando nova janela.";
const SQLITE_SAFE_RECIPIENT_INSERT_CHUNK_SIZE = 200;

const globalForMailer = globalThis as unknown as {
  mailerTransport?: MailTransportBundle | null;
  legacyQueueNormalization?: Promise<void>;
};

export async function queueCoursePublicationEmail({
  course,
  createdById,
  recipients,
}: PublishPayload) {
  const dedupedRecipients = dedupeRecipients(recipients);
  const mailerConfigured = isMailerConfigured();
  const runtimeConfig = getMailRuntimeConfig();

  // Batch rows are created first so publishing a course never depends on live SMTP
  // latency and can be resumed after restarts.
  return prisma.$transaction(async (tx) => {
    const batch = await tx.emailBatch.create({
      data: {
        courseId: course.id,
        createdById,
        totalRecipients: dedupedRecipients.length,
        status:
          dedupedRecipients.length === 0
            ? EmailBatchStatus.COMPLETED
            : mailerConfigured
              ? EmailBatchStatus.QUEUED
              : EmailBatchStatus.BLOCKED,
        lastError:
          dedupedRecipients.length === 0 ? null : mailerConfigured ? null : BLOCKED_REASON,
        completedAt: dedupedRecipients.length === 0 ? new Date() : null,
      },
    });

    for (const chunk of chunkArray(dedupedRecipients, runtimeConfig.recipientInsertChunkSize)) {
      await tx.emailBatchRecipient.createMany({
        data: chunk.map((recipient) => ({
          batchId: batch.id,
          userId: recipient.id,
          email: recipient.email.trim().toLowerCase(),
          status: EmailRecipientStatus.PENDING,
        })),
      });
    }

    return batch;
  });
}

export function triggerEmailBatchProcessing(batchId: string) {
  setTimeout(() => {
    void drainBatchInBackground(batchId);
  }, 0);
}

export async function processEmailQueue({
  batchId,
  maxRecipients,
}: ProcessEmailQueueOptions = {}) {
  await ensureLegacyQueueCompatibility();

  const mailer = getMailerTransport();
  const runtimeConfig = getMailRuntimeConfig();

  if (!mailer) {
    if (batchId) {
      await markBatchAsBlocked(batchId);
    } else {
      await prisma.emailBatch.updateMany({
        where: {
          status: {
            in: [EmailBatchStatus.QUEUED, EmailBatchStatus.PROCESSING],
          },
        },
        data: {
          status: EmailBatchStatus.BLOCKED,
          lastError: BLOCKED_REASON,
          processingStartedAt: null,
        },
      });
    }

    return {
      blocked: true,
      throttled: false,
      processedRecipients: 0,
      remainingRecipients: 0,
      batchId: batchId ?? null,
    };
  }

  const availableSendCapacity = await getAvailableSendCapacity(runtimeConfig);
  if (availableSendCapacity <= 0) {
    if (batchId) {
      await markBatchAsQueued(batchId, DAILY_LIMIT_REASON);
    }

    return {
      blocked: false,
      throttled: true,
      processedRecipients: 0,
      remainingRecipients: batchId ? await countRemainingRecipients(batchId, runtimeConfig.maxAttempts) : 0,
      batchId: batchId ?? null,
    };
  }

  const allowedRecipients = Math.max(
    1,
    Math.min(maxRecipients ?? runtimeConfig.maxRecipientsPerRun, availableSendCapacity),
  );

  const claimedBatchId = await claimEmailBatch(batchId, runtimeConfig.staleMinutes);
  if (!claimedBatchId) {
    return {
      blocked: false,
      throttled: false,
      processedRecipients: 0,
      remainingRecipients: 0,
      batchId: batchId ?? null,
    };
  }

  const result = await processClaimedBatch(claimedBatchId, mailer, allowedRecipients);

  return {
    blocked: false,
    throttled: false,
    processedRecipients: result.processedRecipients,
    remainingRecipients: result.remainingRecipients,
    batchId: claimedBatchId,
  };
}

function dedupeRecipients(recipients: PublishPayload["recipients"]) {
  const byEmail = new Map<string, PublishPayload["recipients"][number]>();

  for (const recipient of recipients) {
    const normalizedEmail = recipient.email.trim().toLowerCase();
    if (!normalizedEmail || !isDeliverableNotificationEmail(normalizedEmail) || byEmail.has(normalizedEmail)) {
      continue;
    }

    byEmail.set(normalizedEmail, {
      ...recipient,
      email: normalizedEmail,
    });
  }

  return Array.from(byEmail.values());
}

async function ensureLegacyQueueCompatibility() {
  // Older test runs marked recipients as SKIPPED when SMTP was absent. The current
  // queue model keeps them retryable, so we normalize legacy rows only once.
  if (!globalForMailer.legacyQueueNormalization) {
    globalForMailer.legacyQueueNormalization = (async () => {
      await prisma.emailBatchRecipient.updateMany({
        where: {
          status: EmailRecipientStatus.SKIPPED,
          sentAt: null,
          errorMessage: BLOCKED_REASON,
          batch: {
            lastError: BLOCKED_REASON,
          },
        },
        data: {
          status: EmailRecipientStatus.PENDING,
          attemptCount: 0,
          errorMessage: null,
        },
      });

      await prisma.emailBatch.updateMany({
        where: {
          lastError: BLOCKED_REASON,
          recipients: {
            some: {
              status: EmailRecipientStatus.PENDING,
            },
          },
        },
        data: {
          status: EmailBatchStatus.BLOCKED,
          skippedCount: 0,
          completedAt: null,
          processingStartedAt: null,
        },
      });
    })();
  }

  await globalForMailer.legacyQueueNormalization;
}

function getMailRuntimeConfig(): MailRuntimeConfig {
  return {
    from: process.env.SMTP_FROM ?? `${APP_NAME} <no-reply@example.com>`,
    replyTo: process.env.SMTP_REPLY_TO || undefined,
    maxAttempts: getPositiveInteger("EMAIL_MAX_ATTEMPTS", 3),
    batchSize: getPositiveInteger("EMAIL_BATCH_SIZE", 100),
    recipientInsertChunkSize: Math.min(
      getPositiveInteger(
        "EMAIL_RECIPIENT_INSERT_CHUNK_SIZE",
        SQLITE_SAFE_RECIPIENT_INSERT_CHUNK_SIZE,
      ),
      SQLITE_SAFE_RECIPIENT_INSERT_CHUNK_SIZE,
    ),
    maxRecipientsPerRun: getPositiveInteger("EMAIL_MAX_RECIPIENTS_PER_RUN", 250),
    concurrency: getPositiveInteger("EMAIL_SEND_CONCURRENCY", 5),
    staleMinutes: getPositiveInteger("EMAIL_BATCH_STALE_MINUTES", 15),
    dailySendLimit: getOptionalPositiveInteger("EMAIL_DAILY_SEND_LIMIT"),
    dailyWindowHours: getPositiveInteger("EMAIL_DAILY_WINDOW_HOURS", 24),
  };
}

function getMailerTransport() {
  if (globalForMailer.mailerTransport !== undefined) {
    return globalForMailer.mailerTransport;
  }

  const smtpUrl = process.env.SMTP_URL?.trim();
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!smtpUrl && (!host || !user || !pass)) {
    globalForMailer.mailerTransport = null;
    return globalForMailer.mailerTransport;
  }

  const runtimeConfig = getMailRuntimeConfig();
  const transporter = smtpUrl
    ? nodemailer.createTransport(
        smtpUrl as unknown as Parameters<typeof nodemailer.createTransport>[0],
      )
    : nodemailer.createTransport({
        host,
        port,
        secure: resolveBooleanEnv("SMTP_SECURE", port === 465),
        requireTLS: resolveBooleanEnv("SMTP_REQUIRE_TLS", false),
        ignoreTLS: resolveBooleanEnv("SMTP_IGNORE_TLS", false),
        auth: {
          user,
          pass,
        },
        pool: true,
        maxConnections: getPositiveInteger("SMTP_POOL_MAX_CONNECTIONS", 5),
        maxMessages: getPositiveInteger("SMTP_POOL_MAX_MESSAGES", 100),
      });

  globalForMailer.mailerTransport = {
    ...runtimeConfig,
    transporter,
  };

  return globalForMailer.mailerTransport;
}

function isMailerConfigured() {
  return getMailerTransport() !== null;
}

async function claimEmailBatch(batchId: string | undefined, staleMinutes: number) {
  // Claiming uses a compare-and-swap style update so multiple background workers
  // do not process the same batch at the same time.
  const staleBefore = new Date(Date.now() - staleMinutes * 60_000);

  const candidate = batchId
    ? await prisma.emailBatch.findFirst({
        where: {
          id: batchId,
          OR: [
            { status: EmailBatchStatus.QUEUED },
            { status: EmailBatchStatus.BLOCKED },
            {
              status: EmailBatchStatus.PROCESSING,
              processingStartedAt: { lt: staleBefore },
            },
          ],
        },
        select: {
          id: true,
          status: true,
          processingStartedAt: true,
        },
      })
    : await prisma.emailBatch.findFirst({
        where: {
          OR: [
            { status: EmailBatchStatus.QUEUED },
            { status: EmailBatchStatus.BLOCKED },
            {
              status: EmailBatchStatus.PROCESSING,
              processingStartedAt: { lt: staleBefore },
            },
          ],
          recipients: {
            some: {
              OR: [
                { status: EmailRecipientStatus.PENDING },
                {
                  status: EmailRecipientStatus.FAILED,
                  attemptCount: {
                    lt: getMailRuntimeConfig().maxAttempts,
                  },
                },
              ],
            },
          },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          processingStartedAt: true,
        },
      });

  if (!candidate) {
    return null;
  }

  const claimed = await prisma.emailBatch.updateMany({
    where: {
      id: candidate.id,
      OR: [
        { status: EmailBatchStatus.QUEUED },
        { status: EmailBatchStatus.BLOCKED },
        {
          status: EmailBatchStatus.PROCESSING,
          processingStartedAt: { lt: staleBefore },
        },
      ],
    },
    data: {
      status: EmailBatchStatus.PROCESSING,
      processingStartedAt: new Date(),
      lastError: null,
    },
  });

  if (claimed.count !== 1) {
    return null;
  }

  if (
    candidate.status === EmailBatchStatus.PROCESSING &&
    candidate.processingStartedAt &&
    candidate.processingStartedAt < staleBefore
  ) {
    await recoverStaleProcessingRecipients(candidate.id, staleBefore, getMailRuntimeConfig().maxAttempts);
  }

  return candidate.id;
}

async function processClaimedBatch(
  batchId: string,
  mailer: MailTransportBundle,
  maxRecipients: number,
) {
  let processedRecipients = 0;

  while (processedRecipients < maxRecipients) {
    const remainingBudget = maxRecipients - processedRecipients;
    const recipients = await prisma.emailBatchRecipient.findMany({
      where: {
        batchId,
        OR: [
          { status: EmailRecipientStatus.PENDING },
          {
            status: EmailRecipientStatus.FAILED,
            attemptCount: {
              lt: mailer.maxAttempts,
            },
          },
        ],
      },
      orderBy: [{ createdAt: "asc" }],
      take: Math.min(mailer.batchSize, remainingBudget),
    });

    if (recipients.length === 0) {
      break;
    }

    await runConcurrently(
      recipients,
      mailer.concurrency,
      async (recipient) => sendCoursePublicationMessage(batchId, recipient.id, mailer),
    );

    processedRecipients += recipients.length;
  }

  const batchState = await synchronizeBatchState(batchId, mailer.maxAttempts);

  return {
    processedRecipients,
    remainingRecipients: batchState.remainingRecipients,
  };
}

async function sendCoursePublicationMessage(
  batchId: string,
  recipientId: string,
  mailer: MailTransportBundle,
) {
  // Recipients move through explicit states (PENDING -> PROCESSING -> SENT/FAILED)
  // so the queue can recover safely after crashes or SMTP throttling.
  const recipient = await prisma.emailBatchRecipient.findUnique({
    where: { id: recipientId },
    select: {
      id: true,
      email: true,
      attemptCount: true,
      batch: {
        select: {
          id: true,
          course: {
            select: {
              slug: true,
              title: true,
              summary: true,
              externalUrl: true,
            },
          },
        },
      },
    },
  });

  if (!recipient || recipient.batch.id !== batchId) {
    return;
  }

  const nextAttempt = recipient.attemptCount + 1;

  await prisma.emailBatchRecipient.update({
    where: { id: recipient.id },
    data: {
      status: EmailRecipientStatus.PROCESSING,
      attemptCount: nextAttempt,
      lastAttemptAt: new Date(),
      errorMessage: null,
    },
  });

  try {
    const coursePageUrl = new URL(`/courses/${recipient.batch.course.slug}`, getAppBaseUrl()).toString();

    await mailer.transporter.sendMail({
      from: mailer.from,
      replyTo: mailer.replyTo,
      to: recipient.email,
      subject: `Novo curso em ${APP_NAME}: ${recipient.batch.course.title}`,
      html: buildCoursePublicationEmailHtml({
        coursePageUrl,
        externalUrl: recipient.batch.course.externalUrl,
        summary: recipient.batch.course.summary,
        title: recipient.batch.course.title,
      }),
    });

    await prisma.emailBatchRecipient.update({
      where: { id: recipient.id },
      data: {
        status: EmailRecipientStatus.SENT,
        sentAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida.";

    await prisma.emailBatchRecipient.update({
      where: { id: recipient.id },
      data: {
        status: nextAttempt >= mailer.maxAttempts ? EmailRecipientStatus.FAILED : EmailRecipientStatus.FAILED,
        errorMessage: message,
      },
    });
  }
}

async function synchronizeBatchState(batchId: string, maxAttempts: number) {
  const [sentCount, failedCount, skippedCount, pendingCount, retryableFailedCount, processingCount] =
    await Promise.all([
      prisma.emailBatchRecipient.count({
        where: { batchId, status: EmailRecipientStatus.SENT },
      }),
      prisma.emailBatchRecipient.count({
        where: {
          batchId,
          status: EmailRecipientStatus.FAILED,
          attemptCount: {
            gte: maxAttempts,
          },
        },
      }),
      prisma.emailBatchRecipient.count({
        where: { batchId, status: EmailRecipientStatus.SKIPPED },
      }),
      prisma.emailBatchRecipient.count({
        where: { batchId, status: EmailRecipientStatus.PENDING },
      }),
      prisma.emailBatchRecipient.count({
        where: {
          batchId,
          status: EmailRecipientStatus.FAILED,
          attemptCount: {
            lt: maxAttempts,
          },
        },
      }),
      prisma.emailBatchRecipient.count({
        where: { batchId, status: EmailRecipientStatus.PROCESSING },
      }),
    ]);

  const remainingRecipients = pendingCount + retryableFailedCount + processingCount;
  const hasTerminalErrors = failedCount > 0 || skippedCount > 0;

  await prisma.emailBatch.update({
    where: { id: batchId },
    data: {
      status:
        remainingRecipients > 0
          ? EmailBatchStatus.QUEUED
          : hasTerminalErrors
            ? EmailBatchStatus.COMPLETED_WITH_ERRORS
            : EmailBatchStatus.COMPLETED,
      sentCount,
      failedCount,
      skippedCount,
      processingStartedAt: null,
      completedAt: remainingRecipients > 0 ? null : new Date(),
      lastError: hasTerminalErrors ? "Parte dos destinatarios exigiu reprocessamento ou falhou." : null,
    },
  });

  return {
    remainingRecipients,
  };
}

async function markBatchAsBlocked(batchId: string) {
  await prisma.emailBatch.update({
    where: { id: batchId },
    data: {
      status: EmailBatchStatus.BLOCKED,
      lastError: BLOCKED_REASON,
      processingStartedAt: null,
    },
  });
}

async function markBatchAsQueued(batchId: string, reason: string) {
  await prisma.emailBatch.updateMany({
    where: {
      id: batchId,
      status: {
        in: [EmailBatchStatus.QUEUED, EmailBatchStatus.PROCESSING],
      },
    },
    data: {
      status: EmailBatchStatus.QUEUED,
      lastError: reason,
      processingStartedAt: null,
    },
  });
}

async function recoverStaleProcessingRecipients(
  batchId: string,
  staleBefore: Date,
  maxAttempts: number,
) {
  const staleRecipientFilter = {
    batchId,
    status: EmailRecipientStatus.PROCESSING,
    OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: staleBefore } }],
  } satisfies Parameters<typeof prisma.emailBatchRecipient.updateMany>[0]["where"];

  await prisma.emailBatchRecipient.updateMany({
    where: {
      ...staleRecipientFilter,
      attemptCount: {
        lt: maxAttempts,
      },
    },
    data: {
      status: EmailRecipientStatus.PENDING,
      errorMessage: "Entrega retomada apos reinicio do processador.",
    },
  });

  await prisma.emailBatchRecipient.updateMany({
    where: {
      ...staleRecipientFilter,
      attemptCount: {
        gte: maxAttempts,
      },
    },
    data: {
      status: EmailRecipientStatus.FAILED,
      errorMessage: "Falha definitiva apos interrupcao do processador.",
    },
  });
}

async function drainBatchInBackground(batchId: string) {
  // Background draining is bounded to avoid an infinite loop if the provider keeps
  // rejecting deliveries or the daily limit has been reached.
  const maxIterations = getPositiveInteger("EMAIL_BACKGROUND_MAX_ITERATIONS", 50);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const result = await processEmailQueue({ batchId });

    if (result.blocked || result.throttled || result.remainingRecipients === 0) {
      return;
    }
  }
}

async function getAvailableSendCapacity(runtimeConfig: MailRuntimeConfig) {
  if (!runtimeConfig.dailySendLimit) {
    return runtimeConfig.maxRecipientsPerRun;
  }

  const sentInWindow = await prisma.emailBatchRecipient.count({
    where: {
      status: EmailRecipientStatus.SENT,
      sentAt: {
        gte: new Date(Date.now() - runtimeConfig.dailyWindowHours * 60 * 60 * 1000),
      },
    },
  });

  return Math.max(0, runtimeConfig.dailySendLimit - sentInWindow);
}

async function countRemainingRecipients(batchId: string, maxAttempts: number) {
  return prisma.emailBatchRecipient.count({
    where: {
      batchId,
      OR: [
        { status: EmailRecipientStatus.PENDING },
        {
          status: EmailRecipientStatus.FAILED,
          attemptCount: {
            lt: maxAttempts,
          },
        },
        { status: EmailRecipientStatus.PROCESSING },
      ],
    },
  });
}

async function runConcurrently<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) {
        return;
      }

      await worker(item);
    }
  });

  await Promise.all(workers);
}

function buildCoursePublicationEmailHtml({
  title,
  summary,
  coursePageUrl,
  externalUrl,
}: {
  title: string;
  summary: string;
  coursePageUrl: string;
  externalUrl: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.24em; color: #64748b;">${APP_NAME}</p>
      <h1 style="font-size: 28px; line-height: 1.2; margin: 12px 0 16px;">${title}</h1>
      <p style="font-size: 16px; line-height: 1.7; margin: 0 0 24px;">${summary}</p>
      <div style="display: flex; gap: 12px; flex-wrap: wrap; margin: 24px 0;">
        <a href="${coursePageUrl}" style="display: inline-block; background: #163650; color: #ffffff; padding: 12px 18px; border-radius: 999px; text-decoration: none;">Ver na ${APP_NAME}</a>
        <a href="${externalUrl}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 12px 18px; border-radius: 999px; text-decoration: none;">Abrir no Moodle</a>
      </div>
      <p style="font-size: 13px; line-height: 1.6; color: #64748b;">
        Voce recebeu este aviso porque ativou as notificacoes de novos cursos em ${APP_NAME}.
      </p>
    </div>
  `;
}

function getAppBaseUrl() {
  return process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000";
}

function getPositiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function getOptionalPositiveInteger(name: string) {
  const value = process.env[name];

  if (value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function resolveBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function chunkArray<T>(items: T[], chunkSize: number) {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function isDeliverableNotificationEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();

  if (!domain) {
    return false;
  }

  return !(
    domain === "localhost" ||
    domain.endsWith(".local") ||
    domain.endsWith(".test") ||
    domain === "example.com" ||
    domain === "example.org" ||
    domain === "example.net"
  );
}

export function getEmailProcessorSecret() {
  return process.env.EMAIL_PROCESSOR_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret-change-me";
}

export async function closeMailerTransport() {
  const activeMailer = globalForMailer.mailerTransport;

  if (!activeMailer) {
    return;
  }

  activeMailer.transporter.close();
  globalForMailer.mailerTransport = null;
}
