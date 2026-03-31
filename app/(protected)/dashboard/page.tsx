import { CourseStatus } from "@prisma/client";
import { Heart, Sparkles, Star } from "lucide-react";
import Link from "next/link";

import { TrainingCalendarSection } from "@/components/calendar/training-calendar-section";
import { CourseCard } from "@/components/courses/course-card";
import { NotificationToggle } from "@/components/dashboard/notification-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { summarizeCatalog, summarizeCourse } from "@/lib/analytics";
import { requirePageUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getServerLanguage } from "@/lib/server-preferences";
import { getMessages } from "@/lib/ui-settings";
import { formatCompactNumber, formatRating } from "@/lib/utils";

export default async function DashboardPage() {
  const language = await getServerLanguage();
  const messages = getMessages(language);
  const user = await requirePageUser();
  const [dbUser, courses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { notificationOptIn: true },
    }),
    prisma.course.findMany({
      where: {
        status: CourseStatus.PUBLISHED,
      },
      orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
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
          select: { type: true, createdAt: true },
        },
      },
    }),
  ]);

  const summary = summarizeCatalog(courses);
  const featuredCourse = courses.find((course) => course.isFeatured);
  const featured = featuredCourse ? summarizeCourse(featuredCourse) : (summary.courses[0] ?? null);
  const gridCourses = featured
    ? summary.courses.filter((course) => course.id !== featured.id)
    : summary.courses;

  return (
    <div className="space-y-8">
      <section
        className="grain-overlay relative overflow-hidden rounded-[40px] bg-[#13253a] px-6 py-8 text-white shadow-[0_44px_120px_-52px_rgba(15,23,42,0.7)] sm:px-8 sm:py-10"
        style={{ backgroundImage: "linear-gradient(135deg, #13253a 0%, #1d4058 55%, #c66b2f 100%)" }}
      >
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.18fr_0.82fr] lg:items-end">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.38em] text-white/64">
                knowledge
              </p>
              <h1 className="font-heading text-4xl leading-[0.95] sm:text-6xl">
                {messages.dashboard.heroTitle}
              </h1>
              <p className="max-w-2xl text-base leading-8 text-white/78 sm:text-lg">
                {messages.dashboard.heroDescription}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <NotificationToggle initialValue={dbUser?.notificationOptIn ?? false} />
              {user.role === "ADMIN" ? (
                <Button asChild variant="secondary">
                  <Link href="/admin/courses/new">{messages.dashboard.newCourse}</Link>
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.24em] text-white/62">
              <span className="rounded-full border border-white/12 bg-white/8 px-3 py-2">
                Observacao da Terra
              </span>
              <span className="rounded-full border border-white/12 bg-white/8 px-3 py-2">
                Modelagem climatica
              </span>
              <span className="rounded-full border border-white/12 bg-white/8 px-3 py-2">
                Tempo espacial
              </span>
              <span className="rounded-full border border-white/12 bg-white/8 px-3 py-2">
                Satelites operacionais
              </span>
            </div>
          </div>

          {featured ? (
            <Card className="border-white/12 bg-white/10 text-white shadow-none backdrop-blur">
              <CardContent className="space-y-5 p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                  {messages.dashboard.spotlightNow}
                </p>
                <div className="space-y-3">
                  <h2 className="font-heading text-3xl">{featured.title}</h2>
                  <p className="max-w-2xl text-sm leading-7 text-white/74">{featured.summary}</p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-white/72">
                  <span>{formatCompactNumber(featured.metrics.likes, language)} {messages.common.likes}</span>
                  <span>{formatCompactNumber(featured.metrics.comments, language)} {messages.common.comments}</span>
                  <span>{formatRating(featured.metrics.averageRating, language)} {messages.common.averageRating}</span>
                </div>
                <Button asChild size="lg">
                  <Link href={`/courses/${featured.slug}`}>{messages.dashboard.readCoursePage}</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <section className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                {messages.dashboard.liveNow}
              </p>
              <h2 className="font-heading text-3xl text-zinc-950 dark:text-zinc-100">
                {messages.dashboard.publishedCourses}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-sm dark:bg-[#112437]">
                <Sparkles className="h-4 w-4 text-teal-700 dark:text-teal-200" />
                {summary.totals.published} {messages.common.coursesAvailable}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-sm dark:bg-[#112437]">
                <Heart className="h-4 w-4 text-teal-700 dark:text-teal-200" />
                {formatCompactNumber(summary.totals.likes, language)} {messages.common.reactionsRegistered}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-sm dark:bg-[#112437]">
                <Star className="h-4 w-4 text-teal-700 dark:text-teal-200" />
                {formatRating(summary.totals.averageRating, language)} {messages.common.averageOverall}
              </span>
            </div>
          </div>

          {summary.courses.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="font-heading text-2xl text-zinc-950 dark:text-zinc-100">
                  {messages.dashboard.noPublishedTitle}
                </p>
                <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  {messages.dashboard.noPublishedDescription}
                </p>
              </CardContent>
            </Card>
          ) : gridCourses.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="font-heading text-2xl text-zinc-950 dark:text-zinc-100">
                  {messages.dashboard.onlyFeaturedTitle}
                </p>
                <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  {messages.dashboard.onlyFeaturedDescription}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {gridCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={{
                    slug: course.slug,
                    title: course.title,
                    summary: course.summary,
                    primaryImage: course.primaryImage,
                    metrics: {
                      likes: course.metrics.likes,
                      comments: course.metrics.comments,
                      averageRating: course.metrics.averageRating,
                    },
                  }}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="xl:sticky xl:top-6">
          <TrainingCalendarSection language={language} />
        </aside>
      </div>
    </div>
  );
}
