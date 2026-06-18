"use client";

import { ExternalLink, ListVideo, PlayCircle, RefreshCw, Video } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import type { YoutubePlaylist, YoutubePlaylistsResult } from "@/lib/youtube-playlists";

type YoutubePlaylistsSectionProps = {
  initialData: YoutubePlaylistsResult;
};

const REFRESH_INTERVAL_MS = 60_000;

export function YoutubePlaylistsSection({ initialData }: YoutubePlaylistsSectionProps) {
  const { language, messages } = useUiSettings();
  const [data, setData] = useState(initialData);
  const [selectedId, setSelectedId] = useState(initialData.playlists[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const selectedPlaylist = useMemo(
    () => data.playlists.find((playlist) => playlist.id === selectedId) ?? data.playlists[0] ?? null,
    [data.playlists, selectedId],
  );

  const refreshPlaylists = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const response = await fetch(withBasePath("/api/youtube/playlists"), {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(messages.dashboard.youtubeUpdateError);
      }

      const nextData = (await response.json()) as YoutubePlaylistsResult;
      setData(nextData);
      setSelectedId((current) =>
        nextData.playlists.some((playlist) => playlist.id === current)
          ? current
          : (nextData.playlists[0]?.id ?? ""),
      );
      setError(null);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : messages.dashboard.youtubeUpdateError,
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [messages.dashboard.youtubeUpdateError]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshPlaylists();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [refreshPlaylists]);

  return (
    <section className="overflow-hidden rounded-[34px] border border-zinc-200/80 bg-[#111d2b] text-white shadow-[0_32px_100px_-48px_rgba(15,23,42,0.62)] dark:border-white/10 dark:bg-[#0d1825]">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative min-h-[380px] overflow-hidden p-6 sm:p-8">
          {selectedPlaylist ? (
            <Image
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover opacity-28 blur-sm scale-105"
              fill
              sizes="(max-width: 1024px) 100vw, 70vw"
              src={selectedPlaylist.thumbnailUrl}
              unoptimized
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-br from-[#111d2b] via-[#111d2b]/86 to-[#0f766e]/78" />

          <div className="relative z-10 flex min-h-[320px] flex-col justify-between gap-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl space-y-3">
                <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-teal-100/78">
                  <Video className="h-4 w-4" />
                  {messages.dashboard.youtubeEyebrow}
                </p>
                <div className="space-y-3">
                  <h2 className="font-heading text-3xl leading-tight sm:text-4xl">
                    {messages.dashboard.youtubeTitle}
                  </h2>
                  <p className="max-w-xl text-sm leading-7 text-white/72 sm:text-base">
                    {messages.dashboard.youtubeDescription}
                  </p>
                </div>
              </div>

              <Button asChild variant="secondary" className="shrink-0">
                <a href={data.channelUrl} rel="noreferrer" target="_blank">
                  <Video className="h-4 w-4" />
                  {messages.dashboard.youtubeOpenChannel}
                </a>
              </Button>
            </div>

            {selectedPlaylist ? (
              <SelectedPlaylist
                language={language}
                playlist={selectedPlaylist}
                openLabel={messages.dashboard.youtubeOpenPlaylist}
                videoLabel={messages.dashboard.youtubeVideo}
                videosLabel={messages.dashboard.youtubeVideos}
              />
            ) : (
              <div className="rounded-[24px] border border-white/14 bg-white/10 p-6 backdrop-blur">
                <p className="font-heading text-2xl">{messages.dashboard.youtubeEmptyTitle}</p>
                <p className="mt-2 text-sm leading-7 text-white/70">
                  {messages.dashboard.youtubeEmptyDescription}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 bg-white/[0.06] p-4 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-3 px-2 py-2">
            <div className="text-xs uppercase tracking-[0.24em] text-white/54">
              {messages.dashboard.youtubePlaylists}
            </div>
            <button
              aria-label={isRefreshing ? messages.dashboard.youtubeRefreshing : messages.dashboard.youtubeRefresh}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
              disabled={isRefreshing}
              onClick={() => void refreshPlaylists()}
              type="button"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing ? "animate-spin" : "")} />
            </button>
          </div>

          <div className="mt-2 grid max-h-[420px] gap-2 overflow-y-auto pr-1">
            {data.playlists.map((playlist) => (
              <button
                className={cn(
                  "grid grid-cols-[92px_minmax(0,1fr)] gap-3 rounded-[22px] border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200",
                  playlist.id === selectedPlaylist?.id
                    ? "border-teal-200/60 bg-teal-300/16"
                    : "border-white/10 bg-white/7 hover:border-white/18 hover:bg-white/10",
                )}
                key={playlist.id}
                onClick={() => setSelectedId(playlist.id)}
                type="button"
              >
                <Image
                  alt=""
                  aria-hidden="true"
                  className="aspect-video w-full rounded-[16px] object-cover"
                  height={104}
                  src={playlist.thumbnailUrl}
                  unoptimized
                  width={184}
                />
                <span className="min-w-0 self-center">
                  <span className="line-clamp-2 text-sm font-semibold leading-5 text-white">
                    {playlist.title}
                  </span>
                  <PlaylistMeta
                    language={language}
                    playlist={playlist}
                    videoLabel={messages.dashboard.youtubeVideo}
                    videosLabel={messages.dashboard.youtubeVideos}
                  />
                </span>
              </button>
            ))}
          </div>

          <div aria-live="polite" className="mt-4 space-y-2 px-2 text-xs leading-5 text-white/56">
            <p>
              {messages.dashboard.youtubeSynced} {formatSyncTime(data.fetchedAt, language)}
            </p>
            {data.source === "fallback" ? <p>{messages.dashboard.youtubeFallback}</p> : null}
            {error ? <p className="text-amber-100">{error}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function SelectedPlaylist({
  language,
  playlist,
  openLabel,
  videoLabel,
  videosLabel,
}: {
  language: string;
  playlist: YoutubePlaylist;
  openLabel: string;
  videoLabel: string;
  videosLabel: string;
}) {
  return (
    <div className="grid gap-5 rounded-[28px] border border-white/14 bg-white/10 p-4 backdrop-blur sm:grid-cols-[220px_minmax(0,1fr)] sm:p-5">
      <div className="relative overflow-hidden rounded-[22px]">
        <Image
          alt={playlist.title}
          className="aspect-video h-full w-full object-cover"
          height={248}
          src={playlist.thumbnailUrl}
          unoptimized
          width={440}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/42 to-transparent" />
        <div className="absolute bottom-3 left-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#122033] shadow-sm">
          <PlayCircle className="h-5 w-5" />
        </div>
      </div>

      <div className="flex min-w-0 flex-col justify-between gap-5">
        <div className="space-y-3">
          <PlaylistMeta
            language={language}
            playlist={playlist}
            videoLabel={videoLabel}
            videosLabel={videosLabel}
          />
          <h3 className="font-heading text-2xl leading-tight sm:text-3xl">{playlist.title}</h3>
          {playlist.updatedText ? <p className="text-sm text-white/64">{playlist.updatedText}</p> : null}
        </div>

        <Button asChild className="w-fit">
          <a href={playlist.url} rel="noreferrer" target="_blank">
            <ExternalLink className="h-4 w-4" />
            {openLabel}
          </a>
        </Button>
      </div>
    </div>
  );
}

function PlaylistMeta({
  language,
  playlist,
  videoLabel,
  videosLabel,
}: {
  language: string;
  playlist: YoutubePlaylist;
  videoLabel: string;
  videosLabel: string;
}) {
  if (playlist.videoCount === null) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs text-white/58">
      <ListVideo className="h-3.5 w-3.5" />
      {new Intl.NumberFormat(language).format(playlist.videoCount)}{" "}
      {playlist.videoCount === 1 ? videoLabel : videosLabel}
    </span>
  );
}

function formatSyncTime(value: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
