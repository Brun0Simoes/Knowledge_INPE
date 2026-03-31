import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-28 w-full rounded-3xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 shadow-sm transition placeholder:text-zinc-400 focus:border-teal-400 focus:outline-none focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/12 dark:bg-[#102132] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-teal-500 dark:focus:ring-teal-950/60",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
