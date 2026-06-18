"use client";

import type { Session } from "next-auth";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

import { APP_BASE_PATH } from "@/lib/base-path";

type SessionProviderProps = {
  children: React.ReactNode;
  session: Session | null;
};

export function SessionProvider({ children, session }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider basePath={`${APP_BASE_PATH}/api/auth`} session={session}>
      {children}
    </NextAuthSessionProvider>
  );
}
