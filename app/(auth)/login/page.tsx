import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { getServerLanguage } from "@/lib/server-preferences";
import { getMessages } from "@/lib/ui-settings";

type PageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const language = await getServerLanguage();
  const messages = getMessages(language);
  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">{messages.auth.loginEyebrow}</p>
        <h2 className="font-heading text-4xl text-zinc-950 dark:text-zinc-100">{messages.auth.loginTitle}</h2>
      </div>

      <LoginForm callbackUrl={resolvedSearchParams.callbackUrl} googleEnabled={googleEnabled} />

      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {messages.auth.noAccount}{" "}
        <Link className="font-semibold text-teal-700 dark:text-teal-200" href="/register">
          {messages.auth.createAccount}
        </Link>
      </p>
    </div>
  );
}
