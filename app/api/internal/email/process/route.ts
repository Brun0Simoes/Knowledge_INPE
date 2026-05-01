import { timingSafeEqual } from "crypto";

import { NextResponse } from "next/server";

import { getEmailProcessorSecret, processEmailQueue } from "@/lib/mailer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expectedSecret = getEmailProcessorSecret();
  const providedSecret = request.headers.get("x-email-processor-secret");

  if (!expectedSecret || !providedSecret || !safeCompareSecret(providedSecret, expectedSecret)) {
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

function safeCompareSecret(providedSecret: string, expectedSecret: string) {
  const provided = Buffer.from(providedSecret);
  const expected = Buffer.from(expectedSecret);

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}
