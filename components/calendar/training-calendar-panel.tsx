"use client";

import { ChevronLeft, ChevronRight, Download, ExternalLink, LoaderCircle, MonitorPlay, RadioTower, Satellite } from "lucide-react";
import { addDays, addMonths, endOfMonth, endOfWeek, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withBasePath } from "@/lib/base-path";
import {
  CALENDAR_TIME_ZONE,
  filterCalendarEvents,
  getCalendarDayKey,
  getCalendarEventEndDayKey,
  getCalendarEventStartDayKey,
  getCalendarMonthKey,
  isCalendarEventActiveOnDay,
  type CalendarEvent,
  type CalendarFormatFilter,
  type CalendarSourceFilter,
} from "@/lib/calendar-shared";
import type { Language } from "@/lib/ui-settings";
import { cn, formatRelativeDate } from "@/lib/utils";

type TrainingCalendarPanelProps = {
  language: Language;
  className?: string;
  allowExport?: boolean;
};

type CalendarPayload = {
  events: CalendarEvent[];
  updatedAt: string | null;
};

const CALENDAR_REFRESH_INTERVAL_MS = 3 * 60 * 1000;
const sourceFilters: CalendarSourceFilter[] = ["ALL", "EUMETSAT", "INPE", "PLATFORM"];
const formatFilters: CalendarFormatFilter[] = ["ALL", "ONLINE", "ONSITE"];

const calendarLabels = {
  "pt-BR": {
    eyebrow: "Agenda orbital",
    title: "Calendario internacional",
    description: "Agenda combinada com eventos EUMETSAT e marcos publicados na knowledge.",
    sourceGroup: "Fonte",
    formatGroup: "Modalidade",
    sourceFilters: {
      ALL: "Todos",
      EUMETSAT: "EUMETSAT",
      INPE: "INPE",
      PLATFORM: "Plataforma",
    },
    formatFilters: {
      ALL: "Todos",
      ONLINE: "Online",
      ONSITE: "Presencial",
    },
    noEventsDay: "Nenhum evento programado para este dia.",
    noEventsMonth: "Sem eventos para este recorte.",
    openEvent: "Abrir evento",
    registration: "Inscricao",
    online: "Online",
    onsite: "Presencial",
    hostedBy: "Host",
    selectedDay: "Dia selecionado",
    liveFeed: "Agenda integrada",
    previousMonth: "Mes anterior",
    nextMonth: "Proximo mes",
    calendarDayLabel: (day: string, count: number) =>
      `${day}. ${count} ${count === 1 ? "evento" : "eventos"}.`,
    mappedCount: (count: number) =>
      `${count} ${count === 1 ? "evento mapeado" : "eventos mapeados"} neste dia.`,
    monthlyCount: (count: number) =>
      `${count} ${count === 1 ? "evento no mes" : "eventos no mes"} com o filtro atual.`,
    exportMonth: "Baixar mes (.ics)",
    sourceBadge: "Origem",
    loading: "Carregando agenda automatica...",
    loadError:
      "Nao foi possivel atualizar a agenda agora. A dashboard continua disponivel normalmente.",
    lastUpdated: "Atualizado",
  },
  en: {
    eyebrow: "Orbital agenda",
    title: "International calendar",
    description: "Combined agenda with EUMETSAT events and published milestones from knowledge.",
    sourceGroup: "Source",
    formatGroup: "Format",
    sourceFilters: {
      ALL: "All",
      EUMETSAT: "EUMETSAT",
      INPE: "INPE",
      PLATFORM: "Platform",
    },
    formatFilters: {
      ALL: "All",
      ONLINE: "Online",
      ONSITE: "On-site",
    },
    noEventsDay: "No events scheduled for this day.",
    noEventsMonth: "No events for this view.",
    openEvent: "Open event",
    registration: "Registration",
    online: "Online",
    onsite: "On-site",
    hostedBy: "Host",
    selectedDay: "Selected day",
    liveFeed: "Combined feed",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    calendarDayLabel: (day: string, count: number) =>
      `${day}. ${count} ${count === 1 ? "event" : "events"}.`,
    mappedCount: (count: number) =>
      `${count} ${count === 1 ? "event mapped" : "events mapped"} on this day.`,
    monthlyCount: (count: number) =>
      `${count} ${count === 1 ? "event in the month" : "events in the month"} with the current filter.`,
    exportMonth: "Download month (.ics)",
    sourceBadge: "Source",
    loading: "Loading automatic calendar...",
    loadError: "Could not refresh the calendar right now. The rest of the dashboard is still available.",
    lastUpdated: "Updated",
  },
  es: {
    eyebrow: "Agenda orbital",
    title: "Calendario internacional",
    description: "Agenda combinada con eventos EUMETSAT y publicaciones de knowledge.",
    sourceGroup: "Fuente",
    formatGroup: "Modalidad",
    sourceFilters: {
      ALL: "Todos",
      EUMETSAT: "EUMETSAT",
      INPE: "INPE",
      PLATFORM: "Plataforma",
    },
    formatFilters: {
      ALL: "Todos",
      ONLINE: "Online",
      ONSITE: "Presencial",
    },
    noEventsDay: "No hay eventos programados para este dia.",
    noEventsMonth: "Sin eventos para esta vista.",
    openEvent: "Abrir evento",
    registration: "Inscripcion",
    online: "Online",
    onsite: "Presencial",
    hostedBy: "Host",
    selectedDay: "Dia seleccionado",
    liveFeed: "Agenda integrada",
    previousMonth: "Mes anterior",
    nextMonth: "Mes siguiente",
    calendarDayLabel: (day: string, count: number) =>
      `${day}. ${count} ${count === 1 ? "evento" : "eventos"}.`,
    mappedCount: (count: number) =>
      `${count} ${count === 1 ? "evento mapeado" : "eventos mapeados"} en este dia.`,
    monthlyCount: (count: number) =>
      `${count} ${count === 1 ? "evento en el mes" : "eventos en el mes"} con el filtro actual.`,
    exportMonth: "Descargar mes (.ics)",
    sourceBadge: "Fuente",
    loading: "Cargando agenda automatica...",
    loadError: "No fue posible actualizar la agenda ahora. El resto del panel sigue disponible.",
    lastUpdated: "Actualizado",
  },
} as const;

