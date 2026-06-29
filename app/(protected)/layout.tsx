import { LanguageSwitcher } from "@/components/layout/language-switcher";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { NotificationInboxLink } from "@/components/layout/notification-inbox-link";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { VlabBrandLockup } from "@/components/layout/vlab-brand-lockup";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMessages } from "@/lib/ui-settings";
import { getServerLanguage } from "@/lib/server-preferences";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const languagePromise = getServerLanguage();
  const sessionPromise = getServerAuthSession();

  const [language, session] = await Promise.all([
    languagePromise,
    sessionPromise,
  ]);
  const user = session?.user ?? null;
  const unreadNotifications = user?.id
    ? await prisma.userNotification.count({
        where: {
          userId: user.id,
          readAt: null,
        },
      })
    : 0;
  const messages = getMessages(language);
  const isAuthenticated = Boolean(user?.id);

  return (
    <SessionProvider session={session}>
      <div className="app-shell min-h-screen">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
          <header
            className="dashboard-header grain-overlay mb-8 overflow-hidden rounded-[36px] border p-5 text-white shadow-[0_28px_110px_-42px_rgba(15,23,42,0.55)]"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <Link className="inline-flex flex-wrap items-center gap-4 text-white" href="/dashboard">
                  <VlabBrandLockup logoClassName="h-12 sm:h-14" />
                  <span className="font-heading text-xl tracking-[0.08em] sm:text-2xl">
                    Laboratório Virtual
                  </span>
                </Link>
                <p className="max-w-2xl text-sm leading-7 text-white/74">
                  {messages.layout.platformTagline}
                </p>
              </div>

              <div className="flex flex-col gap-4 lg:items-end">
                <SidebarNav isAdmin={user?.role === "ADMIN"} isAuthenticated={isAuthenticated} />
                <div className="flex items-center gap-3">
                  <ThemeToggle />
                  <LanguageSwitcher />
                  {user ? (
                    <>
                      <NotificationInboxLink unreadCount={unreadNotifications} />
                      <UserMenu
                        email={user.email ?? ""}
                        image={user.image}
                        name={user.name ?? messages.layout.guestUser}
                        role={user.role}
                      />
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <Link href="/login">{messages.auth.signInButton}</Link>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="border-white/80 !bg-white px-4 !text-zinc-950 hover:border-white hover:!bg-[#f6ead6] hover:!text-zinc-950"
                      >
                        <Link href="/register">{messages.auth.createAccount}</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
