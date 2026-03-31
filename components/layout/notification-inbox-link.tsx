"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { cn } from "@/lib/utils";

type NotificationInboxLinkProps = {
  unreadCount: number;
};

export function NotificationInboxLink({ unreadCount }: NotificationInboxLinkProps) {
  const pathname = usePathname();
  const { messages } = useUiSettings();
  const active = pathname === "/notifications" || pathname.startsWith("/notifications/");

  return (
    <Link
      className={cn(
        "relative inline-flex h-11 w-11 items-center justify-center rounded-full border transition",
        active
          ? "border-[#f0d8b0] bg-[#f6ead6] !text-[#122033] shadow-lg shadow-black/15"
          : "border-white/16 bg-white/10 text-white hover:border-white/24 hover:bg-white/14",
      )}
      href="/notifications"
      aria-label={`${messages.layout.notificationsAria}${unreadCount > 0 ? `, ${unreadCount}` : ""}`}
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#f97316] px-1.5 py-0.5 text-[10px] font-bold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
