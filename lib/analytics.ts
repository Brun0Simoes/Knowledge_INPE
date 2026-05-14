import { CourseEventType, CourseStatus, type CourseImage } from "@prisma/client";

import { average, getPrimaryCourseImage } from "@/lib/utils";

type AnalyticsCourse = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  status: CourseStatus;
  isFeatured: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  publishedAt: Date | null;
  images: CourseImage[];
  likes: Array<{ userId: string }>;
  reviews: Array<{ rating: number }>;
  comments: Array<{ id: string }>;
  events: Array<{ type: CourseEventType; createdAt: Date }>;
};

export function summarizeCourse(course: AnalyticsCourse) {
  // Aggregate event counters in one pass so analytics pages stay cheap even when
  // the interaction history grows.
  let views = 0;
  let clicks = 0;

  for (const event of course.events) {
    if (event.type === CourseEventType.VIEW) {
      views += 1;
    } else if (event.type === CourseEventType.CLICK_EXTERNAL) {
      clicks += 1;
    }
  }

  const likes = course.likes.length;
  const comments = course.comments.length;
  const averageRating = average(course.reviews.map((review) => review.rating));
  const ctr = views === 0 ? 0 : clicks / views;
  const impactScore =
    views * 0.3 + clicks * 0.5 + likes * 2 + comments * 2.5 + averageRating * 8;

  return {
    ...course,
    primaryImage: getPrimaryCourseImage(course.images),
    metrics: {
      views,
      clicks,
      likes,
      comments,
      averageRating,
      ctr,
      impactScore,
      reviews: course.reviews.length,
    },
  };
}

export function summarizeCatalog(courses: AnalyticsCourse[]) {
  const summarized = courses.map(summarizeCourse);
  const views = summarized.reduce((sum, course) => sum + course.metrics.views, 0);
  const clicks = summarized.reduce((sum, course) => sum + course.metrics.clicks, 0);
  const likes = summarized.reduce((sum, course) => sum + course.metrics.likes, 0);
  const comments = summarized.reduce((sum, course) => sum + course.metrics.comments, 0);
  const ratings = summarized.flatMap((course) => course.reviews.map((review) => review.rating));

  return {
    courses: summarized.sort(
      (left, right) => right.metrics.impactScore - left.metrics.impactScore,
    ),
    totals: {
      views,
      clicks,
      likes,
      comments,
      averageRating: average(ratings),
      ctr: views === 0 ? 0 : clicks / views,
      published: summarized.filter((course) => course.status === CourseStatus.PUBLISHED).length,
      drafts: summarized.filter((course) => course.status === CourseStatus.DRAFT).length,
    },
  };
}
