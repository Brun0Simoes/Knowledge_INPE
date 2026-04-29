import { startEmailQueueWorker } from "./lib/email-queue-worker";
import { ensureDatabaseSchema } from "./prisma/sqlite";

ensureDatabaseSchema();
startEmailQueueWorker();
