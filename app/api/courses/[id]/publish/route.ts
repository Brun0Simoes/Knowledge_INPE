import { CourseStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { forbidden, getApiUser, unauthorized } from "@/lib/access";
import { invalidateCalendarEventsCache } from "@/lib/calendar-events";
import { clearPublishedFeaturedCourses } from "@/lib/courses";
import { queueCoursePublicationEmail, triggerEmailBatchProcessing } from "@/lib/mailer";
import { createCoursePublicationNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { enforceSameOriginRequest } from "@/lib/request-security";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const originError = enforceSameOriginRequest(request);
  if (originError) {
    return originError;
  }

  const user = await getApiUser();
  if (!user) {
    return unauthorized();
  }

  if (user.role !== "ADMIN") {
    return forbidden();
  }

  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      images: true,
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Curso nao encontrado." }, { status: 404 });
  }

  if (course.images.length === 0) {
    return NextResponse.json(
      { error: "Adicione ao menos uma imagem antes de publicar." },
      { status: 400 },
    );
  }

  const wasPublished = course.status === CourseStatus.PUBLISHED;

  // Publish is wrapped in a transaction so the public status and featured flag
  // switch together before notifications and e-mail fan-out begin.
  const publishedCourse = await prisma.$transaction(async (tx) => {
    const published = await tx.course.update({
      where: { id: course.id },
      data: {
        status: CourseStatus.PUBLISHED,
        publishedAt: course.publishedAt ?? new Date(),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        externalUrl: true,
      },
    });

    if (course.isFeatured) {
      await clearPublishedFeaturedCourses(published.id, tx);
    }

    return published;
  });

  let batchId: string | null = null;

  if (!wasPublished) {
    const recipients = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
      },
    });

    // Internal notifications and the course e-mail queue are created for the
    // whole user base when a new course is published.
    await createCoursePublicationNotification({
      course: publishedCourse,
      createdById: user.id,
      recipients: recipients.map((recipient) => ({ id: recipient.id })),
    });

    const batch = await queueCoursePublicationEmail({
      course: publishedCourse,
      createdById: user.id,
      recipients,
    });

    batchId = batch.id;
    triggerEmailBatchProcessing(batch.id);
  }

  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/analytics");
  revalidatePath(`/courses/${publishedCourse.slug}`);
  invalidateCalendarEventsCache();

  return NextResponse.json({
    batchId,
    alreadyPublished: wasPublished,
    message: wasPublished
      ? "Curso ja estava publicado. O status foi mantido."
      : "Curso publicado com sucesso.",
  });
}
