import { z } from "zod";

import { isHttpsUrl, sanitizeLongText, sanitizePlainText } from "@/lib/utils";

const optionalCourseDateTimeSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? new Date(trimmed) : null;
}, z.date({ error: "Informe uma data e hora validas" }).nullable());

export const courseInputSchema = z
  .object({
    title: z
      .string()
      .transform(sanitizePlainText)
      .pipe(z.string().min(5, "O titulo precisa ter no minimo 5 caracteres").max(120)),
    summary: z
      .string()
      .transform(sanitizePlainText)
      .pipe(z.string().min(20, "O resumo precisa ter no minimo 20 caracteres").max(220)),
    description: z
      .string()
      .transform(sanitizeLongText)
      .pipe(z.string().min(60, "A descricao precisa ter no minimo 60 caracteres").max(4000)),
    externalUrl: z
      .string()
      .trim()
      .url("Informe uma URL valida")
      .refine(isHttpsUrl, "Utilize um link HTTPS"),
    startsAt: optionalCourseDateTimeSchema,
    endsAt: optionalCourseDateTimeSchema,
    isFeatured: z.boolean().default(false),
    imageUrls: z
      .array(
        z
          .string()
          .trim()
          .url("Cada imagem externa precisa ser uma URL valida")
          .refine(isHttpsUrl, "Imagens externas precisam usar HTTPS"),
      )
      .max(8, "Use no maximo 8 URLs de imagem"),
  })
  .superRefine((data, context) => {
    if (data.endsAt && !data.startsAt) {
      context.addIssue({
        code: "custom",
        message: "Informe a data de inicio do curso antes da data de termino.",
        path: ["startsAt"],
      });
    }

    if (data.startsAt && data.endsAt && data.endsAt < data.startsAt) {
      context.addIssue({
        code: "custom",
        message: "A data de termino precisa ser posterior ao inicio do curso.",
        path: ["endsAt"],
      });
    }
  });
