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
  languages: string[];
};

const EVENTS_ENDPOINT = "https://trainingevents.eumetsat.int/trapi/resources/public/events";

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

function cleanXmlText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return decodeXmlEntities(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchAllTagValues(block: string, tagName: string) {
  return Array.from(block.matchAll(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "g")))
    .map((match) => cleanXmlText(match[1]))
    .filter((value): value is string => Boolean(value));
}

function matchLastTagValue(block: string, tagName: string) {
  const matches = matchAllTagValues(block, tagName);
  return matches.at(-1) ?? null;
}

function matchNestedValue(block: string, containerTag: string, nestedTag: string) {
  const match = block.match(
    new RegExp(
      `<${containerTag}>[\\s\\S]*?<${nestedTag}>([\\s\\S]*?)</${nestedTag}>[\\s\\S]*?</${containerTag}>`,
      "i",
    ),
  );

  return cleanXmlText(match?.[1]);
}

function extractFirstUrl(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/https?:\/\/[^\s<>"')\]]+/i);
  return match?.[0] ?? null;
}

function parseEventBlock(block: string): ExternalTrainingEvent | null {
  const title = matchLastTagValue(block, "title");
  const startDate = matchLastTagValue(block, "startDate");
  const endDate = matchLastTagValue(block, "endDate");

  if (!title || !startDate || !endDate) {
    return null;
  }

  const status = matchNestedValue(block, "status", "value") ?? "Scheduled";
  const format = matchLastTagValue(block, "format") ?? "UNKNOWN";
  const eventType = matchNestedValue(block, "eventType", "value") ?? "Event";
  const attendance = matchNestedValue(block, "attendance", "value");
  const city = matchLastTagValue(block, "city");
  const host = matchLastTagValue(block, "host");
  const contactUrl = matchLastTagValue(block, "contactUrl");
  const registrationUrl = extractFirstUrl(matchLastTagValue(block, "registrationHowto"));
  const languages = Array.from(
    block.matchAll(/<language>[\s\S]*?<value>([\s\S]*?)<\/value>[\s\S]*?<\/language>/g),
  )
    .map((match) => cleanXmlText(match[1]))
    .filter((value): value is string => Boolean(value));

  return {
    id: `${title}-${startDate}`,
    title,
    startDate,
    endDate,
    format,
    eventType,
    status,
    attendance,
    city,
    host,
    contactUrl,
    registrationUrl,
    languages,
  };
}

export const getPublicTrainingEvents = cache(async () => {
  const response = await fetch(EVENTS_ENDPOINT, {
    headers: {
      Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
    },
    next: {
      revalidate: 60 * 60 * 6,
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar eventos externos (${response.status}).`);
  }

  const xml = await response.text();

  return Array.from(xml.matchAll(/<event>([\s\S]*?)<\/event>/g))
    .map((match) => parseEventBlock(match[1]))
    .filter((event): event is ExternalTrainingEvent => Boolean(event))
    .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())
    .filter(
      (event, index, events) =>
        events.findIndex(
          (candidate) => candidate.title === event.title && candidate.startDate === event.startDate,
        ) === index,
    );
});
