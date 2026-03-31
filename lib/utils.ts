import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { format, formatDistanceToNow } from "date-fns";
import { enUS, es, ptBR } from "date-fns/locale";
import slugify from "slugify";
import { twMerge } from "tailwind-merge";

import { FALLBACK_COURSE_IMAGE } from "@/lib/constants";
import { DEFAULT_LANGUAGE, type Language } from "@/lib/ui-settings";

const dateLocales = {
  "pt-BR": ptBR,
  en: enUS,
  es,
} as const;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizePlainText(value: string) {
  return value
    .replace(/[<>]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function sanitizeLongText(value: string) {
  return value
    .replace(/[<>]/g, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseMultilineUrls(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n|,/)
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  );
}

export function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function createCourseSlug(value: string) {
  return slugify(value, {
    lower: true,
    strict: true,
    locale: "pt",
  });
}

export function formatDate(date: Date, language: Language = DEFAULT_LANGUAGE) {
  const locale = dateLocales[language];
  const formatPattern =
    language === "en" ? "MMM dd, yyyy" : language === "es" ? "dd 'de' MMM yyyy" : "dd 'de' MMM yyyy";

  return format(date, formatPattern, { locale });
}

export function formatRelativeDate(date: Date, language: Language = DEFAULT_LANGUAGE) {
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: dateLocales[language],
  });
}

export function formatCompactNumber(value: number, language: Language = DEFAULT_LANGUAGE) {
  return new Intl.NumberFormat(language, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number, language: Language = DEFAULT_LANGUAGE) {
  return new Intl.NumberFormat(language, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatRating(value: number, language: Language = DEFAULT_LANGUAGE) {
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function average(numbers: number[]) {
  if (!numbers.length) {
    return 0;
  }

  return numbers.reduce((sum, number) => sum + number, 0) / numbers.length;
}

export function getPrimaryCourseImage(images: Array<{ url: string }>) {
  return images[0]?.url ?? FALLBACK_COURSE_IMAGE;
}

export function getSafeCallbackUrl(value?: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  return value;
}

export function getClientRedirectUrl(value?: string | null, fallback = "/dashboard") {
  const safeFallback = getSafeCallbackUrl(fallback);

  if (!value) {
    return safeFallback;
  }

  if (value.startsWith("/")) {
    return value;
  }

  if (typeof window === "undefined") {
    return safeFallback;
  }

  try {
    const parsed = new URL(value, window.location.origin);
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || safeFallback;
  } catch {
    return safeFallback;
  }
}
