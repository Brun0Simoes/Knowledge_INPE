import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";

import { getAuthSecret } from "@/lib/auth-secret";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/schemas/auth";

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);
const SESSION_PROFILE_SYNC_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_ATTEMPTS = 8;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: getAuthSecret(),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email e senha",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const normalizedEmail = parsed.data.email.trim().toLowerCase();
        const rateLimitKey = `login:${normalizedEmail}`;
        const rateLimit = checkRateLimit(rateLimitKey, {
          limit: LOGIN_RATE_LIMIT_ATTEMPTS,
          windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
        });

        if (!rateLimit.allowed) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const isValid = await compare(parsed.data.password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        clearRateLimit(rateLimitKey);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          notificationOptIn: user.notificationOptIn,
        };
      },
    }),
    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in we hydrate the JWT with the fields used throughout the UI.
      if (user) {
        token.role = user.role;
        token.notificationOptIn = user.notificationOptIn;
        token.profileSyncedAt = Date.now();
      }

      // Session reads happen on nearly every protected request. Refreshing the token
      // from Prisma on a short window keeps role/notification state fresh without
      // forcing a database roundtrip on every single render.
      if (
        token.sub &&
        (!token.profileSyncedAt ||
          Date.now() - token.profileSyncedAt > SESSION_PROFILE_SYNC_WINDOW_MS)
      ) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            name: true,
            image: true,
            role: true,
            notificationOptIn: true,
          },
        });

        if (dbUser) {
          token.name = dbUser.name;
          token.picture = dbUser.image;
          token.role = dbUser.role;
          token.notificationOptIn = dbUser.notificationOptIn;
          token.profileSyncedAt = Date.now();
        }
      }

      return token;
    },
    async session({ session, token }) {
      // The session object is the server/client contract consumed by layouts, route
      // guards and interactive widgets.
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role ?? "USER";
        session.user.notificationOptIn = Boolean(token.notificationOptIn);
      }

      return session;
    },
  },
};

export function getServerAuthSession() {
  return getServerSession(authOptions);
}
