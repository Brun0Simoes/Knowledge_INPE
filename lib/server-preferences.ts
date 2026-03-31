import { cookies } from "next/headers";

import {
  DEFAULT_LANGUAGE,
  DEFAULT_THEME,
  LANGUAGE_COOKIE,
  THEME_COOKIE,
  normalizeLanguage,
  normalizeTheme,
  type Language,
  type ThemeMode,
} from "@/lib/ui-settings";

export async function getServerLanguage(): Promise<Language> {
  const cookieStore = await cookies();
  return normalizeLanguage(cookieStore.get(LANGUAGE_COOKIE)?.value ?? DEFAULT_LANGUAGE);
}

export async function getServerTheme(): Promise<ThemeMode> {
  const cookieStore = await cookies();
  return normalizeTheme(cookieStore.get(THEME_COOKIE)?.value ?? DEFAULT_THEME);
}

export async function getServerUiPreferences() {
  const [language, theme] = await Promise.all([getServerLanguage(), getServerTheme()]);
  return { language, theme };
}
