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

type EumetsatSolrDoc = {
  [key: string]: unknown;
  id?: string;
  title?: string;
  solrCollection?: string;
  solrDocId?: string;
  startDate?: string;
  endDate?: string;
  facet_contentTypes?: unknown;
  uns_facet_unsMsgStatus?: unknown;
  uns_facet_unsMsgType?: unknown;
};

type EumetsatSolrResponse = {
  response?: {
    numFound?: number;
    docs?: EumetsatSolrDoc[];
  };
};

const EUMETSAT_PORTAL_ORIGIN = "https://user.eumetsat.int";
const EVENTS_ENDPOINT = `${EUMETSAT_PORTAL_ORIGIN}/search/alias-all/eup-select?q.op=AND`;
const CALENDAR_FILTER_QUERY =
  'facet_contentTypes:"News" OR facet_contentTypes:"Events" OR solrCollection:"training-calendar-events" OR (solrCollection:"uns-announcements" AND uns_facet_unsMsgType:"Planned maintenance")';
const SOLR_PAGE_SIZE = 1000;
const SOLR_MAX_PAGES = 10;

function asString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function firstString(value: unknown) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed = asString(entry);

      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  return asString(value);
}

function stringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => asString(entry)).filter((entry): entry is string => Boolean(entry));
  }

  const parsed = asString(value);
  return parsed ? [parsed] : [];
}

function stripHtml(value: string | null) {
  return value
    ?.replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim() ?? null;
}

function extractFirstUrl(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/https?:\/\/[^\s<>"')\]]+/i);
  return normalizeExternalUrl(match?.[0] ?? null);
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

function addHoursIso(value: string, hours: number) {
  const date = new Date(value);
  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString();
}

function normalizePortalDate(value: string | null, collection: string) {
  if (!value) {
    return null;
  }

  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?Z$/);

  if (collection !== "uns-announcements" && dateOnly) {
    return `${dateOnly[1]}T12:00:00.000Z`;
  }

  return value;
}

function getPortalLink(doc: EumetsatSolrDoc, collection: string) {
  const solrDocId = asString(doc.solrDocId);

  if (collection === "training-calendar-events" && solrDocId) {
    return `${EUMETSAT_PORTAL_ORIGIN}/news-events/events/${solrDocId}`;
  }

  if (collection === "cms-events") {
    const slug = asString(doc.cms_evt_slug) ?? solrDocId;
    return slug ? `${EUMETSAT_PORTAL_ORIGIN}/news-events/events/${slug}` : null;
  }

  if (collection === "cms-news") {
    const slug = asString(doc.cms_news_slug) ?? solrDocId;
    return slug ? `${EUMETSAT_PORTAL_ORIGIN}/news-events/news/${slug}` : null;
  }

  if (collection === "uns-announcements" && solrDocId) {
    return `${EUMETSAT_PORTAL_ORIGIN}/news-events/alerts-and-maintenance-notifications/${solrDocId}`;
  }

  return null;
}

function getResultType(doc: EumetsatSolrDoc, collection: string) {
  if (collection === "training-calendar-events") {
    return firstString(doc.tra_cal_events_eventType) ?? "Event";
  }

  if (collection === "uns-announcements") {
    return firstString(doc.uns_facet_unsMsgType) ?? "Planned maintenance";
  }

  const contentType = firstString(doc.facet_contentTypes);

  if (contentType) {
    return contentType.split("|").at(-1) ?? contentType;
  }

  return collection === "cms-news" ? "News" : "Event";
}

function getFormat(doc: EumetsatSolrDoc, collection: string) {
  if (collection === "uns-announcements" || collection === "cms-news") {
    return "ONLINE";
  }

  const format = firstString(doc.tra_cal_events_format)?.toUpperCase();
  const country = firstString(doc.tra_cal_events_country)?.toUpperCase();

  if (format?.includes("ONLINE") || country?.includes("ONLINE")) {
    return "ONLINE";
  }

  return "ONSITE";
}

function getSummary(doc: EumetsatSolrDoc, collection: string) {
  if (collection === "training-calendar-events") {
    return stripHtml(firstString(doc.tra_cal_events_summary));
  }

  if (collection === "cms-news") {
    return stripHtml(firstString(doc.cms_news_summary));
  }

  if (collection === "cms-events") {
    return stripHtml(firstString(doc.cms_evt_summary));
  }

  if (collection === "uns-announcements") {
    return stripHtml(firstString(doc.uns_ann_text) ?? firstString(doc.uns_ann_impactName));
  }

  return null;
}

function parsePortalEvent(doc: EumetsatSolrDoc): ExternalTrainingEvent | null {
  const collection = asString(doc.solrCollection) ?? "";
  const title = asString(doc.title);
  const startDate = normalizePortalDate(asString(doc.startDate), collection);

  if (!collection || !title || !startDate) {
    return null;
  }

  const endDate = normalizePortalDate(asString(doc.endDate), collection) ?? addHoursIso(startDate, 1);
  const registrationHowTo = firstString(doc.tra_cal_events_registrationHowto);
  const contactUrl = normalizeExternalUrl(firstString(doc.tra_cal_events_contactUrl)) ?? getPortalLink(doc, collection);
  const registrationUrl = extractFirstUrl(registrationHowTo) ?? getPortalLink(doc, collection);

  return {
    id: asString(doc.solrDocId) ?? `${collection}-${asString(doc.id) ?? title}-${startDate}`,
    title,
    startDate,
    endDate,
    format: getFormat(doc, collection),
    eventType: getResultType(doc, collection),
    status:
      firstString(doc.tra_cal_events_status_value) ??
      firstString(doc.uns_facet_unsMsgStatus) ??
      firstString(doc.cms_news_status) ??
      "Scheduled",
    attendance: firstString(doc.tra_cal_events_attendance_value) ?? firstString(doc.uns_ann_impactName),
    city:
      firstString(doc.tra_cal_events_city) ??
      firstString(doc.tra_cal_events_location) ??
      firstString(doc.uns_ann_opServText),
    host: firstString(doc.tra_cal_events_host) ?? firstString(doc.uns_ann_opServGroupText) ?? "EUMETSAT",
    contactUrl,
    registrationUrl,
    description: getSummary(doc, collection),
    languages: stringList(doc.tra_cal_events_language),
  };
}

function getPortalWindow() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 19, 0, 23, 59, 59, 999));

  return { from, to };
}

