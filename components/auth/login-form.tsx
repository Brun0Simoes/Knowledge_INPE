"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, Sparkles } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { startTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { Label } from "@/components/ui/label";
import { withBasePath } from "@/lib/base-path";
import { loginSchema } from "@/lib/schemas/auth";
import { getClientRedirectUrl, getSafeCallbackUrl } from "@/lib/utils";

type LoginValues = z.infer<typeof loginSchema>;

type LoginFormProps = {
  callbackUrl?: string | null;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const safeCallbackUrl = getSafeCallbackUrl(callbackUrl);
  const signInCallbackUrl = withBasePath(safeCallbackUrl);
  const { messages } = useUiSettings();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    setError(null);

    startTransition(async () => {
      try {
        const result = await signIn("credentials", {
          ...values,
          callbackUrl: signInCallbackUrl,
          redirect: false,
        });

        if (result?.error) {
          setError(messages.auth.invalidCredentials);
          return;
        }

        window.location.href = getClientRedirectUrl(result?.url, signInCallbackUrl);
      } catch {
        setError(messages.auth.invalidCredentials);
      }
    });
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="email">{messages.auth.emailLabel}</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        {form.formState.errors.email ? (
          <p className="text-sm text-rose-600">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{messages.auth.passwordLabel}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-sm text-rose-600">{form.formState.errors.password.message}</p>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Link
          className="text-sm font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-200 dark:hover:text-teal-100"
          href="/forgot-password"
        >
          {messages.auth.forgotPasswordLink}
        </Link>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <Button className="w-full" disabled={form.formState.isSubmitting} type="submit">
        <LogIn className="h-4 w-4" />
        {messages.auth.signInButton}
      </Button>

      <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-[#102132] dark:text-zinc-300">
        <div className="mb-2 flex items-center gap-2 font-semibold text-zinc-800 dark:text-zinc-100">
          <Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-200" />
          {messages.auth.supportTitle}
        </div>
        {messages.auth.supportDescription}
      </div>
    </form>
  );
}
