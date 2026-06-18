import { getCalendarEvents, getCalendarEventsLastUpdatedAt } from "@/lib/calendar-events";

export async function GET() {
  const events = await getCalendarEvents();
  const updatedAt = getCalendarEventsLastUpdatedAt();

  return Response.json(
    {
      events,
      updatedAt,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