async function fetchPortalCalendarDocs() {
  const { from, to } = getPortalWindow();
  const rangeQuery = `startDate:[${from.toISOString()} TO ${to.toISOString()}] OR endDate:[${from.toISOString()} TO ${to.toISOString()}]`;
  const docs: EumetsatSolrDoc[] = [];

  for (let page = 0; page < SOLR_MAX_PAGES; page += 1) {
    const response = await fetch(EVENTS_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        limit: SOLR_PAGE_SIZE,
        offset: page * SOLR_PAGE_SIZE,
        sort: "startDate asc",
        filter: [CALENDAR_FILTER_QUERY, rangeQuery],
      }),
      next: {
        revalidate: 60 * 60 * 6,
      },
    });

    if (!response.ok) {
      throw new Error(`Falha ao carregar eventos externos (${response.status}).`);
    }

    const payload = (await response.json()) as EumetsatSolrResponse;
    const pageDocs = payload.response?.docs ?? [];
    docs.push(...pageDocs);

    const total = payload.response?.numFound ?? docs.length;

    if (docs.length >= total || pageDocs.length === 0) {
      break;
    }
  }

  return docs;
}

export const getPublicTrainingEvents = cache(async () => {
  const events = (await fetchPortalCalendarDocs())
    .map((doc) => parsePortalEvent(doc))
    .filter((event): event is ExternalTrainingEvent => Boolean(event))
    .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime());

  const seenEventIds = new Set<string>();

  return events.filter((event) => {
    if (seenEventIds.has(event.id)) {
      return false;
    }

    seenEventIds.add(event.id);
    return true;
  });
});
