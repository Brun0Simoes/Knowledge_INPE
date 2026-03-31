import "dotenv/config";

import { closeMailerTransport, processEmailQueue } from "@/lib/mailer";
import { ensureDatabaseSchema } from "@/prisma/sqlite";

async function main() {
  ensureDatabaseSchema();

  const result = await processEmailQueue();

  console.log(
    JSON.stringify(
      {
        batchId: result.batchId,
        blocked: result.blocked,
        throttled: result.throttled,
        processedRecipients: result.processedRecipients,
        remainingRecipients: result.remainingRecipients,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await closeMailerTransport();
});
