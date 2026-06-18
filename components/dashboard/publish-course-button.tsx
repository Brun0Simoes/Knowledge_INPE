"use client";

import { Rocket } from "lucide-react";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";

type PublishCourseButtonProps = {
  courseId: string;
};

export function PublishCourseButton({ courseId }: PublishCourseButtonProps) {
  const router = useRouter();
  const { messages } = useUiSettings();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publishCourse() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(withBasePath(`/api/courses/${courseId}/publish`), {
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Nao foi possivel publicar o curso.");
        setPending(false);
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("Nao foi possivel publicar o curso.");
    }

    setPending(false);
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="default" disabled={pending} onClick={publishCourse}>
        <Rocket className="h-4 w-4" />
        {messages.publications.publishAction}
      </Button>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
