import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

function resolveDatabasePath() {
  const connectionUrl = process.env.DATABASE_URL ?? "file:./dev.db";

  if (!connectionUrl.startsWith("file:")) {
    throw new Error("Este bootstrap local suporta apenas SQLite com DATABASE_URL iniciando em file:.");
  }

  const databasePath = connectionUrl.replace(/^file:/, "").replace(/^\.\//, "");

  if (path.isAbsolute(databasePath)) {
    return databasePath;
  }

  return path.resolve(/* turbopackIgnore: true */ process.cwd(), databasePath);
}

export function ensureDatabaseSchema() {
  const databasePath = resolveDatabasePath();
  mkdirSync(path.dirname(databasePath), { recursive: true });
  copySeedDatabaseIfMissing(databasePath);
  copySeedUploadsIfAvailable();

  const db = new DatabaseSync(databasePath);

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "emailVerified" DATETIME,
      "image" TEXT,
      "passwordHash" TEXT,
      "role" TEXT NOT NULL DEFAULT 'USER',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "Account" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "providerAccountId" TEXT NOT NULL,
      "refresh_token" TEXT,
      "access_token" TEXT,
      "expires_at" INTEGER,
      "token_type" TEXT,
      "scope" TEXT,
      "id_token" TEXT,
      "session_state" TEXT,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key"
    ON "Account"("provider", "providerAccountId");

    CREATE TABLE IF NOT EXISTS "Session" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sessionToken" TEXT NOT NULL UNIQUE,
      "userId" TEXT NOT NULL,
      "expires" DATETIME NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "VerificationToken" (
      "identifier" TEXT NOT NULL,
      "token" TEXT NOT NULL UNIQUE,
      "expires" DATETIME NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key"
    ON "VerificationToken"("identifier", "token");

    CREATE TABLE IF NOT EXISTS "PasswordResetCode" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "codeHash" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "consumedAt" DATETIME,
      "attemptCount" INTEGER NOT NULL DEFAULT 0,
      "emailSentAt" DATETIME,
      "emailSendError" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "PasswordResetCode_email_createdAt_idx"
    ON "PasswordResetCode"("email", "createdAt");
    CREATE INDEX IF NOT EXISTS "PasswordResetCode_userId_consumedAt_expiresAt_idx"
    ON "PasswordResetCode"("userId", "consumedAt", "expiresAt");

    CREATE TABLE IF NOT EXISTS "Course" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "slug" TEXT NOT NULL UNIQUE,
      "title" TEXT NOT NULL,
      "summary" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "externalUrl" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "isFeatured" BOOLEAN NOT NULL DEFAULT 0,
      "authorId" TEXT NOT NULL,
      "startsAt" DATETIME,
      "endsAt" DATETIME,
      "publishedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "Course_status_publishedAt_idx" ON "Course"("status", "publishedAt");
    CREATE INDEX IF NOT EXISTS "Course_authorId_idx" ON "Course"("authorId");

    CREATE TABLE IF NOT EXISTS "CourseImage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "courseId" TEXT NOT NULL,
      "source" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "alt" TEXT NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "CourseImage_courseId_sortOrder_idx"
    ON "CourseImage"("courseId", "sortOrder");

    CREATE TABLE IF NOT EXISTS "CourseEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "courseId" TEXT NOT NULL,
      "userId" TEXT,
      "type" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "CourseEvent_courseId_type_createdAt_idx"
    ON "CourseEvent"("courseId", "type", "createdAt");
    CREATE INDEX IF NOT EXISTS "CourseEvent_userId_createdAt_idx"
    ON "CourseEvent"("userId", "createdAt");

    CREATE TABLE IF NOT EXISTS "CourseLike" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "courseId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "CourseLike_courseId_userId_key"
    ON "CourseLike"("courseId", "userId");
    CREATE INDEX IF NOT EXISTS "CourseLike_userId_createdAt_idx"
    ON "CourseLike"("userId", "createdAt");

    CREATE TABLE IF NOT EXISTS "CourseReview" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "courseId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "rating" INTEGER NOT NULL,
      "body" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "CourseReview_courseId_userId_key"
    ON "CourseReview"("courseId", "userId");
    CREATE INDEX IF NOT EXISTS "CourseReview_courseId_rating_idx"
    ON "CourseReview"("courseId", "rating");

    CREATE TABLE IF NOT EXISTS "CourseComment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "courseId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "CourseComment_courseId_createdAt_idx"
    ON "CourseComment"("courseId", "createdAt");

    CREATE TABLE IF NOT EXISTS "EmailBatch" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "courseId" TEXT NOT NULL,
      "createdById" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'QUEUED',
      "totalRecipients" INTEGER NOT NULL DEFAULT 0,
      "sentCount" INTEGER NOT NULL DEFAULT 0,
      "failedCount" INTEGER NOT NULL DEFAULT 0,
      "skippedCount" INTEGER NOT NULL DEFAULT 0,
      "lastError" TEXT,
      "processingStartedAt" DATETIME,
      "completedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "EmailBatch_courseId_createdAt_idx"
    ON "EmailBatch"("courseId", "createdAt");

    CREATE TABLE IF NOT EXISTS "EmailBatchRecipient" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "batchId" TEXT NOT NULL,
      "userId" TEXT,
      "email" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "attemptCount" INTEGER NOT NULL DEFAULT 0,
      "priorityScore" INTEGER NOT NULL DEFAULT 0,
      "lastAttemptAt" DATETIME,
      "errorMessage" TEXT,
      "sentAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("batchId") REFERENCES "EmailBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "EmailBatchRecipient_batchId_status_idx"
    ON "EmailBatchRecipient"("batchId", "status");
    CREATE INDEX IF NOT EXISTS "EmailBatchRecipient_email_idx"
    ON "EmailBatchRecipient"("email");

    CREATE TABLE IF NOT EXISTS "Notification" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "type" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "href" TEXT NOT NULL,
      "courseId" TEXT,
      "createdById" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx"
    ON "Notification"("createdAt");
    CREATE INDEX IF NOT EXISTS "Notification_courseId_createdAt_idx"
    ON "Notification"("courseId", "createdAt");

    CREATE TABLE IF NOT EXISTS "UserNotification" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "notificationId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "readAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "UserNotification_notificationId_userId_key"
    ON "UserNotification"("notificationId", "userId");
    CREATE INDEX IF NOT EXISTS "UserNotification_userId_readAt_createdAt_idx"
    ON "UserNotification"("userId", "readAt", "createdAt");
    CREATE INDEX IF NOT EXISTS "UserNotification_notificationId_createdAt_idx"
    ON "UserNotification"("notificationId", "createdAt");
  `);

  ensureColumn(db, "EmailBatch", "status", "TEXT NOT NULL DEFAULT 'QUEUED'");
  ensureColumn(db, "EmailBatch", "lastError", "TEXT");
  ensureColumn(db, "EmailBatch", "processingStartedAt", "DATETIME");
  ensureColumn(db, "EmailBatch", "completedAt", "DATETIME");
  ensureColumn(db, "EmailBatch", "updatedAt", "DATETIME");
  ensureColumn(db, "EmailBatchRecipient", "attemptCount", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "EmailBatchRecipient", "priorityScore", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "EmailBatchRecipient", "lastAttemptAt", "DATETIME");
  ensureColumn(db, "Course", "startsAt", "DATETIME");
  ensureColumn(db, "Course", "endsAt", "DATETIME");
  ensureColumn(db, "PasswordResetCode", "attemptCount", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "PasswordResetCode", "consumedAt", "DATETIME");
  ensureColumn(db, "PasswordResetCode", "emailSentAt", "DATETIME");
  ensureColumn(db, "PasswordResetCode", "emailSendError", "TEXT");
  ensureColumn(db, "PasswordResetCode", "updatedAt", "DATETIME");
  ensureColumn(db, "Notification", "type", "TEXT NOT NULL DEFAULT 'COURSE_PUBLISHED'");
  ensureColumn(db, "Notification", "title", "TEXT");
  ensureColumn(db, "Notification", "body", "TEXT");
  ensureColumn(db, "Notification", "href", "TEXT");
  ensureColumn(db, "Notification", "courseId", "TEXT");
  ensureColumn(db, "Notification", "createdById", "TEXT");
  ensureColumn(db, "Notification", "createdAt", "DATETIME");
  ensureColumn(db, "UserNotification", "readAt", "DATETIME");
  ensureColumn(db, "UserNotification", "createdAt", "DATETIME");

  db.exec(`
    CREATE INDEX IF NOT EXISTS "EmailBatch_status_processingStartedAt_idx"
    ON "EmailBatch"("status", "processingStartedAt");

    CREATE INDEX IF NOT EXISTS "EmailBatchRecipient_batchId_attemptCount_idx"
    ON "EmailBatchRecipient"("batchId", "attemptCount");

    CREATE INDEX IF NOT EXISTS "EmailBatchRecipient_batchId_status_priorityScore_idx"
    ON "EmailBatchRecipient"("batchId", "status", "priorityScore");

    CREATE INDEX IF NOT EXISTS "PasswordResetCode_email_createdAt_idx"
    ON "PasswordResetCode"("email", "createdAt");

    CREATE INDEX IF NOT EXISTS "PasswordResetCode_emailSentAt_idx"
    ON "PasswordResetCode"("emailSentAt");

    CREATE INDEX IF NOT EXISTS "PasswordResetCode_userId_consumedAt_expiresAt_idx"
    ON "PasswordResetCode"("userId", "consumedAt", "expiresAt");

    CREATE INDEX IF NOT EXISTS "Course_status_startsAt_idx"
    ON "Course"("status", "startsAt");

    CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx"
    ON "Notification"("createdAt");

    CREATE INDEX IF NOT EXISTS "Notification_courseId_createdAt_idx"
    ON "Notification"("courseId", "createdAt");

    CREATE INDEX IF NOT EXISTS "UserNotification_userId_readAt_createdAt_idx"
    ON "UserNotification"("userId", "readAt", "createdAt");

    CREATE INDEX IF NOT EXISTS "UserNotification_notificationId_createdAt_idx"
    ON "UserNotification"("notificationId", "createdAt");
  `);

  db.exec(`
    UPDATE "EmailBatch"
    SET "status" = CASE
      WHEN "totalRecipients" = 0 THEN 'COMPLETED'
      WHEN "sentCount" + "failedCount" + "skippedCount" >= "totalRecipients"
        THEN CASE
          WHEN "failedCount" > 0 OR "skippedCount" > 0 THEN 'COMPLETED_WITH_ERRORS'
          ELSE 'COMPLETED'
        END
      WHEN "lastError" = 'SMTP nao configurado neste ambiente.' THEN 'BLOCKED'
      WHEN "status" IS NOT NULL AND "status" <> '' THEN "status"
      ELSE 'QUEUED'
    END;

    UPDATE "EmailBatch"
    SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP);

    UPDATE "EmailBatchRecipient"
    SET "attemptCount" = CASE
      WHEN "status" IN ('SENT', 'FAILED', 'SKIPPED') AND "attemptCount" = 0 THEN 1
      ELSE "attemptCount"
    END;

    UPDATE "Notification"
    SET "type" = COALESCE(NULLIF("type", ''), 'COURSE_PUBLISHED'),
        "title" = COALESCE("title", 'Novo curso publicado'),
        "body" = COALESCE("body", 'Uma nova publicacao foi publicada na knowledge.'),
        "href" = COALESCE("href", '/dashboard'),
        "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP);

    UPDATE "UserNotification"
    SET "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP);

    INSERT INTO "Notification" ("id", "type", "title", "body", "href", "courseId", "createdById", "createdAt")
    SELECT
      lower(hex(randomblob(12))),
      'COURSE_PUBLISHED',
      'Novo curso publicado',
      "Course"."title" || ' foi publicado na knowledge.',
      '/courses/' || "Course"."slug",
      "Course"."id",
      "Course"."authorId",
      COALESCE("Course"."publishedAt", "Course"."createdAt", CURRENT_TIMESTAMP)
    FROM "Course"
    WHERE "Course"."status" = 'PUBLISHED'
      AND NOT EXISTS (
        SELECT 1
        FROM "Notification"
        WHERE "Notification"."courseId" = "Course"."id"
      );

    INSERT INTO "UserNotification" ("id", "notificationId", "userId", "createdAt")
    SELECT
      lower(hex(randomblob(12))),
      "Notification"."id",
      "User"."id",
      COALESCE("Notification"."createdAt", CURRENT_TIMESTAMP)
    FROM "Notification"
    INNER JOIN "Course" ON "Course"."id" = "Notification"."courseId"
    CROSS JOIN "User"
    WHERE "Course"."status" = 'PUBLISHED'
      AND NOT EXISTS (
        SELECT 1
        FROM "UserNotification"
        WHERE "UserNotification"."notificationId" = "Notification"."id"
          AND "UserNotification"."userId" = "User"."id"
      );
  `);

  db.close();

  return databasePath;
}

function copySeedDatabaseIfMissing(databasePath: string) {
  const seedDatabasePath = path.resolve(/* turbopackIgnore: true */ process.cwd(), "seed", "knowledge.db");

  if (!existsSync(seedDatabasePath)) {
    return;
  }

  const shouldCopySeed = !existsSync(databasePath) || statSync(databasePath).size === 0;
  if (!shouldCopySeed) {
    return;
  }

  copyFileSync(seedDatabasePath, databasePath);
}

function copySeedUploadsIfAvailable() {
  const seedUploadsPath = path.resolve(/* turbopackIgnore: true */ process.cwd(), "seed", "uploads");
  const publicUploadsPath = path.resolve(/* turbopackIgnore: true */ process.cwd(), "public", "uploads");

  copyMissingFiles(seedUploadsPath, publicUploadsPath);
}

function copyMissingFiles(sourceDirectory: string, targetDirectory: string) {
  if (!existsSync(sourceDirectory)) {
    return;
  }

  mkdirSync(targetDirectory, { recursive: true });

  for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);

    if (entry.isDirectory()) {
      copyMissingFiles(sourcePath, targetPath);
    } else if (entry.isFile() && !existsSync(targetPath)) {
      copyFileSync(sourcePath, targetPath);
    }
  }
}

function ensureColumn(
  db: DatabaseSync,
  tableName: string,
  columnName: string,
  columnDefinition: string,
) {
  const columns = (db as unknown as { prepare: (sql: string) => { all: () => unknown[] } })
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all() as Array<{ name: string }>;

  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  db.exec(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnDefinition};`);
}
