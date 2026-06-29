import {
  CourseEventType,
  EmailBatchStatus,
  EmailRecipientStatus,
  type Course,
  type User,
} from "@prisma/client";
import nodemailer, { type Transporter } from "nodemailer8";

import { getConfiguredAppOrigin } from "@/lib/app-origin";
import { isWeakSharedSecret } from "@/lib/auth-secret";
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

type PasswordResetEmailPayload = {
  to: string;
  code: string;
  expiresAt: Date;
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
  userNotificationQuotaPercent: number;
  dailyWindowHours: number;
};

type MailTransportBundle = MailRuntimeConfig & {
  transporter: Transporter;
};

type EmailQuotaCategory = "course-publication" | "password-reset";
type QueuedRecipient = PublishPayload["recipients"][number] & {
  priorityScore: number;
};

const BLOCKED_REASON = "SMTP nao configurado neste ambiente.";
const DAILY_LIMIT_REASON = "Limite diario de envio atingido; aguardando nova janela.";
const PASSWORD_RESET_DAILY_LIMIT_REASON =
  "Cota diaria de recuperacao de senha atingida; tente novamente mais tarde.";
const SQLITE_SAFE_RECIPIENT_INSERT_CHUNK_SIZE = 200;
const KNOWLEDGE_LOGO_CID = "knowledge-logo@knowledge";
const DEFAULT_USER_NOTIFICATION_QUOTA_PERCENT = 90;
const COURSE_EVENT_PRIORITY_WEIGHTS: Record<CourseEventType, number> = {
  [CourseEventType.VIEW]: 1,
  [CourseEventType.CLICK_EXTERNAL]: 4,
};
const ACTIVITY_PRIORITY_WEIGHTS = {
  like: 3,
  review: 6,
  comment: 5,
  notificationRead: 1,
} as const;

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
  const priorityScores = await getRecipientPriorityScores(dedupedRecipients);

  // Batch rows are created first so publishing a course never depends on live SMTP
  // latency and can be resumed after restarts.
  return prisma.$transaction(async (tx) => {
    const existingRecipientRows =
      dedupedRecipients.length === 0
        ? []
        : await tx.emailBatchRecipient.findMany({
            where: {
              email: {
                in: dedupedRecipients.map((recipient) => recipient.email),
              },
              batch: {
                courseId: course.id,
              },
            },
            select: {
              email: true,
            },
          });
    const existingRecipientEmails = new Set(
      existingRecipientRows.map((recipient) => recipient.email.trim().toLowerCase()),
    );
    const recipientsToQueue = dedupedRecipients
      .filter((recipient) => !existingRecipientEmails.has(recipient.email))
      .map((recipient) => ({
        ...recipient,
        priorityScore: priorityScores.get(recipient.id) ?? 0,
      }))
      .sort(compareRecipientsByPriority);

    const batch = await tx.emailBatch.create({
      data: {
        courseId: course.id,
        createdById,
        totalRecipients: recipientsToQueue.length,
        status:
          recipientsToQueue.length === 0
            ? EmailBatchStatus.COMPLETED
            : mailerConfigured
              ? EmailBatchStatus.QUEUED
              : EmailBatchStatus.BLOCKED,
        lastError:
          recipientsToQueue.length === 0 ? null : mailerConfigured ? null : BLOCKED_REASON,
        completedAt: recipientsToQueue.length === 0 ? new Date() : null,
      },
    });

    for (const chunk of chunkArray(recipientsToQueue, runtimeConfig.recipientInsertChunkSize)) {
      await tx.emailBatchRecipient.createMany({
        data: chunk.map((recipient) => ({
          batchId: batch.id,
          userId: recipient.id,
          email: recipient.email.trim().toLowerCase(),
          status: EmailRecipientStatus.PENDING,
          priorityScore: recipient.priorityScore,
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

  const availableSendCapacity = await getAvailableSendCapacity(runtimeConfig, "course-publication");
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

export async function sendPasswordResetEmail({
  to,
  code,
  expiresAt,
}: PasswordResetEmailPayload) {
  const mailer = getMailerTransport();

  if (!mailer) {
    return { sent: false, reason: BLOCKED_REASON };
  }

  const availableSendCapacity = await getAvailableSendCapacity(mailer, "password-reset");
  if (availableSendCapacity <= 0) {
    return {
      sent: false,
      reason: PASSWORD_RESET_DAILY_LIMIT_REASON,
      throttled: true,
    };
  }

  await mailer.transporter.sendMail({
    from: mailer.from,
    replyTo: mailer.replyTo,
    to,
    subject: `Codigo de recuperacao da ${APP_NAME}`,
    text: buildPasswordResetEmailText({ code, expiresAt }),
    html: buildPasswordResetEmailHtml({ code, expiresAt }),
    attachments: [
      {
        filename: "knowledge-logo.svg",
        content: buildKnowledgeLogoSvg(),
        cid: KNOWLEDGE_LOGO_CID,
        contentType: "image/svg+xml",
      },
    ],
  });

  return { sent: true, reason: null };
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

async function getRecipientPriorityScores(recipients: PublishPayload["recipients"]) {
  const userIds = Array.from(new Set(recipients.map((recipient) => recipient.id)));
  const scores = new Map(userIds.map((userId) => [userId, 0]));

  if (userIds.length === 0) {
    return scores;
  }

  const [events, likes, reviews, comments, readNotifications] = await Promise.all([
    prisma.courseEvent.groupBy({
      by: ["userId", "type"],
      where: {
        userId: {
          in: userIds,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.courseLike.groupBy({
      by: ["userId"],
      where: {
        userId: {
          in: userIds,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.courseReview.groupBy({
      by: ["userId"],
      where: {
        userId: {
          in: userIds,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.courseComment.groupBy({
      by: ["userId"],
      where: {
        userId: {
          in: userIds,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.userNotification.groupBy({
      by: ["userId"],
      where: {
        userId: {
          in: userIds,
        },
        readAt: {
          not: null,
        },
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  for (const event of events) {
    if (!event.userId) {
      continue;
    }

    addPriorityScore(
      scores,
      event.userId,
      event._count._all * COURSE_EVENT_PRIORITY_WEIGHTS[event.type],
    );
  }

  for (const like of likes) {
    addPriorityScore(scores, like.userId, like._count._all * ACTIVITY_PRIORITY_WEIGHTS.like);
  }

  for (const review of reviews) {
    addPriorityScore(scores, review.userId, review._count._all * ACTIVITY_PRIORITY_WEIGHTS.review);
  }

  for (const comment of comments) {
    addPriorityScore(scores, comment.userId, comment._count._all * ACTIVITY_PRIORITY_WEIGHTS.comment);
  }

  for (const notification of readNotifications) {
    addPriorityScore(
      scores,
      notification.userId,
      notification._count._all * ACTIVITY_PRIORITY_WEIGHTS.notificationRead,
    );
  }

  return scores;
}

function addPriorityScore(scores: Map<string, number>, userId: string, score: number) {
  scores.set(userId, (scores.get(userId) ?? 0) + score);
}

function compareRecipientsByPriority(a: QueuedRecipient, b: QueuedRecipient) {
  return b.priorityScore - a.priorityScore || a.email.localeCompare(b.email);
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
    userNotificationQuotaPercent: getPercentage(
      "EMAIL_USER_NOTIFICATIONS_DAILY_PERCENT",
      DEFAULT_USER_NOTIFICATION_QUOTA_PERCENT,
    ),
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

export function isMailerConfigured() {
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
      orderBy: [{ priorityScore: "desc" }, { createdAt: "asc" }],
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

async function getAvailableSendCapacity(
  runtimeConfig: MailRuntimeConfig,
  category: EmailQuotaCategory,
) {
  const dailyLimit = getDailyLimitForCategory(runtimeConfig, category);
  if (dailyLimit === null) {
    return runtimeConfig.maxRecipientsPerRun;
  }

  const windowStartedAt = new Date(
    Date.now() - runtimeConfig.dailyWindowHours * 60 * 60 * 1000,
  );

  const sentInWindow =
    category === "course-publication"
      ? await prisma.emailBatchRecipient.count({
          where: {
            status: EmailRecipientStatus.SENT,
            sentAt: {
              gte: windowStartedAt,
            },
          },
        })
      : await prisma.passwordResetCode.count({
          where: {
            emailSentAt: {
              gte: windowStartedAt,
            },
          },
        });

  return Math.max(0, dailyLimit - sentInWindow);
}

function getDailyLimitForCategory(
  runtimeConfig: MailRuntimeConfig,
  category: EmailQuotaCategory,
) {
  if (!runtimeConfig.dailySendLimit) {
    return null;
  }

  const userNotificationLimit = Math.floor(
    (runtimeConfig.dailySendLimit * runtimeConfig.userNotificationQuotaPercent) / 100,
  );

  if (category === "course-publication") {
    return userNotificationLimit;
  }

  return Math.max(0, runtimeConfig.dailySendLimit - userNotificationLimit);
}

function getPercentage(name: string, fallback: number) {
  const value = process.env[name];

  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.floor(parsed)));
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
        Voce recebeu este aviso porque esta cadastrado na ${APP_NAME}.
      </p>
    </div>
  `;
}

function buildPasswordResetEmailHtml({
  code,
  expiresAt,
}: {
  code: string;
  expiresAt: Date;
}) {
  const expiresLabel = escapeHtml(formatPasswordResetExpiry(expiresAt));
  const escapedCode = escapeHtml(code);
  const resetUrl = escapeHtml(new URL("/forgot-password", getAppBaseUrl()).toString());

  return `
    <div style="margin:0; padding:0; background:#f4f7fb;">
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 28px 20px; color: #1f2937;">
        <div style="background:#ffffff; border:1px solid #dbe4ee; border-radius:24px; padding:28px;">
          <img src="cid:${KNOWLEDGE_LOGO_CID}" alt="${APP_NAME}" style="display:block; height:48px; width:auto; margin:0 0 24px;" />
          <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.24em; color: #0f766e; margin:0 0 10px;">Recuperacao de senha</p>
          <h1 style="font-size: 26px; line-height: 1.2; margin: 0 0 16px; color:#122033;">Seu codigo de seguranca</h1>
          <p style="font-size: 16px; line-height: 1.7; margin: 0 0 20px; color:#475569;">
            Use o codigo abaixo para alterar sua senha na ${APP_NAME}. Ele expira em ${expiresLabel}.
          </p>
          <div style="font-size: 34px; line-height: 1; letter-spacing: 0.28em; font-weight: 700; color:#122033; background:#eef6f5; border:1px solid #cce8e4; border-radius:18px; padding:18px 20px; text-align:center; margin: 0 0 22px;">
            ${escapedCode}
          </div>
          <a href="${resetUrl}" style="display:inline-block; background:#0f766e; color:#ffffff; padding:12px 18px; border-radius:999px; text-decoration:none; font-weight:700;">Abrir recuperacao de senha</a>
          <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 24px 0 0;">
            Se voce nao solicitou esta alteracao, ignore este email.
          </p>
        </div>
      </div>
    </div>
  `;
}

function buildPasswordResetEmailText({
  code,
  expiresAt,
}: {
  code: string;
  expiresAt: Date;
}) {
  return [
    `${APP_NAME} - Recuperacao de senha`,
    "",
    `Codigo: ${code}`,
    `Expira em: ${formatPasswordResetExpiry(expiresAt)}`,
    "",
    "Se voce nao solicitou esta alteracao, ignore este email.",
  ].join("\n");
}

function buildKnowledgeLogoSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="96" viewBox="0 0 320 96" role="img" aria-label="${APP_NAME}">
      <rect width="320" height="96" rx="28" fill="#122033"/>
      <circle cx="55" cy="48" r="21" fill="none" stroke="#2dd4bf" stroke-width="5"/>
      <path d="M38 49c21-17 44-18 68-3" fill="none" stroke="#fbbf24" stroke-width="5" stroke-linecap="round"/>
      <circle cx="79" cy="35" r="5" fill="#fbbf24"/>
      <text x="116" y="58" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#ffffff" letter-spacing="0.6">${APP_NAME}</text>
    </svg>
  `;
}

function formatPasswordResetExpiry(expiresAt: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(expiresAt);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAppBaseUrl() {
  return getConfiguredAppOrigin();
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
  const secret = process.env.EMAIL_PROCESSOR_SECRET || process.env.NEXTAUTH_SECRET;
  if (isWeakSharedSecret(secret)) {
    return null;
  }

  return secret;
}

export async function closeMailerTransport() {
  const activeMailer = globalForMailer.mailerTransport;

  if (!activeMailer) {
    return;
  }

  activeMailer.transporter.close();
  globalForMailer.mailerTransport = null;
}
