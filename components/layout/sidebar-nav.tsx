"use client";

import { BarChart3, Bell, Compass, FilePlus2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useUiSettings } from "@/components/providers/ui-settings-provider";
import type { Messages } from "@/lib/ui-settings";
import { cn } from "@/lib/utils";

type SidebarNavProps = {
  isAdmin: boolean;
  isAuthenticated?: boolean;
};

type NavItem = {
  href: string;
  labelKey: keyof Messages["layout"];
  icon: typeof Compass;
};

const baseItems: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "navCourses",
    icon: Compass,
  },
  {
    href: "/notifications",
    labelKey: "navAlerts",
    icon: Bell,
  },
];

const adminItems: NavItem[] = [
  {
    href: "/admin/courses",
    labelKey: "navPublications",
    icon: FilePlus2,
  },
  {
    href: "/admin/analytics",
    labelKey: "navAnalytics",
    icon: BarChart3,
  },
];

export function SidebarNav({ isAdmin, isAuthenticated = true }: SidebarNavProps) {
  const pathname = usePathname();
  const { messages } = useUiSettings();
  const visibleBaseItems = isAuthenticated
    ? baseItems
    : baseItems.filter((item) => item.href === "/dashboard");
  const items = isAdmin ? [...visibleBaseItems, ...adminItems] : visibleBaseItems;

  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              active
                ? "border-[#f0d8b0] bg-[#f6ead6] !text-[#122033] shadow-lg shadow-black/15"
                : "border-white/12 bg-white/10 text-white/78 hover:border-white/18 hover:bg-white/16 hover:text-white",
            )}
            href={item.href}
          >
            <Icon className="h-4 w-4" />
            {messages.layout[item.labelKey]}
          </Link>
        );
      })}
    </nav>
  );
}
