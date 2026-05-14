import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { forbidden, getApiUser, unauthorized } from "@/lib/access";
import { buildCourseImages, ensureUniqueCourseSlug, parseCourseFormData } from "@/lib/courses";
import { prisma } from "@/lib/prisma";
import { enforceSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

  const formData = await request.formData();
  const parsed = await parseCourseFormData(formData, "create");

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const slug = await ensureUniqueCourseSlug(parsed.data.title);
  // Course creation stays editorial-first: build the slug, normalize the gallery
  // and persist the publication as a draft until an admin explicitly publishes it.
  const images = await buildCourseImages(
    parsed.data.title,
    parsed.data.imageFiles,
    parsed.data.imageUrls,
  );

  const course = await prisma.course.create({
    data: {
      slug,
      title: parsed.data.title,
      summary: parsed.data.summary,
      description: parsed.data.description,
      externalUrl: parsed.data.externalUrl,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      isFeatured: parsed.data.isFeatured,
      authorId: user.id,
      images: {
        create: images,
      },
    },
    select: {
      id: true,
      slug: true,
    },
  });

  revalidatePath("/admin/courses");

  return NextResponse.json(course, { status: 201 });
}
