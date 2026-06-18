import { CourseStatus } from "@prisma/client";
import { CalendarDays, Heart, MessageSquareText, Star } from "lucide-react";
import { notFound } from "next/navigation";

import { CourseCard } from "@/components/courses/course-card";
import { CourseEngagementPanel } from "@/components/courses/course-engagement-panel";
import { CourseImage } from "@/components/courses/course-image";
import { CourseVisitButton } from "@/components/courses/course-visit-button";
import { RatingStars } from "@/components/courses/rating-stars";
import { RecordCourseView } from "@/components/courses/record-course-view";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { summarizeCatalog, summarizeCourse } from "@/lib/analytics";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerLanguage } from "@/lib/server-preferences";
import { getMessages } from "@/lib/ui-settings";
import { formatCompactNumber, formatDate, formatDateTimeRange, formatRating, formatRelativeDate } from "@/lib/utils";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CourseDetailPage({ params }: PageProps) {
  const language = await getServerLanguage();
  const messages = getMessages(language);
  const session = await getServerAuthSession();
  const user = session?.user ?? null;
  const { slug } = await params;

  const course = await prisma.course.findFirst({
    where: {
      slug,
      ...(user?.role === "ADMIN" ? {} : { status: CourseStatus.PUBLISHED }),
    },
    include: {
      author: {
        select: { name: true, image: true },
      },
      images: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      likes: {
        select: { userId: true },
      },
      reviews: {
        select: {
          rating: true,
          body: true,
          userId: true,
        },
      },
      comments: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          user: {
            select: {
              name: true,
              image: true,
            },
          },
        },
      },
      events: {
        select: {
          type: true,
          createdAt: true,
        },
      },
    },
  });

  if (!course) {
    notFound();
  }

  const relatedCourses = await prisma.course.findMany({
    where: {
      status: CourseStatus.PUBLISHED,
      id: { not: course.id },
    },
    take: 3,
    orderBy: {
      publishedAt: "desc",
    },
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
  });

  const summary = summarizeCourse(course);
  const relatedSummary = summarizeCatalog(relatedCourses);
  const initialReview = user?.id
    ? (course.reviews.find((review) => review.userId === user.id) ?? null)
    : null;
  const initialLiked = user?.id ? course.likes.some((like) => like.userId === user.id) : false;
  const scheduleLabel = course.startsAt
    ? formatDateTimeRange(course.startsAt, course.endsAt, language)
    : course.publishedAt
      ? formatDate(course.publishedAt, language)
      : messages.common.prepare;
  const scheduleTitle = course.startsAt ? messages.course.courseDate : messages.common.published;

  return (
    <div className="space-y-8">
      <RecordCourseView courseId={course.id} enabled={Boolean(user?.id)} />

      <section className="overflow-hidden rounded-[36px] border border-white/60 bg-white/90 shadow-[0_32px_120px_-52px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#14263a]/88">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative min-h-[320px]">
            <CourseImage
              alt={course.title}
              className="object-cover"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              src={summary.primaryImage}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1d2d]/82 via-[#0f1d2d]/28 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
              <Badge variant="accent">
                {course.status === CourseStatus.PUBLISHED ? messages.common.availableNow : messages.common.inDraft}
              </Badge>
              <h1 className="mt-4 font-heading text-4xl leading-tight sm:text-5xl">{course.title}</h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-white/78">{course.summary}</p>
            </div>
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-3xl bg-zinc-50 p-4 dark:bg-[#102132]">
                <Heart className="h-4 w-4 text-teal-700 dark:text-teal-200" />
                <p className="mt-3 font-heading text-3xl dark:text-zinc-100">
                  {formatCompactNumber(summary.metrics.likes, language)}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{messages.common.likes}</p>
              </div>
              <div className="rounded-3xl bg-zinc-50 p-4 dark:bg-[#102132]">
                <Star className="h-4 w-4 text-teal-700 dark:text-teal-200" />
                <p className="mt-3 font-heading text-3xl dark:text-zinc-100">
                  {formatRating(summary.metrics.averageRating, language)}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{messages.common.averageRating}</p>
              </div>
              <div className="rounded-3xl bg-zinc-50 p-4 dark:bg-[#102132]">
                <MessageSquareText className="h-4 w-4 text-teal-700 dark:text-teal-200" />
                <p className="mt-3 font-heading text-3xl dark:text-zinc-100">
                  {formatCompactNumber(summary.metrics.comments, language)}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{messages.common.comments}</p>
              </div>
              <div className="rounded-3xl bg-zinc-50 p-4 dark:bg-[#102132]">
                <CalendarDays className="h-4 w-4 text-teal-700 dark:text-teal-200" />
                <p className="mt-3 font-heading text-base leading-7 dark:text-zinc-100">
                  {scheduleLabel}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{scheduleTitle}</p>
              </div>
            </div>

            <div className="rounded-[32px] border border-zinc-200 bg-zinc-50 p-5 dark:border-white/10 dark:bg-[#102132]">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {course.author.image ? <AvatarImage alt={course.author.name} src={course.author.image} /> : null}
                  <AvatarFallback>{course.author.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">{course.author.name}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{messages.course.curatorLabel}</p>
                </div>
              </div>
              <div className="mt-5 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-teal-700 dark:text-teal-200" />
                  {course.startsAt ? messages.course.courseDate : messages.course.publishedIn}{" "}
                  {course.startsAt
                    ? formatDateTimeRange(course.startsAt, course.endsAt, language)
                    : course.publishedAt
                      ? formatDate(course.publishedAt, language)
                      : messages.common.draft}
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-teal-700 dark:text-teal-200" />
                  <RatingStars value={summary.metrics.averageRating} />
                  <span>
                    {formatRating(summary.metrics.averageRating, language)} {messages.course.communityAverage}
                  </span>
                </div>
              </div>
            </div>

            <CourseVisitButton
              canTrack={Boolean(user?.id)}
              courseId={course.id}
              courseUrl={course.externalUrl}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                {messages.course.aboutCourse}
              </p>
              <div className="prose-copy mt-4 text-base leading-8 text-zinc-700 dark:text-zinc-200">
                {course.description.split("\n\n").map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>

            {course.reviews.length ? (
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                  {messages.course.recentReviews}
                </p>
                <div className="grid gap-4">
                  {course.reviews
                    .filter((review) => review.body)
                    .slice(0, 3)
                    .map((review, index) => (
                      <div key={index} className="rounded-3xl bg-zinc-50 p-4 dark:bg-[#102132]">
                        <RatingStars value={review.rating} />
                        <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">{review.body}</p>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <CourseEngagementPanel
          courseId={course.id}
          initialLiked={initialLiked}
          initialLikes={summary.metrics.likes}
          initialReview={initialReview}
          isAuthenticated={Boolean(user?.id)}
        />
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardContent className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                  {messages.course.community}
                </p>
                <h2 className="font-heading text-3xl dark:text-zinc-100">
                  {messages.course.readingsAndComments}
                </h2>
              </div>
              <Badge variant="muted">
                {course.comments.length} {messages.common.records}
              </Badge>
            </div>

            <div className="space-y-4">
              {course.comments.length ? (
                course.comments.map((comment) => (
                  <div key={comment.id} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-[#102132]">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {comment.user.image ? <AvatarImage alt={comment.user.name} src={comment.user.image} /> : null}
                        <AvatarFallback>{comment.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">{comment.user.name}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatRelativeDate(comment.createdAt, language)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-zinc-600 dark:text-zinc-300">{comment.body}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-zinc-200 p-6 text-sm leading-7 text-zinc-600 dark:border-white/10 dark:text-zinc-300">
                  {messages.course.noComments}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5 p-6 sm:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                {messages.course.continueReading}
              </p>
              <h2 className="font-heading text-3xl dark:text-zinc-100">{messages.course.moreCourses}</h2>
            </div>
            <div className="grid gap-5">
              {relatedSummary.courses.length ? (
                relatedSummary.courses.map((relatedCourse) => (
                  <CourseCard
                    key={relatedCourse.id}
                    course={{
                      slug: relatedCourse.slug,
                      title: relatedCourse.title,
                      summary: relatedCourse.summary,
                      primaryImage: relatedCourse.primaryImage,
                      metrics: {
                        likes: relatedCourse.metrics.likes,
                        comments: relatedCourse.metrics.comments,
                        averageRating: relatedCourse.metrics.averageRating,
                      },
                    }}
                  />
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-zinc-200 p-6 text-sm leading-7 text-zinc-600 dark:border-white/10 dark:text-zinc-300">
                  {messages.course.noRelatedCourses}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
