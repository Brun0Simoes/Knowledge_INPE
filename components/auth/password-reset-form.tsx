"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { withBasePath } from "@/lib/base-path";
import {
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
} from "@/lib/schemas/auth";

type RequestValues = z.input<typeof passwordResetRequestSchema>;
type ConfirmValues = z.input<typeof passwordResetConfirmSchema>;
type ResetStep = "request" | "confirm";

type ApiPayload = {
  error?: string;
  message?: string;
};

export function PasswordResetForm() {
  const { messages } = useUiSettings();
  const [step, setStep] = useState<ResetStep>("request");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const requestForm = useForm<RequestValues>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: {
      email: "",
    },
  });

  const confirmForm = useForm<ConfirmValues>({
    resolver: zodResolver(passwordResetConfirmSchema),
    defaultValues: {
      email: "",
      code: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleRequestCode = requestForm.handleSubmit(async (values) => {
    setError(null);
    setNotice(null);
    setCompleted(false);

    try {
      const response = await fetch(withBasePath("/api/auth/password-reset/request"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload | null;

      if (!response.ok) {
        setError(payload?.error ?? messages.auth.resetRequestError);
        return;
      }

      confirmForm.reset({
        email: values.email,
        code: "",
        password: "",
        confirmPassword: "",
      });
      setStep("confirm");
      setNotice(payload?.message ?? messages.auth.resetCodeSent);
    } catch {
      setError(messages.auth.resetRequestError);
    }
  });

  const handleConfirmCode = confirmForm.handleSubmit(async (values) => {
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(withBasePath("/api/auth/password-reset/confirm"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload | null;

      if (!response.ok) {
        setError(payload?.error ?? messages.auth.resetConfirmError);
        return;
      }

      confirmForm.reset({
        email: values.email,
        code: "",
        password: "",
        confirmPassword: "",
      });
      setCompleted(true);
      setNotice(payload?.message ?? messages.auth.resetSuccess);
    } catch {
      setError(messages.auth.resetConfirmError);
    }
  });

  if (completed) {
    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-teal-200 bg-teal-50 p-5 text-sm leading-7 text-teal-900 dark:border-teal-300/20 dark:bg-teal-950/30 dark:text-teal-100">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            {messages.auth.resetSuccess}
          </div>
          {notice}
        </div>
        <Button asChild className="w-full">
          <Link href="/login">
            <KeyRound className="h-4 w-4" />
            {messages.auth.signInLink}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 rounded-full bg-zinc-100 p-1 text-xs font-semibold text-zinc-500 dark:bg-[#102132] dark:text-zinc-400">
        <span
          className={
            step === "request"
              ? "rounded-full bg-white px-3 py-2 text-center text-zinc-950 shadow-sm dark:bg-[#173149] dark:text-zinc-100"
              : "px-3 py-2 text-center"
          }
        >
          {messages.auth.resetStepEmail}
        </span>
        <span
          className={
            step === "confirm"
              ? "rounded-full bg-white px-3 py-2 text-center text-zinc-950 shadow-sm dark:bg-[#173149] dark:text-zinc-100"
              : "px-3 py-2 text-center"
          }
        >
          {messages.auth.resetStepCode}
        </span>
      </div>

      {step === "request" ? (
        <form className="space-y-5" onSubmit={handleRequestCode}>
          <div className="space-y-2">
            <Label htmlFor="reset-email">{messages.auth.emailLabel}</Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              {...requestForm.register("email")}
            />
            {requestForm.formState.errors.email ? (
              <p className="text-sm text-rose-600">
                {requestForm.formState.errors.email.message}
              </p>
            ) : null}
          </div>

          {notice ? <p className="text-sm text-teal-700 dark:text-teal-200">{notice}</p> : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <Button
            className="w-full"
            disabled={requestForm.formState.isSubmitting}
            type="submit"
          >
            <MailCheck className="h-4 w-4" />
            {messages.auth.resetSendCodeButton}
          </Button>
        </form>
      ) : (
        <form className="space-y-5" onSubmit={handleConfirmCode}>
          {notice ? (
            <div className="rounded-3xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-900 dark:border-teal-300/20 dark:bg-teal-950/30 dark:text-teal-100">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <MailCheck className="h-4 w-4" />
                {messages.auth.resetStepCode}
              </div>
              {notice}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="confirm-email">{messages.auth.emailLabel}</Label>
            <Input
              id="confirm-email"
              type="email"
              autoComplete="email"
              {...confirmForm.register("email")}
            />
            {confirmForm.formState.errors.email ? (
              <p className="text-sm text-rose-600">
                {confirmForm.formState.errors.email.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-code">{messages.auth.resetCodeLabel}</Label>
            <Input
              id="reset-code"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              {...confirmForm.register("code")}
            />
            {confirmForm.formState.errors.code ? (
              <p className="text-sm text-rose-600">
                {confirmForm.formState.errors.code.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">{messages.auth.resetNewPasswordLabel}</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              {...confirmForm.register("password")}
            />
            {confirmForm.formState.errors.password ? (
              <p className="text-sm text-rose-600">
                {confirmForm.formState.errors.password.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">{messages.auth.confirmPasswordLabel}</Label>
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              {...confirmForm.register("confirmPassword")}
            />
            {confirmForm.formState.errors.confirmPassword ? (
              <p className="text-sm text-rose-600">
                {confirmForm.formState.errors.confirmPassword.message}
              </p>
            ) : null}
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <Button
              disabled={confirmForm.formState.isSubmitting}
              type="button"
              variant="outline"
              onClick={() => {
                setStep("request");
                setError(null);
                setNotice(null);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              {messages.auth.resetBackToLogin}
            </Button>
            <Button
              className="w-full"
              disabled={confirmForm.formState.isSubmitting}
              type="submit"
            >
              <ShieldCheck className="h-4 w-4" />
              {messages.auth.resetConfirmButton}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
