import { NextResponse } from "next/server";

import { getEmailProcessorSecret, processEmailQueue } from "@/lib/mailer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const providedSecret = request.headers.get("x-email-processor-secret");
  if (!providedSecret || providedSecret !== getEmailProcessorSecret()) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | { batchId?: string; maxRecipients?: number }
    | null;

  const result = await processEmailQueue({
    batchId: payload?.batchId,
    maxRecipients: payload?.maxRecipients,
  });

  return NextResponse.json(result);
}
