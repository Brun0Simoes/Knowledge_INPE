import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type MetricCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
};

export function MetricCard({ label, value, helper, icon: Icon }: MetricCardProps) {
  return (
    <Card className="paper-panel h-full border-zinc-200/80">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{label}</p>
          <div className="rounded-full bg-teal-50 p-2 dark:bg-teal-500/15">
            <Icon className="h-4 w-4 text-teal-700 dark:text-teal-200" />
          </div>
        </div>
        <div>
          <p className="font-heading text-3xl text-zinc-950 dark:text-zinc-100">{value}</p>
          {helper ? <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{helper}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