function getVisibleDays(month: Date) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];
  let cursor = start;

  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return days;
}

function getDefaultSelectedDay(
  events: CalendarEvent[],
  month: Date,
  sourceFilter: CalendarSourceFilter,
  formatFilter: CalendarFormatFilter,
) {
  const monthKey = getCalendarMonthKey(month);
  const monthEvents = filterCalendarEvents(events, { sourceFilter, formatFilter, monthKey });
  const todayKey = getCalendarDayKey(new Date());
  const isCurrentMonth = monthKey === getCalendarMonthKey(new Date());
  const monthStartDayKey = `${monthKey}-01`;
  const selected =
    (isCurrentMonth
      ? monthEvents.find((event) => getCalendarEventEndDayKey(event) >= todayKey)
      : null) ?? monthEvents[0];
  const selectedStartDayKey = selected ? getCalendarEventStartDayKey(selected) : null;

  if (selected && isCurrentMonth && isCalendarEventActiveOnDay(selected, todayKey)) {
    return todayKey;
  }

  if (selectedStartDayKey) {
    return selectedStartDayKey < monthStartDayKey ? monthStartDayKey : selectedStartDayKey;
  }

  return getCalendarDayKey(startOfMonth(month));
}

export function TrainingCalendarPanel({
  language,
  className,
  allowExport = false,
}: TrainingCalendarPanelProps) {
  const labels = calendarLabels[language] ?? calendarLabels["pt-BR"];
  const today = new Date();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<CalendarSourceFilter>("ALL");
  const [formatFilter, setFormatFilter] = useState<CalendarFormatFilter>("ALL");
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(today));
  const [selectedDay, setSelectedDay] = useState<string>(() =>
    getDefaultSelectedDay([], startOfMonth(today), "ALL", "ALL"),
  );
  const hasLoadedRef = useRef(false);
  const viewStateRef = useRef({
    currentMonth: startOfMonth(today),
    sourceFilter: "ALL" as CalendarSourceFilter,
    formatFilter: "ALL" as CalendarFormatFilter,
  });

  const formatters = useMemo(
    () => ({
      month: new Intl.DateTimeFormat(language, { month: "long", year: "numeric", timeZone: CALENDAR_TIME_ZONE }),
      weekday: new Intl.DateTimeFormat(language, { weekday: "short", timeZone: CALENDAR_TIME_ZONE }),
      selectedDay: new Intl.DateTimeFormat(language, { dateStyle: "full", timeZone: CALENDAR_TIME_ZONE }),
      eventDate: new Intl.DateTimeFormat(language, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: CALENDAR_TIME_ZONE,
      }),
    }),
    [language],
  );

  useEffect(() => {
    let disposed = false;

    async function refreshCalendar() {
      // The dashboard renders immediately and the calendar hydrates in parallel so
      // the external feed never blocks the rest of the page.
      if (!hasLoadedRef.current) {
        setLoading(true);
      }

      try {
        const response = await fetch(withBasePath("/api/calendar/events"), {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Calendar request failed: ${response.status}`);
        }

        const payload = (await response.json()) as CalendarPayload;

        if (disposed) {
          return;
        }

        const nextEvents = payload.events ?? [];
        const { currentMonth: activeMonth, formatFilter: activeFormatFilter, sourceFilter: activeSourceFilter } = viewStateRef.current;

        setEvents(nextEvents);
        setSelectedDay((previousSelectedDay) => {
          const filteredNextEvents = filterCalendarEvents(nextEvents, {
            sourceFilter: activeSourceFilter,
            formatFilter: activeFormatFilter,
          });

          if (
            previousSelectedDay &&
            filteredNextEvents.some((event) => isCalendarEventActiveOnDay(event, previousSelectedDay))
          ) {
            return previousSelectedDay;
          }

          return getDefaultSelectedDay(nextEvents, activeMonth, activeSourceFilter, activeFormatFilter);
        });
        setLastUpdatedAt(payload.updatedAt);
        setLoadError(false);
        hasLoadedRef.current = true;
      } catch {
        if (!disposed) {
          setLoadError(true);
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    void refreshCalendar();

    const intervalId = window.setInterval(() => {
      void refreshCalendar();
    }, CALENDAR_REFRESH_INTERVAL_MS);

    // Refresh on focus/visibility to keep the agenda current after long idle tabs.
    const handleFocus = () => {
      void refreshCalendar();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshCalendar();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    viewStateRef.current = { currentMonth, sourceFilter, formatFilter };
  }, [currentMonth, formatFilter, sourceFilter]);

  const filteredEvents = useMemo(() => {
    return filterCalendarEvents(events, { sourceFilter, formatFilter });
  }, [events, sourceFilter, formatFilter]);

  const currentMonthKey = getCalendarMonthKey(currentMonth);

  const monthEvents = useMemo(() => {
    return filterCalendarEvents(events, { sourceFilter, formatFilter, monthKey: currentMonthKey });
  }, [currentMonthKey, events, sourceFilter, formatFilter]);

  const visibleDays = useMemo(() => getVisibleDays(currentMonth), [currentMonth]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();

    for (const day of visibleDays) {
      const dayKey = getCalendarDayKey(day);
      const dayEvents = filteredEvents.filter((event) => isCalendarEventActiveOnDay(event, dayKey));

      if (dayEvents.length) {
        grouped.set(dayKey, dayEvents);
      }
    }

    return grouped;
  }, [filteredEvents, visibleDays]);

  const selectedEvents = eventsByDay.get(selectedDay) ?? [];
  const selectedDate = new Date(`${selectedDay}T12:00:00Z`);
  const exportHref = withBasePath(`/api/calendar/export?month=${currentMonthKey}&source=${sourceFilter}&format=${formatFilter}`);
  const lastUpdatedLabel = lastUpdatedAt ? formatRelativeDate(new Date(lastUpdatedAt), language) : null;

  function syncSelectedDay(
    nextMonth: Date,
    nextSourceFilter: CalendarSourceFilter,
    nextFormatFilter: CalendarFormatFilter,
  ) {
    viewStateRef.current = {
      currentMonth: nextMonth,
      sourceFilter: nextSourceFilter,
      formatFilter: nextFormatFilter,
    };
    setSelectedDay(getDefaultSelectedDay(events, nextMonth, nextSourceFilter, nextFormatFilter));
  }

  function moveMonth(direction: "prev" | "next") {
    const nextMonth = direction === "prev" ? subMonths(currentMonth, 1) : addMonths(currentMonth, 1);
    setCurrentMonth(nextMonth);
    syncSelectedDay(nextMonth, sourceFilter, formatFilter);
  }

  function changeSourceFilter(nextFilter: CalendarSourceFilter) {
    setSourceFilter(nextFilter);
    syncSelectedDay(currentMonth, nextFilter, formatFilter);
  }

  function changeFormatFilter(nextFilter: CalendarFormatFilter) {
    setFormatFilter(nextFilter);
    syncSelectedDay(currentMonth, sourceFilter, nextFilter);
  }

  return (
    <Card className={cn("paper-panel border-zinc-200/70 shadow-[0_28px_90px_-56px_rgba(15,23,42,0.45)]", className)}>
      <CardHeader className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
            {labels.eyebrow}
          </p>
          <CardTitle className="font-heading text-3xl text-zinc-950 dark:text-zinc-100">
            {labels.title}
          </CardTitle>
          <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">{labels.description}</p>
          {lastUpdatedLabel ? (
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {labels.lastUpdated} {lastUpdatedLabel}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              {labels.sourceGroup}
            </p>
            <div className="flex flex-wrap gap-2">
              {sourceFilters.map((filter) => (
                <button
                  key={filter}
                  className={cn(
                    "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
                    sourceFilter === filter
                      ? "border-[#13253a] bg-[#13253a] text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-white/12 dark:bg-[#102132] dark:text-zinc-200",
                  )}
                  type="button"
                  aria-pressed={sourceFilter === filter}
                  onClick={() => changeSourceFilter(filter)}
                >
                  {labels.sourceFilters[filter]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              {labels.formatGroup}
            </p>
            <div className="flex flex-wrap gap-2">
              {formatFilters.map((filter) => (
                <button
                  key={filter}
                  className={cn(
                    "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
                    formatFilter === filter
                      ? "border-[#13253a] bg-[#13253a] text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-white/12 dark:bg-[#102132] dark:text-zinc-200",
                  )}
                  type="button"
                  aria-pressed={formatFilter === filter}
                  onClick={() => changeFormatFilter(filter)}
                >
                  {labels.formatFilters[filter]}
                </button>
              ))}
            </div>
          </div>

          {allowExport ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-zinc-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-[#102132]">
              <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {labels.monthlyCount(monthEvents.length)}
              </p>
              {monthEvents.length ? (
                <Button asChild size="sm" variant="outline">
                  <a href={exportHref}>
                    <Download className="h-4 w-4" />
                    {labels.exportMonth}
                  </a>
                </Button>
              ) : (
                <Button disabled size="sm" variant="outline">
                  <Download className="h-4 w-4" />
                  {labels.exportMonth}
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="rounded-[28px] border border-zinc-200 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-[#0f1d2b]">
          {loading ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center text-zinc-600 dark:text-zinc-300">
              <LoaderCircle className="h-6 w-6 animate-spin text-teal-600 dark:text-teal-200" />
              <p className="text-sm leading-7">{labels.loading}</p>
            </div>
          ) : loadError && events.length === 0 ? (
            <div className="flex min-h-[360px] items-center rounded-[20px] border border-dashed border-zinc-200 bg-white/70 p-6 text-sm leading-7 text-zinc-600 dark:border-white/10 dark:bg-[#102132] dark:text-zinc-300">
              {labels.loadError}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={labels.previousMonth}
                  onClick={() => moveMonth("prev")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                    {labels.liveFeed}
                  </p>
                  <p className="font-heading text-2xl text-zinc-950 capitalize dark:text-zinc-100">
                    {formatters.month.format(currentMonth)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={labels.nextMonth}
                  onClick={() => moveMonth("next")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {getVisibleDays(startOfWeek(today, { weekStartsOn: 1 }))
                  .slice(0, 7)
                  .map((day) => (
                    <span key={day.toISOString()}>{formatters.weekday.format(day)}</span>
                  ))}
              </div>

              <div className="mt-3 grid grid-cols-7 gap-2">
                {visibleDays.map((day) => {
                  const dayKey = getCalendarDayKey(day);
                  const dayEvents = eventsByDay.get(dayKey) ?? [];
                  const selected = selectedDay === dayKey;
                  const todayMatch = isSameDay(day, today);
                  const dayLabel = labels.calendarDayLabel(
                    formatters.selectedDay.format(day),
                    dayEvents.length,
                  );

                  return (
                    <button
                      key={dayKey}
                      className={cn(
                        "min-h-[74px] rounded-3xl border p-2 text-left transition",
                        !isSameMonth(day, currentMonth) &&
                          "border-zinc-100 bg-zinc-50/70 text-zinc-400 dark:border-white/6 dark:bg-[#0b1722] dark:text-zinc-600",
                        isSameMonth(day, currentMonth) &&
                          "border-zinc-200 bg-white hover:border-zinc-300 dark:border-white/10 dark:bg-[#122438]",
                        selected &&
                          "border-teal-500 bg-teal-50 shadow-[0_12px_30px_-22px_rgba(13,148,136,0.9)] dark:bg-teal-950/35",
                      )}
                      type="button"
                      aria-current={todayMatch ? "date" : undefined}
                      aria-label={dayLabel}
                      aria-pressed={selected}
                      onClick={() => setSelectedDay(dayKey)}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "text-sm font-semibold text-zinc-800 dark:text-zinc-100",
                            todayMatch && "text-teal-700 dark:text-teal-200",
                          )}
                        >
                          {day.getDate()}
                        </span>
                        {dayEvents.length ? (
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#13253a] px-2 text-[10px] font-semibold text-white">
                            {dayEvents.length}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <span
                            key={event.id}
                            aria-hidden="true"
                            className={cn(
                              "h-2 w-2 rounded-full",
                              event.sourceFilters.includes("PLATFORM")
                                ? "bg-fuchsia-500"
                                : event.format === "ONLINE"
                                  ? "bg-amber-400"
                                  : "bg-teal-500",
                            )}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
              {labels.selectedDay}
            </p>
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {formatters.selectedDay.format(selectedDate)}
            </p>
          </div>

          {selectedEvents.length ? (
            <div className="space-y-3">
              {selectedEvents.map((event) => {
                const isOnline = event.format === "ONLINE";

                return (
                  <div
                    key={event.id}
                    className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-[#102132]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600 dark:bg-[#0c1724] dark:text-zinc-300">
                            {event.eventType}
                          </span>
                          <span className="rounded-full bg-fuchsia-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-200">
                            {labels.sourceBadge}: {event.sourceName}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]",
                              isOnline
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                                : "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-200",
                            )}
                          >
                            {isOnline ? labels.online : labels.onsite}
                          </span>
                        </div>
                        <h3 className="font-heading text-xl text-zinc-950 dark:text-zinc-100">{event.title}</h3>
                        <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
                          <p>{formatters.eventDate.format(new Date(event.startDate))}</p>
                          {event.host ? (
                            <p>
                              {labels.hostedBy}: {event.host}
                            </p>
                          ) : null}
                          <p>{event.city || labels.online}</p>
                        </div>
                      </div>

                      {event.url ? (
                        <Button asChild variant="outline" size="sm">
                          <a href={event.url} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" />
                            {event.url.includes("zoom") || event.url.includes("register")
                              ? labels.registration
                              : labels.openEvent}
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-zinc-200 bg-white/70 p-6 text-sm leading-7 text-zinc-600 dark:border-white/10 dark:bg-[#0f1d2b] dark:text-zinc-300">
              {filteredEvents.length ? labels.noEventsDay : labels.noEventsMonth}
            </div>
          )}

          <div className="rounded-[28px] bg-[#13253a] p-4 text-white shadow-[0_24px_80px_-48px_rgba(15,23,42,0.8)]">
            <div className="flex items-center gap-3">
              {selectedEvents[0]?.sourceFilters.includes("PLATFORM") ? (
                <RadioTower className="h-5 w-5 text-fuchsia-300" />
              ) : selectedEvents[0]?.format === "ONLINE" ? (
                <MonitorPlay className="h-5 w-5 text-amber-300" />
              ) : selectedEvents.length ? (
                <Satellite className="h-5 w-5 text-teal-300" />
              ) : (
                <RadioTower className="h-5 w-5 text-white/70" />
              )}
              <p className="text-sm text-white/74">
                {selectedEvents.length ? labels.mappedCount(selectedEvents.length) : labels.noEventsMonth}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
