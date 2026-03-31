import { CourseEventType } from "@prisma/client";
import { z } from "zod";

import { sanitizeLongText } from "@/lib/utils";

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "A nota minima e 1").max(5, "A nota maxima e 5"),
  body: z
    .string()
    .optional()
    .transform((value) => {
      const sanitized = sanitizeLongText(value ?? "");
      return sanitized || undefined;
    })
    .refine((value) => !value || value.length <= 400, {
      message: "Use no maximo 400 caracteres",
    }),
});

export const commentSchema = z.object({
  body: z
    .string()
    .transform(sanitizeLongText)
    .pipe(z.string().min(5, "Escreva ao menos 5 caracteres").max(600)),
});

export const courseEventSchema = z.object({
  type: z.nativeEnum(CourseEventType),
});

export const notificationPreferenceSchema = z.object({
  notificationOptIn: z.boolean(),
});

export const notificationReadSchema = z.object({
  read: z.boolean(),
});
