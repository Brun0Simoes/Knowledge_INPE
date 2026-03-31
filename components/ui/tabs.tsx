"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex rounded-full border border-zinc-200 bg-white/90 p-1 text-zinc-600 shadow-sm dark:border-white/10 dark:bg-[#102132] dark:text-zinc-300",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900 data-[state=active]:bg-[#f4ead8] data-[state=active]:!text-[#122033] data-[state=active]:shadow-sm dark:text-zinc-300 dark:hover:text-zinc-100 dark:data-[state=active]:bg-[#20354b] dark:data-[state=active]:!text-[#f5f7fb]",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = TabsPrimitive.Content;
