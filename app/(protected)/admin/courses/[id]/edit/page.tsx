import { CourseStatus } from "@prisma/client";
import { notFound } from "next/navigation";

import { CourseStatusBadge } from "@/components/courses/course-status-badge";
import { DeleteCourseButton } from "@/components/dashboard/delete-course-button";
import { CourseForm } from "@/components/dashboard/course-form";
import { PublishCourseButton } from "@/components/dashboard/publish-course-button";
import { requireAdminPage } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getServerLanguage } from "@/lib/server-preferences";
import { getMessages } from "@/lib/ui-settings";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCoursePage({ params }: PageProps) {
  const language = await getServerLanguage();
  const messages = getMessages(language);
  await requireAdminPage();
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
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[36px] border border-white/60 bg-white/90 p-6 shadow-[0_28px_100px_-50px_rgba(15,23,42,0.4)] sm:p-8 lg:flex-row lg:items-end lg:justify-between dark:border-white/10 dark:bg-[#14263a]/88">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <CourseStatusBadge status={course.status} labels={messages.common} />
            {course.isFeatured ? (
              <span className="text-xs uppercase tracking-[0.22em] text-teal-700 dark:text-teal-200">
                {messages.common.featuredPrimary}
              </span>
            ) : null}
          </div>
          <h1 className="font-heading text-4xl text-zinc-950 dark:text-zinc-100">{course.title}</h1>
          <p className="max-w-3xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            {messages.publications.editDescription}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {course.status !== CourseStatus.PUBLISHED ? <PublishCourseButton courseId={course.id} /> : null}
          <DeleteCourseButton
            courseId={course.id}
            courseStatus={course.status}
            courseTitle={course.title}
          />
        </div>
      </section>

      <CourseForm
        key={course.id}
        mode="edit"
        course={{
          id: course.id,
          title: course.title,
          summary: course.summary,
          description: course.description,
          externalUrl: course.externalUrl,
          isFeatured: course.isFeatured,
          images: course.images,
        }}
      />
    </div>
  );
}
