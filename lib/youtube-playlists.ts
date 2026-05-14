export type YoutubePlaylist = {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  videoCount: number | null;
  updatedText: string | null;
};

export type YoutubePlaylistSource = "youtube-api" | "youtube-public-page" | "fallback";

export type YoutubePlaylistsResult = {
  channelTitle: string;
  channelUrl: string;
  fetchedAt: string;
  source: YoutubePlaylistSource;
  playlists: YoutubePlaylist[];
};

type FetchYoutubePlaylistsOptions = {
  limit?: number;
};

type YoutubeApiPlaylistResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      thumbnails?: YoutubeThumbnailMap;
    };
    contentDetails?: {
      itemCount?: number;
    };
  }>;
};

type YoutubeThumbnailMap = Record<string, { url?: string; width?: number; height?: number }>;

const YOUTUBE_CHANNEL_HANDLE = "VLabCoEBrasil";
const DEFAULT_CHANNEL_ID = "UCVdve-LRCP08M3gwXTPNmpg";
const CHANNEL_TITLE = "VLab CoE Brasil";
const CHANNEL_URL = `https://www.youtube.com/@${YOUTUBE_CHANNEL_HANDLE}`;
const PLAYLISTS_URL = `${CHANNEL_URL}/playlists`;
const DEFAULT_LIMIT = 10;
const FETCH_TIMEOUT_MS = 12_000;
const DEFAULT_CACHE_SECONDS = 60;

const globalForYoutubePlaylists = globalThis as unknown as {
  youtubePlaylistsCache?: {
    expiresAt: number;
    limit: number;
    result: YoutubePlaylistsResult;
  };
};

const FALLBACK_PLAYLISTS: YoutubePlaylist[] = [
  fallbackPlaylist("PLkBdFUdgYo76r1P_NsLtzwtbiY23pX1AT", "Radiacao", "lhzMyEn-IWg", 1),
  fallbackPlaylist("PLkBdFUdgYo76K03rBJtQhGyMOBZxaVsn_", "Sensoriamento Remoto: Fundamentos", "boQELlT3wWY", 4),
  fallbackPlaylist("PLkBdFUdgYo7650vrwP2u_sknubGpdXY0K", "Composicoes RGB", "3LEnbXB5qMM", 3),
  fallbackPlaylist("PLkBdFUdgYo76zgfHyW-wIErZA2hHU2Gip", "Oceanografia por Satelite", "fluJH1k3uTE", 10),
  fallbackPlaylist("PLkBdFUdgYo7594mVzBEB_GhzrgWToLn4E", "Acesso e Processamento de Dados de Satelites", "agfTL0aMeJo", 12),
  fallbackPlaylist("PLkBdFUdgYo74zTPUnDKcjy1PEqGbixDNf", "Acesso e Processamento de Dados de Modelos de PNT", "qDWFRL_Ct9c", 2),
];

export async function fetchYoutubePlaylists({
  limit = DEFAULT_LIMIT,
}: FetchYoutubePlaylistsOptions = {}): Promise<YoutubePlaylistsResult> {
  const boundedLimit = Math.min(24, Math.max(1, Math.floor(limit)));
  const cached = globalForYoutubePlaylists.youtubePlaylistsCache;

  if (cached && cached.limit >= boundedLimit && cached.expiresAt > Date.now()) {
    return {
      ...cached.result,
      playlists: cached.result.playlists.slice(0, boundedLimit),
    };
  }

  const apiKey = process.env.YOUTUBE_API_KEY?.trim();

  try {
    const playlists = apiKey
      ? await fetchPlaylistsFromYoutubeApi(apiKey, boundedLimit)
      : await fetchPlaylistsFromPublicPage(boundedLimit);

    return cacheResult(
      {
        channelTitle: CHANNEL_TITLE,
        channelUrl: CHANNEL_URL,
        fetchedAt: new Date().toISOString(),
        source: apiKey ? "youtube-api" : "youtube-public-page",
        playlists,
      },
      boundedLimit,
    );
  } catch {
    return cacheResult(
      {
        channelTitle: CHANNEL_TITLE,
        channelUrl: CHANNEL_URL,
        fetchedAt: new Date().toISOString(),
        source: "fallback",
        playlists: FALLBACK_PLAYLISTS.slice(0, boundedLimit),
      },
      boundedLimit,
    );
  }
}

