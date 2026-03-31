export type CalendarSourceFilter = "ALL" | "EUMETSAT" | "INPE" | "PLATFORM";
export type CalendarFormatFilter = "ALL" | "ONLINE" | "ONSITE";

export type CalendarEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  format: string;
  eventType: string;
  status: string | null;
  attendance: string | null;
  city: string | null;
  host: string | null;
  url: string | null;
  description: string | null;
  languages: string[];
  sourceName: string;
  sourceFilters: CalendarSourceFilter[];
};

type CalendarEventFilters = {
  sourceFilter?: CalendarSourceFilter;
  formatFilter?: CalendarFormatFilter;
  monthKey?: string | null;
};

export function getCalendarMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function normalizeCalendarMonthKey(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

export function filterCalendarEvents(events: CalendarEvent[], filters: CalendarEventFilters = {}) {
  const monthKey = normalizeCalendarMonthKey(filters.monthKey);
  const sourceFilter = filters.sourceFilter ?? "ALL";
  const formatFilter = filters.formatFilter ?? "ALL";

  return events.filter((event) => {
    if (sourceFilter !== "ALL" && !event.sourceFilters.includes(sourceFilter)) {
      return false;
    }

    if (formatFilter === "ONLINE" && event.format !== "ONLINE") {
      return false;
    }

    if (formatFilter === "ONSITE" && event.format === "ONLINE") {
      return false;
    }

    if (monthKey && getCalendarMonthKey(new Date(event.startDate)) !== monthKey) {
      return false;
    }

    return true;
  });
}
