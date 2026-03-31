"use client";

import { useEffect } from "react";

type RecordCourseViewProps = {
  courseId: string;
};

export function RecordCourseView({ courseId }: RecordCourseViewProps) {
  useEffect(() => {
    fetch(`/api/courses/${courseId}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "VIEW" }),
    }).catch(() => undefined);
  }, [courseId]);

  return null;
}
