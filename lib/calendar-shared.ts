export type CalendarSourceFilter = "ALL" | "EUMETSAT" | "INPE" | "PLATFORM";
export type CalendarFormatFilter = "ALL" | "ONLINE" | "ONSITE";
export const CALENDAR_TIME_ZONE = "America/Sao_Paulo";

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

const calendarDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CALENDAR_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getCalendarMonthKey(date: Date) {
  return getCalendarDayKey(date).slice(0, 7);
}

export function getCalendarDayKey(date: Date) {
  const parts = calendarDayFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function normalizeCalendarMonthKey(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

export function getCalendarEventStartDayKey(event: CalendarEvent) {
  return getCalendarDayKey(new Date(event.startDate));
}

export function getCalendarEventEndDayKey(event: CalendarEvent) {
  return getCalendarDayKey(new Date(event.endDate));
}

function getCalendarMonthEndDayKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return `${monthKey}-${String(endDay).padStart(2, "0")}`;
}

function addCalendarDays(dayKey: string, amount: number) {
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);

  return getCalendarDayKey(date);
}

export function isCalendarEventActiveOnDay(event: CalendarEvent, dayKey: string) {
  return getCalendarEventStartDayKey(event) <= dayKey && dayKey <= getCalendarEventEndDayKey(event);
}

export function isCalendarEventActiveInMonth(event: CalendarEvent, monthKey: string) {
  const monthStartDayKey = `${monthKey}-01`;
  const monthEndDayKey = getCalendarMonthEndDayKey(monthKey);

  return getCalendarEventStartDayKey(event) <= monthEndDayKey && getCalendarEventEndDayKey(event) >= monthStartDayKey;
}

export function getCalendarEventDayKeys(event: CalendarEvent) {
  const keys: string[] = [];
  const endDayKey = getCalendarEventEndDayKey(event);
  let cursorDayKey = getCalendarEventStartDayKey(event);
  let guard = 0;

  while (cursorDayKey <= endDayKey && guard < 3700) {
    keys.push(cursorDayKey);
    cursorDayKey = addCalendarDays(cursorDayKey, 1);
    guard += 1;
  }

  return keys;
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

    if (monthKey && !isCalendarEventActiveInMonth(event, monthKey)) {
      return false;
    }

    return true;
  });
}
