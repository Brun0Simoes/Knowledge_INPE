"use client";

import { BellRing, CheckCheck, ExternalLink } from "lucide-react";
import Link from "next/link";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatRelativeDate } from "@/lib/utils";

export type NotificationFeedItem = {
  id: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  readAt: string | null;
};

type NotificationFeedProps = {
  items: NotificationFeedItem[];
  compact?: boolean;
  showMarkAll?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function NotificationFeed({
  items,
  compact = false,
  showMarkAll = false,
  emptyTitle,
  emptyDescription,
}: NotificationFeedProps) {
  const router = useRouter();
  const { language, messages, theme } = useUiSettings();
  const dark = theme === "dark";
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [markAllPending, setMarkAllPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unreadCount = items.filter((item) => !item.readAt).length;
  const resolvedEmptyTitle = emptyTitle ?? messages.notifications.emptyTitle;
  const resolvedEmptyDescription = emptyDescription ?? messages.notifications.emptyDescription;

  async function updateReadState(id: string, read: boolean) {
    setPendingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ read }),
      });

      if (response.ok) {
        startTransition(() => {
          router.refresh();
        });
      } else {
        setError("Nao foi possivel atualizar a notificacao.");
      }
    } catch {
      setError("Nao foi possivel atualizar a notificacao.");
    }

    setPendingId(null);
  }

  async function markAllRead() {
    setMarkAllPending(true);
    setError(null);

    try {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      });

      if (response.ok) {
        startTransition(() => {
          router.refresh();
        });
      } else {
        setError("Nao foi possivel marcar todas como lidas.");
      }
    } catch {
      setError("Nao foi possivel marcar todas como lidas.");
    }

    setMarkAllPending(false);
  }

  if (items.length === 0) {
    return (
      <Card className="border-dashed border-zinc-200/80 bg-white/80 dark:border-white/10 dark:bg-[#13263a]">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <BellRing className="h-5 w-5 text-teal-700 dark:text-teal-200" />
          <div className="space-y-2">
            <p className="font-heading text-2xl text-zinc-950 dark:text-zinc-100">{resolvedEmptyTitle}</p>
            <p className="max-w-xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              {resolvedEmptyDescription}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {showMarkAll && unreadCount > 0 ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={markAllPending}
            onClick={markAllRead}
          >
            <CheckCheck className="h-4 w-4" />
            {messages.notifications.markAllRead}
          </Button>
        </div>
      ) : null}

      <div className={cn("grid gap-4", compact ? "lg:grid-cols-1" : "lg:grid-cols-2")}>
        {items.map((item) => {
          const isRead = Boolean(item.readAt);
          const disabled = pendingId === item.id || markAllPending;

          return (
            <Card
              key={item.id}
              className={cn(
                "border-zinc-200/80 transition",
                isRead
                  ? dark
                    ? "border-white/10 bg-[#13263a]"
                    : "bg-white/80"
                  : dark
                    ? "border-teal-400/20 bg-[#102935] shadow-[0_26px_70px_-46px_rgba(13,148,136,0.2)]"
                    : "border-teal-100 bg-[#eefaf7] shadow-[0_26px_70px_-46px_rgba(13,148,136,0.45)]",
              )}
            >
              <CardContent className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {!isRead ? (
                        <span className="rounded-full bg-teal-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white">
                          {messages.notifications.newLabel}
                        </span>
                      ) : null}
                      <span className="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                        {formatRelativeDate(new Date(item.createdAt), language)}
                      </span>
                    </div>
                    <h3 className="font-heading text-2xl text-zinc-950 dark:text-zinc-100">{item.title}</h3>
                    <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">{item.body}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button asChild size="sm">
                    <Link href={item.href}>
                      {messages.common.open}
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => updateReadState(item.id, !isRead)}
                  >
                    {isRead ? messages.notifications.markUnread : messages.notifications.markRead}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
