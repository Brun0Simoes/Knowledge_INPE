const DEVELOPMENT_AUTH_SECRET = "dev-secret-change-me";
const WEAK_AUTH_SECRETS = new Set([
  DEVELOPMENT_AUTH_SECRET,
  "build-secret-change-me",
  "troque-esta-chave-em-producao",
]);

export function getAuthSecret() {
  const configuredSecret = process.env.NEXTAUTH_SECRET?.trim();
  const isProductionRuntime =
    process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";

  if (isProductionRuntime && (!configuredSecret || WEAK_AUTH_SECRETS.has(configuredSecret))) {
    throw new Error("NEXTAUTH_SECRET precisa ser definido com um valor forte em producao.");
  }

  return configuredSecret || DEVELOPMENT_AUTH_SECRET;
}

export function isWeakSharedSecret(value?: string | null) {
  const normalized = value?.trim();
  return !normalized || WEAK_AUTH_SECRETS.has(normalized);
}
