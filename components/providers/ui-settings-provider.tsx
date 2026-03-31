"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  DEFAULT_LANGUAGE,
  DEFAULT_THEME,
  getMessages,
  LANGUAGE_COOKIE,
  THEME_COOKIE,
  type Language,
  type Messages,
  type ThemeMode,
} from "@/lib/ui-settings";

type UiSettingsContextValue = {
  language: Language;
  theme: ThemeMode;
  messages: Messages;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemeMode) => void;
};

const UiSettingsContext = createContext<UiSettingsContextValue | null>(null);

type UiSettingsProviderProps = {
  children: ReactNode;
  initialLanguage?: Language;
  initialTheme?: ThemeMode;
};

export function UiSettingsProvider({
  children,
  initialLanguage = DEFAULT_LANGUAGE,
  initialTheme = DEFAULT_THEME,
}: UiSettingsProviderProps) {
  const router = useRouter();
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);

  const messages = useMemo(() => getMessages(language), [language]);

  function persistPreference(name: string, value: string) {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
  }

  function applyTheme(nextTheme: ThemeMode) {
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.dataset.theme = nextTheme;
  }

  function updateLanguage(nextLanguage: Language) {
    if (nextLanguage === language) {
      return;
    }

    setLanguageState(nextLanguage);
    persistPreference(LANGUAGE_COOKIE, nextLanguage);
    document.documentElement.lang = nextLanguage;
    router.refresh();
  }

  function updateTheme(nextTheme: ThemeMode) {
    setThemeState(nextTheme);
    persistPreference(THEME_COOKIE, nextTheme);
    applyTheme(nextTheme);
  }

  const value: UiSettingsContextValue = {
    language,
    theme,
    messages,
    setLanguage: updateLanguage,
    setTheme: updateTheme,
  };

  return <UiSettingsContext.Provider value={value}>{children}</UiSettingsContext.Provider>;
}

export function useUiSettings() {
  const context = useContext(UiSettingsContext);

  if (!context) {
    throw new Error("useUiSettings must be used within UiSettingsProvider.");
  }

  return context;
}
