import { CourseStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getApiUser, unauthorized } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { courseEventSchema } from "@/lib/schemas/interaction";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getApiUser();
  if (!user) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = courseEventSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Evento invalido." }, { status: 400 });
  }

  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    select: { id: true, slug: true, status: true },
  });

  if (!course || (course.status !== CourseStatus.PUBLISHED && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Curso nao encontrado." }, { status: 404 });
  }

  await prisma.courseEvent.create({
    data: {
      courseId: course.id,
      userId: user.id,
      type: parsed.data.type,
    },
  });

  revalidatePath("/admin/analytics");
  revalidatePath("/dashboard");

  return NextResponse.json({ success: true });
}
