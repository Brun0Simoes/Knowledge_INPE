import { cache } from "react";

export type ExternalTrainingEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  format: string;
  eventType: string;
  status: string;
  attendance: string | null;
  city: string | null;
  host: string | null;
  contactUrl: string | null;
  registrationUrl: string | null;
  description: string | null;
  languages: string[];
};

const EVENTS_ENDPOINT = "https://trainingevents.eumetsat.int/trapi/resources/public/events";
const FEED_TIMEOUT_MS = 20 * 1000;

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function cleanText(value: unknown): string | null {
  const text = asString(value);

  return text
    ? decodeXmlEntities(text)
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim() || null
    : null;
}

function nestedValue(value: unknown): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return cleanText((value as Record<string, unknown>).value);
  }

  return cleanText(value);
}

function normalizeExternalUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function extractFirstUrl(value: unknown) {
  const text = asString(value);
  const match = text && decodeXmlEntities(text).match(/https?:\/\/[^\s<>"')\]]+/i);
  return normalizeExternalUrl(match?.[0] ?? null);
}

function parseTrainingDate(value: unknown): string | null {
  if ((typeof value !== "number" && typeof value !== "string") || value === "") {
    return null;
  }

  const date = new Date(typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function mapTrainingJsonEvent(value: unknown): ExternalTrainingEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const event = value as Record<string, unknown>;
  const title = cleanText(event.title);
  const start = parseTrainingDate(event.startDate);
  const end = parseTrainingDate(event.endDate);

  if (!title || !start || !end || end < start) {
    return null;
  }

  // Keep date-only ranges on the same days in the Sao Paulo calendar.
  const dateOnly = start.endsWith("T00:00:00.000Z") && end.endsWith("T00:00:00.000Z");
  const startDate = dateOnly ? `${start.slice(0, 10)}T12:00:00.000Z` : start;
  const endDate = dateOnly ? `${end.slice(0, 10)}T12:00:00.000Z` : end;
  const country = event.country && typeof event.country === "object"
    ? event.country as Record<string, unknown>
    : null;
  const city = cleanText(event.city);
  const onlineLocation = [city, cleanText(country?.name), cleanText(country?.id), cleanText(event.country)]
    .some((location) => location?.toUpperCase() === "ONLINE");
  const eventId = asString(event.id);
  const detailUrl = eventId ? `https://trainingevents.eumetsat.int/?id=${encodeURIComponent(eventId)}&page=details` : null;

  return {
    id: eventId ?? `${title}-${startDate}`,
    title,
    startDate,
    endDate,
    format: onlineLocation || cleanText(event.format)?.toUpperCase().includes("ONLINE") ? "ONLINE" : "ONSITE",
    eventType: nestedValue(event.eventType) ?? "Event",
    status: nestedValue(event.status) ?? "Scheduled",
    attendance: nestedValue(event.attendance),
    city,
    host: cleanText(event.host) ?? "EUMETSAT",
    contactUrl: normalizeExternalUrl(asString(event.contactUrl)) ?? detailUrl,
    registrationUrl: extractFirstUrl(event.registrationHowto),
    description: cleanText(event.description) ?? cleanText(event.summary),
    languages: (Array.isArray(event.language) ? event.language : [event.language])
      .map(nestedValue)
      .filter((language): language is string => Boolean(language)),
  };
}

function xmlValues(block: string, tag: string): string[] {
  return Array.from(block.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g")))
    .map((match) => match[1]);
}

function xmlValue(block: string, tag: string) {
  // The event fields precede metadata, whose nested tags can reuse these names.
  return xmlValues(block, tag)[0] ?? null;
}

function mapTrainingXmlEvent(block: string): ExternalTrainingEvent | null {
  const nested = (tag: string, key = "value") => xmlValue(xmlValue(block, tag) ?? "", key);

  return mapTrainingJsonEvent({
    // XML contains nested IDs, so use the title/date fallback for a stable ID.
    title: xmlValue(block, "title"),
    startDate: cleanText(xmlValue(block, "startDate")),
    endDate: cleanText(xmlValue(block, "endDate")),
    format: xmlValue(block, "format"),
    eventType: nested("eventType"),
    status: nested("status"),
    attendance: nested("attendance"),
    city: xmlValue(block, "city"),
    country: { name: nested("country", "name"), id: nested("country", "id") },
    host: xmlValue(block, "host"),
    contactUrl: cleanText(xmlValue(block, "contactUrl")),
    registrationHowto: xmlValue(block, "registrationHowto"),
    description: xmlValue(block, "description"),
    summary: xmlValue(block, "summary"),
    language: xmlValues(block, "language").map((language) => xmlValue(language, "value")),
  });
}

function parseTrainingFeed(body: string): ExternalTrainingEvent[] {
  const content = body.trim();
  let events: (ExternalTrainingEvent | null)[];

  if (content.startsWith("[") || content.startsWith("{")) {
    const payload: unknown = JSON.parse(content);

    if (!Array.isArray(payload)) {
      throw new Error("Formato JSON inesperado no calendario EUMETSAT: esperada uma lista.");
    }

    events = payload.map(mapTrainingJsonEvent);
  } else {
    const xml = content.replace(/^<\?xml\b[^?]*\?>\s*/, "");
    if (/^<events\s*\/>$/.test(xml)) {
      return [];
    }

    const body = xml.match(/^<events(?:\s[^>]*)?>([\s\S]*)<\/events>$/)?.[1];
    const eventPattern = /<event>([\s\S]*?)<\/event>/g;
    if (body === undefined || body.replace(eventPattern, "").trim()) {
      throw new Error("Formato inesperado no calendario EUMETSAT.");
    }

    events = Array.from(body.matchAll(eventPattern))
      .map((match) => mapTrainingXmlEvent(match[1]));
  }

  const seen = new Set<string>();

  return events
    .filter((event): event is ExternalTrainingEvent => Boolean(event))
    .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())
    .filter((event) => {
      const key = JSON.stringify([event.title, event.startDate]);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

export const getPublicTrainingEvents = cache(async () => {
  const response = await fetch(EVENTS_ENDPOINT, {
    headers: {
      Accept: "application/json,application/xml;q=0.9,text/xml;q=0.8",
    },
    // The raw response exceeds Next.js's data-cache limit. Cache the mapped events instead.
    cache: "no-store",
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar eventos externos (${response.status}).`);
  }

  return parseTrainingFeed(await response.text());
});
