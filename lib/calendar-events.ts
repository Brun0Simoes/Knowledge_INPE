import "server-only";

import { CourseStatus } from "@prisma/client";

import {
  type CalendarEvent,
  type CalendarSourceFilter,
} from "@/lib/calendar-shared";
import { getPublicTrainingEvents } from "@/lib/eumetsat-events";
import { prisma } from "@/lib/prisma";

const CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000;

type CalendarCacheState = {
  events: CalendarEvent[] | null;
  updatedAt: number;
  refreshPromise: Promise<CalendarEvent[]> | null;
};

const globalForCalendar = globalThis as typeof globalThis & {
  __knowledgeCalendarCache?: CalendarCacheState;
};

function isInpeSignature(value: string) {
  return /(?:\bINPE\b|\bCPTEC\b|moodle\.cptec\.inpe)/i.test(value);
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function formatIcsDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function foldIcsLine(line: string) {
  if (line.length <= 73) {
    return line;
  }

  const chunks: string[] = [];

  for (let index = 0; index < line.length; index += 73) {
    const chunk = line.slice(index, index + 73);
    chunks.push(index === 0 ? chunk : ` ${chunk}`);
  }

  return chunks.join("\r\n");
}

function buildExternalEventSearchText(event: Awaited<ReturnType<typeof getPublicTrainingEvents>>[number]) {
  return [event.title, event.host, event.city, event.contactUrl, event.registrationUrl, event.eventType]
    .filter(Boolean)
    .join(" ");
}

async function getPlatformCalendarEvents(): Promise<CalendarEvent[]> {
  // Published courses are projected into calendar events so the same panel can
  // blend external training dates with internal course releases.
  const courses = await prisma.course.findMany({
    where: {
      status: CourseStatus.PUBLISHED,
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      externalUrl: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  return courses.map((course) => {
    const startAt = course.publishedAt ?? course.createdAt;
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

    return {
      id: `platform-${course.id}`,
      title: course.title,
      startDate: startAt.toISOString(),
      endDate: endAt.toISOString(),
      format: "ONLINE",
      eventType: "Course release",
      status: "Published",
      attendance: "Open",
      city: "Online",
      host: "INPE / knowledge",
      url: `/courses/${course.slug}`,
      description: course.summary,
      languages: ["Portuguese"],
      sourceName: "knowledge",
      sourceFilters: ["PLATFORM", "INPE"],
    } satisfies CalendarEvent;
  });
}

async function getExternalCalendarEvents(): Promise<CalendarEvent[]> {
  const externalEvents = await getPublicTrainingEvents();

  return externalEvents.map((event) => {
    const searchText = buildExternalEventSearchText(event);
    const sourceFilters: CalendarSourceFilter[] = ["EUMETSAT"];

    if (isInpeSignature(searchText)) {
      sourceFilters.push("INPE");
    }

    return {
      id: `external-${event.id}`,
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      format: event.format,
      eventType: event.eventType,
      status: event.status,
      attendance: event.attendance,
      city: event.city,
      host: event.host,
      url: event.registrationUrl ?? event.contactUrl,
      description: null,
      languages: event.languages,
      sourceName: "EUMETSAT",
      sourceFilters,
    } satisfies CalendarEvent;
  });
}

function getCalendarCache() {
  if (!globalForCalendar.__knowledgeCalendarCache) {
    globalForCalendar.__knowledgeCalendarCache = {
      events: null,
      updatedAt: 0,
      refreshPromise: null,
    };
  }

  return globalForCalendar.__knowledgeCalendarCache;
}

async function loadCalendarEventsFresh() {
  // External feed failures should not hide platform releases, so the external
  // branch degrades to an empty list instead of failing the whole payload.
  const [platformEvents, externalEvents] = await Promise.all([
    getPlatformCalendarEvents(),
    getExternalCalendarEvents().catch(() => []),
  ]);

  return [...platformEvents, ...externalEvents].sort(
    (left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime(),
  );
}

async function refreshCalendarCache() {
  const cache = getCalendarCache();

  if (!cache.refreshPromise) {
    cache.refreshPromise = loadCalendarEventsFresh()
      .then((events) => {
        cache.events = events;
        cache.updatedAt = Date.now();
        return events;
      })
      .finally(() => {
        cache.refreshPromise = null;
      });
  }

  return cache.refreshPromise;
}

export async function getCalendarEvents() {
  const cache = getCalendarCache();
  const now = Date.now();

  // Serve the cached payload immediately and refresh in the background when the
  // TTL expires. This keeps dashboard navigation fast.
  if (cache.events?.length) {
    if (now - cache.updatedAt > CALENDAR_CACHE_TTL_MS) {
      void refreshCalendarCache();
    }

    return cache.events;
  }

  return refreshCalendarCache();
}

export function getCalendarEventsLastUpdatedAt() {
  const cache = getCalendarCache();
  return cache.updatedAt ? new Date(cache.updatedAt).toISOString() : null;
}

export function invalidateCalendarEventsCache() {
  const cache = getCalendarCache();
  cache.events = null;
  cache.updatedAt = 0;
}

export function buildCalendarExportIcs(events: CalendarEvent[], origin: string) {
  // ICS export is built manually so admin filters map 1:1 to the rendered
  // calendar without introducing another serialization dependency.
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//knowledge//Calendar Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    const summary = escapeIcsText(event.title);
    const description = escapeIcsText(
      [
        event.description,
        event.host ? `Host: ${event.host}` : null,
        event.eventType ? `Type: ${event.eventType}` : null,
        event.sourceName ? `Source: ${event.sourceName}` : null,
        event.url ? `Link: ${event.url.startsWith("http") ? event.url : `${origin}${event.url}`}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );

    const location = escapeIcsText(event.city ?? (event.format === "ONLINE" ? "Online" : "On-site"));
    const categories = escapeIcsText(event.sourceFilters.join(","));
    const eventUrl = event.url?.startsWith("http") ? event.url : event.url ? `${origin}${event.url}` : null;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcsText(event.id)}@knowledge`);
    lines.push(`DTSTAMP:${formatIcsDate(new Date())}`);
    lines.push(`DTSTART:${formatIcsDate(event.startDate)}`);
    lines.push(`DTEND:${formatIcsDate(event.endDate)}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push(`LOCATION:${location}`);
    lines.push(`CATEGORIES:${categories}`);

    if (event.host) {
      lines.push(`ORGANIZER:${escapeIcsText(event.host)}`);
    }

    if (eventUrl) {
      lines.push(`URL:${escapeIcsText(eventUrl)}`);
    }

    lines.push("STATUS:CONFIRMED");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
