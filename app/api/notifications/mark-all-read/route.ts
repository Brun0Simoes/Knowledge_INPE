import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getApiUser, unauthorized } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { enforceSameOriginRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  const originError = enforceSameOriginRequest(request);
  if (originError) {
    return originError;
  }

  const user = await getApiUser();
  if (!user) {
    return unauthorized();
  }

  await prisma.userNotification.updateMany({
    where: {
      userId: user.id,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/notifications");

  return NextResponse.json({ success: true });
}
