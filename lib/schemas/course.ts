import { z } from "zod";

import { isHttpsUrl, sanitizeLongText, sanitizePlainText } from "@/lib/utils";

export const courseInputSchema = z.object({
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
});
