import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getApiUser, unauthorized } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { notificationReadSchema } from "@/lib/schemas/interaction";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getApiUser();
  if (!user) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = notificationReadSchema.safeParse({
    read: body?.read,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Estado de leitura invalido." }, { status: 400 });
  }

  const { id } = await params;
  const updated = await prisma.userNotification.updateMany({
    where: {
      id,
      userId: user.id,
    },
    data: {
      readAt: parsed.data.read ? new Date() : null,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Notificacao nao encontrada." }, { status: 404 });
  }

  revalidatePath("/dashboard");
  revalidatePath("/notifications");

  return NextResponse.json({ success: true });
}
