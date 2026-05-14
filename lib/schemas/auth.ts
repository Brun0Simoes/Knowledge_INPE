import { z } from "zod";

import { sanitizePlainText } from "@/lib/utils";

const loginEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Informe um e-mail valido");

const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter no minimo 8 caracteres")
  .max(64, "A senha precisa ter no maximo 64 caracteres");

export const loginSchema = z.object({
  email: loginEmailSchema,
  password: passwordSchema,
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .transform(sanitizePlainText)
      .pipe(
        z
          .string()
          .min(3, "Informe seu nome completo")
          .max(80, "Use no maximo 80 caracteres"),
      ),
    email: loginEmailSchema.refine(isPublicRegistrationEmail, {
      message: "Use um e-mail valido para criar a conta",
    }),
    password: passwordSchema,
    confirmPassword: z
      .string()
      .min(8, "Confirme a senha com no minimo 8 caracteres")
      .max(64, "A confirmacao precisa ter no maximo 64 caracteres"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas nao coincidem",
  });

export const passwordResetRequestSchema = z.object({
  email: loginEmailSchema,
});

export const passwordResetConfirmSchema = z
  .object({
    email: loginEmailSchema,
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Informe o codigo de 6 digitos"),
    password: passwordSchema,
    confirmPassword: z
      .string()
      .min(8, "Confirme a senha com no minimo 8 caracteres")
      .max(64, "A confirmacao precisa ter no maximo 64 caracteres"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas nao coincidem",
  });

function isPublicRegistrationEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();

  if (!domain) {
    return false;
  }

  return !(
    domain === "localhost" ||
    domain.endsWith(".local") ||
    domain.endsWith(".test") ||
    domain === "example.com" ||
    domain === "example.org" ||
    domain === "example.net"
  );
}
