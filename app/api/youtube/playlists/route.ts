import { NextResponse } from "next/server";

import { getApiUser, unauthorized } from "@/lib/access";
import { fetchYoutubePlaylists } from "@/lib/youtube-playlists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return unauthorized();
  }

  const playlists = await fetchYoutubePlaylists({ limit: 12 });

  return NextResponse.json(playlists, {
    headers: {
      "Cache-Control": "private, max-age=45, stale-while-revalidate=120",
    },
  });
}
