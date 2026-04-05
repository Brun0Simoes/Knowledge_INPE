import { z } from "zod";

import { forbidden, getApiUser, unauthorized } from "@/lib/access";
import { buildCalendarExportIcs, getCalendarEvents } from "@/lib/calendar-events";
import { filterCalendarEvents } from "@/lib/calendar-shared";

const exportQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  source: z.enum(["ALL", "EUMETSAT", "INPE", "PLATFORM"]).optional(),
  format: z.enum(["ALL", "ONLINE", "ONSITE"]).optional(),
});

export async function GET(request: Request) {
  const user = await getApiUser();

  if (!user) {
    return unauthorized();
  }

  if (user.role !== "ADMIN") {
    return forbidden();
  }

  const url = new URL(request.url);
  // Prefer forwarded headers so exported links stay correct behind Tailscale,
  // reverse proxies or a future production load balancer.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const requestHost = request.headers.get("host");
  const publicOrigin =
    forwardedHost || requestHost
      ? `${forwardedProto ?? url.protocol.replace(":", "")}://${forwardedHost ?? requestHost}`
      : url.origin;
  const parsed = exportQuerySchema.safeParse({
    month: url.searchParams.get("month") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
    format: url.searchParams.get("format") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json({ error: "Filtros de exportacao invalidos." }, { status: 400 });
  }

  const events = await getCalendarEvents();
  const filteredEvents = filterCalendarEvents(events, {
    monthKey: parsed.data.month,
    sourceFilter: parsed.data.source ?? "ALL",
    formatFilter: parsed.data.format ?? "ALL",
  });

  const ics = buildCalendarExportIcs(filteredEvents, publicOrigin);
  const monthKey = parsed.data.month ?? "all-months";
  const sourceKey = (parsed.data.source ?? "all").toLowerCase();
  const formatKey = (parsed.data.format ?? "all").toLowerCase();
  const fileName = `knowledge-events-${monthKey}-${sourceKey}-${formatKey}.ics`;

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
