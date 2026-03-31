import { CourseStatus, type CourseEventType } from "@prisma/client";
import { Eye, FileText, MousePointerClick, PenSquare } from "lucide-react";
import Link from "next/link";

import { TrainingCalendarSection } from "@/components/calendar/training-calendar-section";
import { CourseStatusBadge } from "@/components/courses/course-status-badge";
import { DeleteCourseButton } from "@/components/dashboard/delete-course-button";
import { PublishCourseButton } from "@/components/dashboard/publish-course-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { summarizeCourse } from "@/lib/analytics";
import { requireAdminPage } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getServerLanguage } from "@/lib/server-preferences";
import { getMessages } from "@/lib/ui-settings";
import { formatCompactNumber, formatDate, formatRating } from "@/lib/utils";

export default async function AdminCoursesPage() {
  const language = await getServerLanguage();
  const messages = getMessages(language);
  await requireAdminPage();

  const courses = await prisma.course.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      images: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      likes: {
        select: { userId: true },
      },
      reviews: {
        select: { rating: true },
      },
      comments: {
        select: { id: true },
      },
      events: {
        select: {
          type: true,
          createdAt: true,
        },
      },
    },
  });

  const summarized = courses.map((course) =>
    summarizeCourse({
      ...course,
      events: course.events as Array<{ type: CourseEventType; createdAt: Date }>,
    }),
  );

  return (
    <div className="space-y-8">
      <section className="paper-panel flex flex-col gap-4 rounded-[36px] border border-zinc-200/70 p-6 shadow-[0_28px_100px_-50px_rgba(15,23,42,0.4)] sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
            {messages.publications.label}
          </p>
          <h1 className="font-heading text-4xl text-zinc-950 dark:text-zinc-100">
            {messages.publications.title}
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            {messages.publications.description}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/admin/courses/new">{messages.dashboard.newCourse}</Link>
        </Button>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="grid gap-5">
          {summarized.map((course) => (
            <Card key={course.id}>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <CourseStatusBadge status={course.status} labels={messages.common} />
                    {course.isFeatured ? (
                      <span className="text-xs uppercase tracking-[0.2em] text-teal-700 dark:text-teal-200">
                        {messages.common.featured}
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{course.title}</CardTitle>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                      {course.summary}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="outline">
                  <Link href={`/admin/courses/${course.id}/edit`}>
                    <PenSquare className="h-4 w-4" />
                    Editar
                  </Link>
                </Button>
                {course.status !== CourseStatus.PUBLISHED ? <PublishCourseButton courseId={course.id} /> : null}
                <DeleteCourseButton
                  courseId={course.id}
                  courseStatus={course.status}
                  courseTitle={course.title}
                />
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 pt-0 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-3xl bg-zinc-50 p-4 dark:bg-[#102132]">
                    <Eye className="h-4 w-4 text-teal-600 dark:text-teal-200" />
                    <p className="mt-3 font-heading text-3xl dark:text-zinc-100">
                      {formatCompactNumber(course.metrics.views, language)}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{messages.common.views}</p>
                  </div>
                  <div className="rounded-3xl bg-zinc-50 p-4 dark:bg-[#102132]">
                    <MousePointerClick className="h-4 w-4 text-teal-600 dark:text-teal-200" />
                    <p className="mt-3 font-heading text-3xl dark:text-zinc-100">
                      {formatCompactNumber(course.metrics.clicks, language)}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{messages.common.clicks}</p>
                  </div>
                  <div className="rounded-3xl bg-zinc-50 p-4 dark:bg-[#102132]">
                    <FileText className="h-4 w-4 text-teal-600 dark:text-teal-200" />
                    <p className="mt-3 font-heading text-3xl dark:text-zinc-100">
                      {formatCompactNumber(course.metrics.comments, language)}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{messages.common.comments}</p>
                  </div>
                </div>
                <div className="rounded-3xl bg-zinc-50 p-5 text-sm text-zinc-600 dark:bg-[#102132] dark:text-zinc-300">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">{messages.publications.summary}</p>
                  <div className="mt-4 space-y-2">
                    <p>
                      {messages.common.averageRating}: {formatRating(course.metrics.averageRating, language)}
                    </p>
                    <p>{messages.common.likes}: {formatCompactNumber(course.metrics.likes, language)}</p>
                    <p>
                      {messages.common.published}:{" "}
                      {course.publishedAt ? formatDate(course.publishedAt, language) : messages.common.waitingRelease}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <aside className="xl:sticky xl:top-6">
          <TrainingCalendarSection allowExport language={language} />
        </aside>
      </div>
    </div>
  );
}
