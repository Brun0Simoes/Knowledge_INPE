import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";

// Server components use redirects so protected pages never render partial content
// for anonymous users before the auth check completes.
export async function requirePageUser() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return session.user;
}

export async function requireAdminPage() {
  const user = await requirePageUser();

  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return user;
}

export async function getApiUser() {
  const session = await getServerAuthSession();
  return session?.user ?? null;
}

// Route handlers share the same small JSON helpers so auth failures stay consistent
// across the API surface.
export function unauthorized(message = "Nao autenticado.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Acesso restrito.") {
  return NextResponse.json({ error: message }, { status: 403 });
}
