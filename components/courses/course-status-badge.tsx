import type { Messages } from "@/lib/ui-settings";
import { CourseStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";

type CourseStatusBadgeProps = {
  status: CourseStatus;
  labels?: Messages["common"];
};

export function CourseStatusBadge({ status, labels }: CourseStatusBadgeProps) {
  if (status === CourseStatus.PUBLISHED) {
    return <Badge variant="success">{labels?.published ?? "Publicado"}</Badge>;
  }

  if (status === CourseStatus.ARCHIVED) {
    return <Badge variant="muted">{labels?.archived ?? "Arquivado"}</Badge>;
  }

  return <Badge variant="warning">{labels?.draft ?? "Rascunho"}</Badge>;
}
