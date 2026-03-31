import { getApiUser, unauthorized } from "@/lib/access";
import { getCalendarEvents, getCalendarEventsLastUpdatedAt } from "@/lib/calendar-events";

export async function GET() {
  const user = await getApiUser();

  if (!user) {
    return unauthorized();
  }

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
