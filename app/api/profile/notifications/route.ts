import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getApiUser, unauthorized } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { notificationPreferenceSchema } from "@/lib/schemas/interaction";

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = notificationPreferenceSchema.safeParse({
    notificationOptIn: body?.notificationOptIn,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Preferencia invalida." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      notificationOptIn: parsed.data.notificationOptIn,
    },
  });

  revalidatePath("/dashboard");

  return NextResponse.json({ success: true });
}
