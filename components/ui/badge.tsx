import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
  {
    variants: {
      variant: {
        default: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
        muted: "bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200",
        success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
        warning: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
        accent: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
