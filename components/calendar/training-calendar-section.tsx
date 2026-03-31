import { TrainingCalendarPanel } from "@/components/calendar/training-calendar-panel";
import type { Language } from "@/lib/ui-settings";

type TrainingCalendarSectionProps = {
  language: Language;
  className?: string;
  allowExport?: boolean;
};

export function TrainingCalendarSection({
  language,
  className,
  allowExport = false,
}: TrainingCalendarSectionProps) {
  return (
    <TrainingCalendarPanel
      allowExport={allowExport}
      className={className}
      language={language}
    />
  );
}
