"use client";

import { useEffect } from "react";

import { withBasePath } from "@/lib/base-path";

type RecordCourseViewProps = {
  courseId: string;
  enabled?: boolean;
};

export function RecordCourseView({ courseId, enabled = true }: RecordCourseViewProps) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    fetch(withBasePath(`/api/courses/${courseId}/events`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "VIEW" }),
    }).catch(() => undefined);
  }, [courseId, enabled]);

  return null;
}
