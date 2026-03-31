import Link from "next/link";

import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { APP_NAME } from "@/lib/constants";
import { getServerLanguage } from "@/lib/server-preferences";
import { getMessages } from "@/lib/ui-settings";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const language = await getServerLanguage();
  const messages = getMessages(language);

  return (
    <div className="auth-atmosphere grain-overlay min-h-screen overflow-hidden">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col justify-between px-6 py-8 lg:px-10">
        <header className="flex flex-col gap-4 text-white lg:flex-row lg:items-start lg:justify-between">
          <Link className="font-heading text-xl tracking-[0.24em]" href="/login">
            {APP_NAME}
          </Link>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap gap-2">
              <ThemeToggle
                variant="outline"
                className="border-white/60 bg-white/82 text-[#122033] shadow-lg shadow-black/10 hover:border-white hover:bg-white dark:border-white/16 dark:bg-[#112437]/92 dark:text-white dark:hover:bg-[#173149]"
              />
              <LanguageSwitcher
                variant="outline"
                className="border-white/60 bg-white/82 text-[#122033] shadow-lg shadow-black/10 hover:border-white hover:bg-white dark:border-white/16 dark:bg-[#112437]/92 dark:text-white dark:hover:bg-[#173149]"
              />
            </div>
          </div>
        </header>

        <main className="grid gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <section className="soft-grid rounded-[40px] border border-white/10 bg-[#122033]/72 p-8 text-white shadow-[0_40px_140px_-60px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
            <div className="space-y-8">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.38em] text-white/58">{messages.auth.heroEyebrow}</p>
                <h1 className="font-heading text-5xl leading-[0.95] sm:text-6xl">
                  {messages.auth.heroTitle}
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-white/76">
                  {messages.auth.heroDescription}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.28em] text-white/68">
                {messages.auth.heroTopics.map((topic) => (
                  <span key={topic} className="rounded-full border border-white/12 bg-white/8 px-4 py-3">
                    {topic}
                  </span>
                ))}
              </div>

              <div className="max-w-xl rounded-[28px] border border-white/10 bg-black/10 p-5 text-sm leading-7 text-white/70">
                {messages.auth.heroFootnote}
              </div>
            </div>
          </section>

          <section className="paper-panel rounded-[36px] border border-white/60 p-6 shadow-[0_40px_140px_-48px_rgba(15,23,42,0.55)] backdrop-blur sm:p-8">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}
