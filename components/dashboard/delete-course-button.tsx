"use client";

import { CourseStatus } from "@prisma/client";
import { Trash2 } from "lucide-react";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";

const deleteCourseLabels = {
  "pt-BR": {
    draftAction: "Excluir rascunho",
    courseAction: "Excluir curso",
    draftConfirm: "Excluir este rascunho permanentemente?",
    courseConfirm: "Excluir este curso permanentemente? Ele saira das dashboards e do calendario.",
    error: "Nao foi possivel excluir o curso.",
  },
  en: {
    draftAction: "Delete draft",
    courseAction: "Delete course",
    draftConfirm: "Delete this draft permanently?",
    courseConfirm: "Delete this course permanently? It will be removed from dashboards and the calendar.",
    error: "Could not delete the course.",
  },
  es: {
    draftAction: "Eliminar borrador",
    courseAction: "Eliminar curso",
    draftConfirm: "Eliminar este borrador de forma permanente?",
    courseConfirm: "Eliminar este curso de forma permanente? Saldra de los paneles y del calendario.",
    error: "No fue posible eliminar el curso.",
  },
} as const;

type DeleteCourseButtonProps = {
  courseId: string;
  courseTitle: string;
  courseStatus: CourseStatus;
  redirectTo?: string;
};

export function DeleteCourseButton({
  courseId,
  courseTitle,
  courseStatus,
  redirectTo = "/admin/courses",
}: DeleteCourseButtonProps) {
  const router = useRouter();
  const { language } = useUiSettings();
  const labels = deleteCourseLabels[language] ?? deleteCourseLabels["pt-BR"];
  const [pending, setPending] = useState(false);
  const isDraft = courseStatus === CourseStatus.DRAFT;

  async function deleteCourse() {
    const confirmed = window.confirm(
      `${isDraft ? labels.draftConfirm : labels.courseConfirm}\n\n${courseTitle}`,
    );

    if (!confirmed) {
      return;
    }

    setPending(true);

    const response = await fetch(withBasePath(`/api/courses/${courseId}`), {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      window.alert(payload?.error ?? labels.error);
      setPending(false);
      return;
    }

    startTransition(() => {
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="danger" disabled={pending} onClick={deleteCourse}>
      <Trash2 className="h-4 w-4" />
      {isDraft ? labels.draftAction : labels.courseAction}
    </Button>
  );
}
