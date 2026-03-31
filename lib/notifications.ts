import { NotificationType, type Course, type User } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const NOTIFICATION_INSERT_CHUNK_SIZE = 200;

type CoursePublicationNotificationPayload = {
  course: Pick<Course, "id" | "slug" | "title" | "summary">;
  createdById: string;
  recipients: Array<Pick<User, "id">>;
};

export async function createCoursePublicationNotification({
  course,
  createdById,
  recipients,
}: CoursePublicationNotificationPayload) {
  return prisma.$transaction(async (tx) => {
    const notification = await tx.notification.create({
      data: {
        type: NotificationType.COURSE_PUBLISHED,
        title: "Novo curso publicado",
        body: `${course.title} foi publicado na knowledge.`,
        href: `/courses/${course.slug}`,
        courseId: course.id,
        createdById,
      },
    });

    for (const chunk of chunkArray(dedupeRecipients(recipients), NOTIFICATION_INSERT_CHUNK_SIZE)) {
      await tx.userNotification.createMany({
        data: chunk.map((recipient) => ({
          notificationId: notification.id,
          userId: recipient.id,
        })),
      });
    }

    return notification;
  });
}

function dedupeRecipients(recipients: CoursePublicationNotificationPayload["recipients"]) {
  return Array.from(new Map(recipients.map((recipient) => [recipient.id, recipient])).values());
}

function chunkArray<T>(items: T[], chunkSize: number) {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}
