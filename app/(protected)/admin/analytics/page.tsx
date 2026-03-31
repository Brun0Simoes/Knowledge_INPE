import { Eye, Heart, MessageSquareText, MousePointerClick, Star, Target } from "lucide-react";

import { TrainingCalendarSection } from "@/components/calendar/training-calendar-section";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { summarizeCatalog } from "@/lib/analytics";
import { requireAdminPage } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getServerLanguage } from "@/lib/server-preferences";
import { getMessages } from "@/lib/ui-settings";
import { formatCompactNumber, formatPercent, formatRating } from "@/lib/utils";

export default async function AnalyticsPage() {
  const language = await getServerLanguage();
  const messages = getMessages(language);
  await requireAdminPage();

  const courses = await prisma.course.findMany({
    orderBy: [{ status: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
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

  const summary = summarizeCatalog(courses);
  const topImpact = summary.courses.slice(0, 5);
  const maxImpact = topImpact[0]?.metrics.impactScore || 1;

  return (
    <div className="space-y-8">
      <section className="paper-panel rounded-[36px] border border-zinc-200/70 p-6 shadow-[0_28px_100px_-50px_rgba(15,23,42,0.4)] sm:p-8">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
            {messages.analytics.label}
          </p>
          <h1 className="font-heading text-4xl text-zinc-950 dark:text-zinc-100">
            {messages.analytics.title}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            {messages.analytics.description}
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              helper={messages.analytics.viewsHelper}
              icon={Eye}
              label="Views"
              value={formatCompactNumber(summary.totals.views, language)}
            />
            <MetricCard
              helper={messages.analytics.clicksHelper}
              icon={MousePointerClick}
              label={messages.common.clicks}
              value={formatCompactNumber(summary.totals.clicks, language)}
            />
            <MetricCard
              helper={messages.analytics.ctrHelper}
              icon={Target}
              label="CTR medio"
              value={formatPercent(summary.totals.ctr, language)}
            />
            <MetricCard
              helper={messages.analytics.ratingHelper}
              icon={Star}
              label={messages.common.averageRating}
              value={formatRating(summary.totals.averageRating, language)}
            />
          </section>

          <Tabs className="space-y-6" defaultValue="impacto">
            <TabsList>
              <TabsTrigger value="impacto">{messages.analytics.impactTab}</TabsTrigger>
              <TabsTrigger value="conversao">{messages.analytics.conversionTab}</TabsTrigger>
              <TabsTrigger value="social">{messages.analytics.socialTab}</TabsTrigger>
            </TabsList>

            <TabsContent value="impacto">
              <Card>
                <CardHeader>
                  <CardTitle>{messages.analytics.rankingTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {topImpact.map((course) => (
                    <div key={course.id} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5 dark:border-white/10 dark:bg-[#102132]">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-2">
                          <p className="font-heading text-2xl text-zinc-950 dark:text-zinc-100">{course.title}</p>
                          <p className="text-sm text-zinc-600 dark:text-zinc-300">
                            {messages.analytics.scorePrefix} {course.metrics.impactScore.toFixed(1)} /{" "}
                            {formatCompactNumber(course.metrics.views, language)} {messages.common.views} /{" "}
                            {formatCompactNumber(course.metrics.clicks, language)} {messages.common.clicks}
                          </p>
                        </div>
                        <div className="w-full max-w-sm">
                          <Progress value={(course.metrics.impactScore / maxImpact) * 100} />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="conversao">
              <Card>
                <CardHeader>
                  <CardTitle>{messages.analytics.conversionTitle}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  {summary.courses.slice(0, 6).map((course) => (
                    <div key={course.id} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5 dark:border-white/10 dark:bg-[#102132]">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">{course.title}</p>
                      <div className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                        <p>Views: {formatCompactNumber(course.metrics.views, language)}</p>
                        <p>{messages.common.clicks}: {formatCompactNumber(course.metrics.clicks, language)}</p>
                        <p>{messages.analytics.ctrLabel}: {formatPercent(course.metrics.ctr, language)}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="social">
              <Card>
                <CardHeader>
                  <CardTitle>{messages.analytics.socialTitle}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <MetricCard
                    helper={messages.analytics.likesHelper}
                    icon={Heart}
                    label="Likes"
                    value={formatCompactNumber(summary.totals.likes, language)}
                  />
                  <MetricCard
                    helper={messages.analytics.commentsHelper}
                    icon={MessageSquareText}
                    label={messages.common.comments}
                    value={formatCompactNumber(summary.totals.comments, language)}
                  />
                  <MetricCard
                    helper={messages.analytics.averageHelper}
                    icon={Star}
                    label={messages.analytics.ratingHelper}
                    value={formatRating(summary.totals.averageRating, language)}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="xl:sticky xl:top-6">
          <TrainingCalendarSection allowExport language={language} />
        </aside>
      </div>
    </div>
  );
}
