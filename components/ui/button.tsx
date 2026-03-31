"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "bg-teal-600 px-4 py-2.5 text-white hover:bg-teal-500 focus-visible:ring-teal-500",
        secondary:
          "bg-white/10 px-4 py-2.5 text-white hover:bg-white/15 focus-visible:ring-white",
        outline:
          "border border-zinc-200 bg-white px-4 py-2.5 text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50 focus-visible:ring-zinc-400 dark:border-white/12 dark:bg-[#122438] dark:text-zinc-100 dark:hover:border-white/20 dark:hover:bg-[#173149]",
        ghost:
          "px-3 py-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:ring-zinc-400 dark:text-zinc-300 dark:hover:bg-white/8 dark:hover:text-zinc-100",
        danger:
          "bg-rose-600 px-4 py-2.5 text-white hover:bg-rose-500 focus-visible:ring-rose-500",
      },
      size: {
        default: "h-11",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-5 text-base",
        icon: "h-11 w-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
