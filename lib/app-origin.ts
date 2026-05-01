import "server-only";

const DEFAULT_APP_ORIGIN = "http://localhost:3000";
const ALLOWED_APP_ORIGIN_PROTOCOLS = new Set(["http:", "https:"]);

export function getConfiguredAppOrigin() {
  const rawOrigin = process.env.NEXTAUTH_URL?.trim() || DEFAULT_APP_ORIGIN;

  try {
    const parsed = new URL(rawOrigin);

    if (!ALLOWED_APP_ORIGIN_PROTOCOLS.has(parsed.protocol)) {
      throw new Error("Invalid application origin protocol.");
    }

    return parsed.origin;
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXTAUTH_URL precisa ser uma origem http(s) valida.");
    }

    return DEFAULT_APP_ORIGIN;
  }
}
