import { CourseStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getApiUser, unauthorized } from "@/lib/access";
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

  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      status: true,
      likes: {
        where: { userId: user.id },
        select: { id: true },
      },
    },
  });

  if (!course || (course.status !== CourseStatus.PUBLISHED && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Curso nao encontrado." }, { status: 404 });
  }

  const existingLike = course.likes[0];

  if (existingLike) {
    await prisma.courseLike.delete({
      where: { id: existingLike.id },
    });
  } else {
    await prisma.courseLike.create({
      data: {
        courseId: course.id,
        userId: user.id,
      },
    });
  }

  const totalLikes = await prisma.courseLike.count({
    where: { courseId: course.id },
  });

  revalidatePath(`/courses/${course.slug}`);
  revalidatePath("/dashboard");
  revalidatePath("/admin/analytics");

  return NextResponse.json({
    liked: !existingLike,
    totalLikes,
  });
}
