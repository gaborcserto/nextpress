import { NextResponse } from "next/server";

const timeoutMilliseconds = 3_000;

export async function GET() {
  const origin = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;

  if (!origin) {
    return NextResponse.json({ available: false });
  }

  try {
    await fetch(origin, {
      method: "HEAD",
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMilliseconds),
    });

    return NextResponse.json({ available: true });
  } catch {
    return NextResponse.json({ available: false });
  }
}
