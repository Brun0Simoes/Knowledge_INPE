import { LanguageSwitcher } from "@/components/layout/language-switcher";
import Link from "next/link";

import { NotificationInboxLink } from "@/components/layout/notification-inbox-link";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { requirePageUser } from "@/lib/access";
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
  const userPromise = requirePageUser();
  const unreadNotificationsPromise = userPromise.then((user) =>
    prisma.userNotification.count({
      where: {
        userId: user.id,
        readAt: null,
      },
    }),
  );

  const [language, session, user, unreadNotifications] = await Promise.all([
    languagePromise,
    sessionPromise,
    userPromise,
    unreadNotificationsPromise,
  ]);
  const messages = getMessages(language);

  return (
    <SessionProvider session={session}>
      <div className="app-shell min-h-screen">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
          <header
            className="dashboard-header grain-overlay mb-8 overflow-hidden rounded-[36px] border p-5 text-white shadow-[0_28px_110px_-42px_rgba(15,23,42,0.55)]"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <Link className="font-heading text-2xl tracking-[0.24em]" href="/dashboard">
                  knowledge
                </Link>
                <p className="max-w-2xl text-sm leading-7 text-white/74">
                  {messages.layout.platformTagline}
                </p>
              </div>

              <div className="flex flex-col gap-4 lg:items-end">
                <SidebarNav isAdmin={user.role === "ADMIN"} />
                <div className="flex items-center gap-3">
                  <ThemeToggle />
                  <LanguageSwitcher />
                  <NotificationInboxLink unreadCount={unreadNotifications} />
                  <UserMenu
                    email={user.email ?? ""}
                    image={user.image}
                    name={user.name ?? messages.layout.guestUser}
                    notificationOptIn={user.notificationOptIn}
                    role={user.role}
                  />
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
