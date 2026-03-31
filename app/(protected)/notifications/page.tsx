import { BellRing } from "lucide-react";

import { NotificationFeed, type NotificationFeedItem } from "@/components/notifications/notification-feed";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getServerLanguage } from "@/lib/server-preferences";
import { getMessages } from "@/lib/ui-settings";

export default async function NotificationsPage() {
  const language = await getServerLanguage();
  const messages = getMessages(language);
  const user = await requirePageUser();

  const [unreadCount, notifications] = await Promise.all([
    prisma.userNotification.count({
      where: {
        userId: user.id,
        readAt: null,
      },
    }),
    prisma.userNotification.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 40,
      include: {
        notification: {
          select: {
            title: true,
            body: true,
            href: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const items: NotificationFeedItem[] = notifications.map((item) => ({
    id: item.id,
    title: item.notification.title,
    body: item.notification.body,
    href: item.notification.href,
    createdAt: item.notification.createdAt.toISOString(),
    readAt: item.readAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="paper-panel border-zinc-200/70">
          <CardContent className="space-y-4 p-6 sm:p-8">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#e7f7f3] text-teal-700 dark:bg-teal-500/15 dark:text-teal-200">
              <BellRing className="h-5 w-5" />
            </div>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                {messages.notifications.label}
              </p>
              <h1 className="font-heading text-4xl text-zinc-950 dark:text-zinc-100">
                {messages.notifications.title}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                {messages.notifications.description}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="paper-panel border-zinc-200/70">
          <CardContent className="grid gap-4 p-6 sm:p-8">
            <div className="rounded-[28px] border border-zinc-200/70 bg-white/90 p-5 dark:border-white/10 dark:bg-[#102132]">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                {messages.notifications.unread}
              </p>
              <p className="mt-2 font-heading text-4xl text-zinc-950 dark:text-zinc-100">{unreadCount}</p>
              <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                {messages.notifications.unreadDescription}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <NotificationFeed items={items} showMarkAll />
    </div>
  );
}
