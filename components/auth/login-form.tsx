"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, Orbit, Sparkles } from "lucide-react";
import { signIn } from "next-auth/react";
import { startTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { Label } from "@/components/ui/label";
import { loginSchema } from "@/lib/schemas/auth";
import { getClientRedirectUrl, getSafeCallbackUrl } from "@/lib/utils";

type LoginValues = z.infer<typeof loginSchema>;

type LoginFormProps = {
  callbackUrl?: string | null;
  googleEnabled: boolean;
};

export function LoginForm({ callbackUrl, googleEnabled }: LoginFormProps) {
  const safeCallbackUrl = getSafeCallbackUrl(callbackUrl);
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
          callbackUrl: safeCallbackUrl,
          redirect: false,
        });

        if (result?.error) {
          setError(messages.auth.invalidCredentials);
          return;
        }

        window.location.href = getClientRedirectUrl(result?.url, safeCallbackUrl);
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

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <Button className="w-full" disabled={form.formState.isSubmitting} type="submit">
        <LogIn className="h-4 w-4" />
        {messages.auth.signInButton}
      </Button>

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="h-px w-full bg-zinc-200 dark:bg-white/10" />
        </div>
        <p className="relative mx-auto w-fit bg-white px-3 text-xs uppercase tracking-[0.22em] text-zinc-400 dark:bg-[#14263a] dark:text-zinc-500">
          {messages.auth.altAccessLabel}
        </p>
      </div>

      <Button
        className="w-full"
        disabled={!googleEnabled}
        type="button"
        variant="outline"
        onClick={() => signIn("google", { callbackUrl: safeCallbackUrl })}
      >
        <Orbit className="h-4 w-4" />
        {googleEnabled ? messages.auth.googleSignIn : messages.auth.googleUnavailable}
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
