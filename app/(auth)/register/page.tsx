import Link from "next/link";

import { RegisterForm } from "@/components/auth/register-form";
import { getServerLanguage } from "@/lib/server-preferences";
import { getMessages } from "@/lib/ui-settings";

type PageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function RegisterPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const language = await getServerLanguage();
  const messages = getMessages(language);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">{messages.auth.registerEyebrow}</p>
        <h2 className="font-heading text-4xl text-zinc-950 dark:text-zinc-100">{messages.auth.registerTitle}</h2>
        <p className="text-base leading-7 text-zinc-600 dark:text-zinc-300">
          {messages.auth.registerDescription}
        </p>
      </div>

      <RegisterForm callbackUrl={resolvedSearchParams.callbackUrl} />

      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {messages.auth.haveAccount}{" "}
        <Link className="font-semibold text-teal-700 dark:text-teal-200" href="/login">
          {messages.auth.signInLink}
        </Link>
      </p>
    </div>
  );
}
