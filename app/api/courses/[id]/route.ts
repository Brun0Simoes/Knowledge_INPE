import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { CourseStatus } from "@prisma/client";

import { forbidden, getApiUser, unauthorized } from "@/lib/access";
import {
  buildCourseImages,
  clearPublishedFeaturedCourses,
  ensureUniqueCourseSlug,
  parseCourseFormData,
} from "@/lib/courses";
import { invalidateCalendarEventsCache } from "@/lib/calendar-events";
import { prisma } from "@/lib/prisma";
import { removeUploadedFiles } from "@/lib/uploads";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
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
      images: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Curso nao encontrado." }, { status: 404 });
  }

  const formData = await request.formData();
  const parsed = await parseCourseFormData(formData, "update");
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (course.images.length === 0 && parsed.data.imageFiles.length === 0 && parsed.data.imageUrls.length === 0) {
    return NextResponse.json(
      { error: "O curso precisa ter ao menos uma imagem registrada." },
      { status: 400 },
    );
  }

  const slug =
    parsed.data.title === course.title
      ? course.slug
      : await ensureUniqueCourseSlug(parsed.data.title, course.id);

  const newImages = await buildCourseImages(
    parsed.data.title,
    parsed.data.imageFiles,
    parsed.data.imageUrls,
    course.images.length,
  );

  // Update and featured-slot maintenance run in one transaction so the hero
  // selection never lands in an inconsistent state.
  const updatedCourse = await prisma.$transaction(async (tx) => {
    const updated = await tx.course.update({
      where: { id: course.id },
      data: {
        slug,
        title: parsed.data.title,
        summary: parsed.data.summary,
        description: parsed.data.description,
        externalUrl: parsed.data.externalUrl,
        isFeatured: parsed.data.isFeatured,
        ...(newImages.length
          ? {
              images: {
                create: newImages,
              },
            }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        status: true,
      },
    });

    if (parsed.data.isFeatured && updated.status === CourseStatus.PUBLISHED) {
      await clearPublishedFeaturedCourses(updated.id, tx);
    }

    return updated;
  });

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${course.id}/edit`);
  revalidatePath("/dashboard");
  revalidatePath(`/courses/${updatedCourse.slug}`);

  if (updatedCourse.status === CourseStatus.PUBLISHED) {
    invalidateCalendarEventsCache();
  }

  return NextResponse.json(updatedCourse);
}

export async function DELETE(_: Request, { params }: RouteContext) {
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

  // Notifications linked to the course are removed first so the inbox never keeps
  // dangling links after an admin deletes a publication.
  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({
      where: {
        courseId: course.id,
      },
    });

    await tx.course.delete({
      where: { id: course.id },
    });
  });

  await removeUploadedFiles(
    course.images
      .filter((image) => image.source === "UPLOAD")
      .map((image) => image.url),
  );

  revalidatePath("/admin/courses");
  revalidatePath("/admin/analytics");
  revalidatePath(`/admin/courses/${course.id}/edit`);
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  revalidatePath(`/courses/${course.slug}`);
  invalidateCalendarEventsCache();

  return NextResponse.json({ success: true, deletedStatus: course.status });
}