function cacheResult(result: YoutubePlaylistsResult, limit: number) {
  globalForYoutubePlaylists.youtubePlaylistsCache = {
    expiresAt: Date.now() + getCacheTtlMs(),
    limit,
    result,
  };

  return result;
}

function getCacheTtlMs() {
  const seconds = Number(process.env.YOUTUBE_PLAYLIST_CACHE_SECONDS ?? DEFAULT_CACHE_SECONDS);
  const safeSeconds = Number.isFinite(seconds) && seconds >= 10 ? Math.floor(seconds) : DEFAULT_CACHE_SECONDS;

  return safeSeconds * 1000;
}

async function fetchPlaylistsFromYoutubeApi(apiKey: string, limit: number) {
  const channelId = process.env.YOUTUBE_CHANNEL_ID?.trim() || DEFAULT_CHANNEL_ID;
  const requestUrl = new URL("https://www.googleapis.com/youtube/v3/playlists");
  requestUrl.searchParams.set("part", "snippet,contentDetails");
  requestUrl.searchParams.set("channelId", channelId);
  requestUrl.searchParams.set("maxResults", String(Math.min(50, limit)));
  requestUrl.searchParams.set("key", apiKey);

  const response = await fetchWithTimeout(requestUrl.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("YouTube API unavailable.");
  }

  const payload = (await response.json()) as YoutubeApiPlaylistResponse;
  const playlists: YoutubePlaylist[] = [];

  for (const item of payload.items ?? []) {
    const id = item.id?.trim();
    const title = item.snippet?.title?.trim();

    if (!id || !title) {
      continue;
    }

    playlists.push({
      id,
      title,
      url: buildPlaylistUrl(id),
      thumbnailUrl: selectApiThumbnail(item.snippet?.thumbnails),
      videoCount: typeof item.contentDetails?.itemCount === "number" ? item.contentDetails.itemCount : null,
      updatedText: null,
    });
  }

  if (playlists.length === 0) {
    throw new Error("No playlists returned.");
  }

  return playlists;
}

async function fetchPlaylistsFromPublicPage(limit: number) {
  const response = await fetchWithTimeout(PLAYLISTS_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "User-Agent": "knowledge-platform/1.0",
    },
  });

  if (!response.ok) {
    throw new Error("YouTube public page unavailable.");
  }

  const html = await response.text();
  const initialData = parseYtInitialData(html);
  const lockups: unknown[] = [];
  collectLockupViewModels(initialData, lockups);

  const byId = new Map<string, YoutubePlaylist>();

  for (const lockup of lockups) {
    const playlist = parsePlaylistLockup(lockup);
    if (playlist && !byId.has(playlist.id)) {
      byId.set(playlist.id, playlist);
    }

    if (byId.size >= limit) {
      break;
    }
  }

  const playlists = Array.from(byId.values());
  if (playlists.length === 0) {
    throw new Error("No public playlists found.");
  }

  return playlists;
}

function parseYtInitialData(html: string) {
  const marker = "var ytInitialData = ";
  const markerIndex = html.indexOf(marker);

  if (markerIndex < 0) {
    throw new Error("ytInitialData not found.");
  }

  const start = markerIndex + marker.length;
  const end = findJsonObjectEnd(html, start);

  if (end < 0) {
    throw new Error("ytInitialData is incomplete.");
  }

  return JSON.parse(html.slice(start, end)) as unknown;
}

function findJsonObjectEnd(value: string, start: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return index + 1;
      }
    }
  }

  return -1;
}

