"use client";

import { ExternalLink } from "lucide-react";

import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { Button } from "@/components/ui/button";

type CourseVisitButtonProps = {
  courseId: string;
  courseUrl: string;
};

export function CourseVisitButton({ courseId, courseUrl }: CourseVisitButtonProps) {
  const { messages } = useUiSettings();

  async function handleClick() {
    await fetch(`/api/courses/${courseId}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "CLICK_EXTERNAL" }),
      keepalive: true,
    }).catch(() => undefined);

    window.open(courseUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Button className="w-full sm:w-auto" size="lg" type="button" onClick={handleClick}>
      <ExternalLink className="h-4 w-4" />
      {messages.course.continueInMoodle}
    </Button>
  );
}
