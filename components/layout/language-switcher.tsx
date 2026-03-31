"use client";

import type { ComponentProps } from "react";
import { Check, Languages } from "lucide-react";

import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { LANGUAGE_OPTIONS, type Language } from "@/lib/ui-settings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const LANGUAGE_LABELS: Record<Language, string> = {
  "pt-BR": "Portugues",
  en: "English",
  es: "Espanol",
};

type LanguageSwitcherProps = {
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
};

export function LanguageSwitcher({ variant = "secondary", className }: LanguageSwitcherProps) {
  const { language, setLanguage } = useUiSettings();
  const currentLabel =
    LANGUAGE_LABELS[language] ?? LANGUAGE_LABELS["pt-BR"];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant={variant} size="sm" className={className}>
          <Languages className="h-4 w-4" />
          {currentLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGE_OPTIONS.map((option) => {
          const selected = option.value === language;

          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setLanguage(option.value as Language)}
            >
              <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
                {selected ? <Check className="h-4 w-4 text-teal-600" /> : null}
              </span>
              {LANGUAGE_LABELS[option.value as Language]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
