"use client";

import { BellRing } from "lucide-react";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { Button } from "@/components/ui/button";

type NotificationToggleProps = {
  initialValue: boolean;
};

export function NotificationToggle({ initialValue }: NotificationToggleProps) {
  const router = useRouter();
  const { messages } = useUiSettings();
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);

  async function updatePreference(nextValue: boolean) {
    setPending(true);

    const response = await fetch("/api/profile/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ notificationOptIn: nextValue }),
    });

    if (response.ok) {
      setValue(nextValue);
      startTransition(() => {
        router.refresh();
      });
    }

    setPending(false);
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => updatePreference(!value)}
      disabled={pending}
    >
      <BellRing className="h-4 w-4" />
      {value ? messages.preferences.disableEmailAlerts : messages.preferences.enableEmailAlerts}
    </Button>
  );
}
