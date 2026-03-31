import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";

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

export function unauthorized(message = "Nao autenticado.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Acesso restrito.") {
  return NextResponse.json({ error: message }, { status: 403 });
}
