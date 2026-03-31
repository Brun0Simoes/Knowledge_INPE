"use client";

import { Rocket } from "lucide-react";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { Button } from "@/components/ui/button";

type PublishCourseButtonProps = {
  courseId: string;
};

export function PublishCourseButton({ courseId }: PublishCourseButtonProps) {
  const router = useRouter();
  const { messages } = useUiSettings();
  const [pending, setPending] = useState(false);

  async function publishCourse() {
    setPending(true);
    await fetch(`/api/courses/${courseId}/publish`, {
      method: "POST",
    });
    startTransition(() => {
      router.refresh();
    });
    setPending(false);
  }

  return (
    <Button type="button" variant="default" disabled={pending} onClick={publishCourse}>
      <Rocket className="h-4 w-4" />
      {messages.publications.publishAction}
    </Button>
  );
}
