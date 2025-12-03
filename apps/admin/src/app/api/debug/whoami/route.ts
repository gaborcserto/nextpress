import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth-server";

export async function GET() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const all = cookieStore.getAll().map((c) => ({
    name: c.name,
    value: (c.value ?? "").slice(0, 10) + "…",
  }));

  const session = await auth.api.getSession({ headers: await headers() });

  return NextResponse.json({
    ok: !!session,
    user: session?.user ?? null,
    cookieNames: all.map((c) => c.name),
    hasSessionCookie: all.some((c) =>
        /(better-auth|authjs|session-token)/i.test(c.name)
    ),
    host: headerStore.get("host"),
  });
}

