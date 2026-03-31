import type { Metadata } from "next";
import { Source_Serif_4, Space_Grotesk } from "next/font/google";
import { UiSettingsProvider } from "@/components/providers/ui-settings-provider";
import { getServerUiPreferences } from "@/lib/server-preferences";
import "./globals.css";

const headingFont = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
});

const bodyFont = Source_Serif_4({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "knowledge",
  description: "Plataforma de cursos em ciencias espaciais com acesso direto ao Moodle.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { language, theme } = await getServerUiPreferences();

  return (
    <html
      lang={language}
      data-theme={theme}
      suppressHydrationWarning
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased ${theme === "dark" ? "dark" : ""}`}
    >
      <body className="min-h-full font-body text-zinc-950">
        <UiSettingsProvider initialLanguage={language} initialTheme={theme}>
          {children}
        </UiSettingsProvider>
      </body>
    </html>
  );
}
