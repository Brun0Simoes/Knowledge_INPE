"use client";

import { Heart, MessageSquareText, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCompactNumber, formatRating } from "@/lib/utils";

type CourseCardProps = {
  course: {
    slug: string;
    title: string;
    summary: string;
    primaryImage: string;
    statusLabel?: string;
    metrics: {
      likes: number;
      comments: number;
      averageRating: number;
    };
  };
};

export function CourseCard({ course }: CourseCardProps) {
  const { language, messages } = useUiSettings();

  return (
    <Link href={`/courses/${course.slug}`}>
      <Card className="group paper-panel overflow-hidden border-zinc-200/80 transition duration-300 hover:-translate-y-1 hover:shadow-[0_32px_90px_-40px_rgba(15,23,42,0.3)] dark:border-white/10 dark:shadow-[0_32px_90px_-40px_rgba(2,8,23,0.65)]">
        <div className="relative aspect-[16/10] overflow-hidden">
          <Image
            alt={course.title}
            className="object-cover transition duration-500 group-hover:scale-105"
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            src={course.primaryImage}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#13253a]/82 via-[#13253a]/18 to-transparent" />
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            <Badge variant="default" className="bg-[#13253a]/86 text-white">
              {messages.common.course}
            </Badge>
            {course.statusLabel ? <Badge variant="accent">{course.statusLabel}</Badge> : null}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <p className="text-xs uppercase tracking-[0.24em] text-white/64">
              {messages.common.readAndAdvance}
            </p>
            <h3 className="mt-2 font-heading text-2xl leading-tight">{course.title}</h3>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <p className="line-clamp-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            {course.summary}
          </p>

          <div className="flex flex-wrap gap-3 text-sm text-zinc-600 dark:text-zinc-300">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm dark:bg-[#112437]">
              <Heart className="h-4 w-4 text-teal-700 dark:text-teal-200" />
              {formatCompactNumber(course.metrics.likes, language)} {messages.common.likes}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm dark:bg-[#112437]">
              <MessageSquareText className="h-4 w-4 text-teal-700 dark:text-teal-200" />
              {formatCompactNumber(course.metrics.comments, language)} {messages.common.comments}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm dark:bg-[#112437]">
              <Star className="h-4 w-4 text-teal-700 dark:text-teal-200" />
              {formatRating(course.metrics.averageRating, language)} {messages.common.ratingSuffix}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