function collectLockupViewModels(value: unknown, lockups: unknown[]) {
  if (!isRecord(value)) {
    return;
  }

  if (isRecord(value.lockupViewModel)) {
    lockups.push(value.lockupViewModel);
  }

  for (const child of Object.values(value)) {
    if (isRecord(child) || Array.isArray(child)) {
      collectLockupViewModels(child, lockups);
    }
  }
}

function parsePlaylistLockup(lockup: unknown): YoutubePlaylist | null {
  if (!isRecord(lockup)) {
    return null;
  }

  const id = typeof lockup.contentId === "string" ? lockup.contentId.trim() : "";
  if (!id.startsWith("PL")) {
    return null;
  }

  const metadata = getRecordPath(lockup, ["metadata", "lockupMetadataViewModel"]);
  const title = getStringPath(metadata, ["title", "content"])?.trim();
  const thumbnailUrl = selectPublicThumbnail(lockup);

  if (!title || !thumbnailUrl) {
    return null;
  }

  return {
    id,
    title,
    url: buildPlaylistUrl(id),
    thumbnailUrl,
    videoCount: findVideoCount(lockup),
    updatedText: findUpdatedText(lockup),
  };
}

function selectPublicThumbnail(lockup: Record<string, unknown>) {
  const sources = getUnknownPath(lockup, [
    "contentImage",
    "collectionThumbnailViewModel",
    "primaryThumbnail",
    "thumbnailViewModel",
    "image",
    "sources",
  ]);

  return selectLargestThumbnail(Array.isArray(sources) ? sources : []);
}

function selectApiThumbnail(thumbnails?: YoutubeThumbnailMap) {
  const sources = Object.values(thumbnails ?? {});
  return selectLargestThumbnail(sources) ?? "https://www.youtube.com/img/desktop/yt_1200.png";
}

function selectLargestThumbnail(sources: unknown[]) {
  return sources
    .filter(isRecord)
    .filter((source) => typeof source.url === "string")
    .sort((a, b) => Number(b.width ?? 0) * Number(b.height ?? 0) - Number(a.width ?? 0) * Number(a.height ?? 0))
    .map((source) => String(source.url))
    .at(0);
}

function findVideoCount(value: unknown): number | null {
  const text = findFirstText(value, (content) => /(\d+|um)\s+videos?/i.test(normalizeText(content)));
  if (!text) {
    return null;
  }

  if (/^um\s+video/i.test(normalizeText(text))) {
    return 1;
  }

  const match = text.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function findUpdatedText(value: unknown): string | null {
  return findFirstText(value, (content) => /^Atualizado/i.test(content));
}

function findFirstText(value: unknown, predicate: (content: string) => boolean): string | null {
  if (typeof value === "string") {
    return predicate(value) ? value : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.content === "string" && predicate(value.content)) {
    return value.content;
  }

  if (typeof value.simpleText === "string" && predicate(value.simpleText)) {
    return value.simpleText;
  }

  for (const child of Object.values(value)) {
    const found = findFirstText(child, predicate);
    if (found) {
      return found;
    }
  }

  return null;
}

function fallbackPlaylist(id: string, title: string, videoId: string, videoCount: number): YoutubePlaylist {
  return {
    id,
    title,
    url: buildPlaylistUrl(id),
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    videoCount,
    updatedText: null,
  };
}

function buildPlaylistUrl(id: string) {
  return `https://www.youtube.com/playlist?list=${encodeURIComponent(id)}`;
}

async function fetchWithTimeout(input: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getRecordPath(value: unknown, path: string[]) {
  const found = getUnknownPath(value, path);
  return isRecord(found) ? found : null;
}

function getStringPath(value: unknown, path: string[]) {
  const found = getUnknownPath(value, path);
  return typeof found === "string" ? found : null;
}

function getUnknownPath(value: unknown, path: string[]) {
  let cursor = value;

  for (const segment of path) {
    if (!isRecord(cursor)) {
      return null;
    }

    cursor = cursor[segment];
  }

  return cursor;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
