import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

type RatingStarsProps = {
  value: number;
  className?: string;
};

export function RatingStars({ value, className }: RatingStarsProps) {
  const filled = Math.round(value);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(
            "h-4 w-4",
            index < filled ? "fill-amber-400 text-amber-400" : "text-zinc-300",
          )}
        />
      ))}
    </div>
  );
}
