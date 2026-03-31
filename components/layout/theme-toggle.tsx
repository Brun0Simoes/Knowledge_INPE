"use client";

import type { ComponentProps } from "react";
import { Moon, SunMedium } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUiSettings } from "@/components/providers/ui-settings-provider";

type ThemeToggleProps = {
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
};

export function ThemeToggle({ variant = "secondary", className }: ThemeToggleProps) {
  const { messages, theme, setTheme } = useUiSettings();
  const dark = theme === "dark";

  return (
    <Button
      type="button"
      className={className}
      variant={variant}
      size="sm"
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {dark ? messages.preferences.themeLight : messages.preferences.themeDark}
    </Button>
  );
}
