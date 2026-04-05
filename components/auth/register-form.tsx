"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailPlus } from "lucide-react";
import { signIn } from "next-auth/react";
import { startTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { Label } from "@/components/ui/label";
import { registerSchema } from "@/lib/schemas/auth";
import { getClientRedirectUrl, getSafeCallbackUrl } from "@/lib/utils";

const registerClientSchema = registerSchema;
type RegisterValues = z.input<typeof registerClientSchema>;

type RegisterFormProps = {
  callbackUrl?: string | null;
};

export function RegisterForm({ callbackUrl }: RegisterFormProps) {
  const safeCallbackUrl = getSafeCallbackUrl(callbackUrl);
  const { messages } = useUiSettings();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerClientSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      notificationOptIn: true,
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(values),
        });

        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          setError(payload?.error ?? messages.auth.registerError);
          return;
        }

        const result = await signIn("credentials", {
          email: values.email,
          password: values.password,
          callbackUrl: safeCallbackUrl,
          redirect: false,
        });

        if (result?.error) {
          setError(messages.auth.autoSignInError);
          return;
        }

        window.location.href = getClientRedirectUrl(result?.url, safeCallbackUrl);
      } catch {
        setError(messages.auth.registerError);
      }
    });
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="name">{messages.auth.nameLabel}</Label>
        <Input id="name" autoComplete="name" {...form.register("name")} />
        {form.formState.errors.name ? (
          <p className="text-sm text-rose-600">{form.formState.errors.name.message}</p>
        ) : null}
      </div>

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
          autoComplete="new-password"
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-sm text-rose-600">{form.formState.errors.password.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{messages.auth.confirmPasswordLabel}</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...form.register("confirmPassword")}
        />
        {form.formState.errors.confirmPassword ? (
          <p className="text-sm text-rose-600">{form.formState.errors.confirmPassword.message}</p>
        ) : null}
      </div>

      <label className="flex items-start gap-3 rounded-3xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-white/10 dark:bg-[#102132] dark:text-zinc-300">
        <input
          className="mt-1 h-4 w-4 rounded border-zinc-300 bg-white text-teal-600 accent-teal-600 dark:border-white/16 dark:bg-[#08111b] dark:accent-teal-400"
          type="checkbox"
          {...form.register("notificationOptIn")}
        />
        {messages.auth.notificationOptIn}
      </label>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <Button className="w-full" disabled={form.formState.isSubmitting} type="submit">
        <MailPlus className="h-4 w-4" />
        {messages.auth.registerButton}
      </Button>
    </form>
  );
}
