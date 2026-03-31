"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuContent = ({
  className,
  sideOffset = 8,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-56 rounded-3xl border border-zinc-200 bg-white p-2 text-zinc-950 shadow-2xl outline-none dark:border-white/10 dark:bg-[#102132] dark:text-zinc-100",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
);
export const DropdownMenuLabel = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>) => (
  <DropdownMenuPrimitive.Label
    className={cn("px-3 py-2 text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400", className)}
    {...props}
  />
);
export const DropdownMenuItem = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>) => (
  <DropdownMenuPrimitive.Item
    className={cn(
      "flex cursor-pointer select-none items-center rounded-2xl px-3 py-2 text-sm outline-none transition hover:bg-zinc-100 focus:bg-zinc-100 dark:hover:bg-white/8 dark:focus:bg-white/8",
      className,
    )}
    {...props}
  />
);
export const DropdownMenuSeparator = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>) => (
  <DropdownMenuPrimitive.Separator className={cn("my-2 h-px bg-zinc-200 dark:bg-white/10", className)} {...props} />
);
