"use client";

import Link from "next/link";

import { Button } from "@/ui/primitives/Buttons/Buttons";

const copy = {
  404: [
    "Page not found",
    "The requested administration page could not be found.",
  ],
  500: [
    "Unable to load the administration",
    "Please try again, or return to the dashboard.",
  ],
  503: [
    "Service temporarily unavailable",
    "Please wait a moment and try again.",
  ],
};

export function AdminErrorPage({
  status,
  retry,
  insideShell = false,
}: {
  status: keyof typeof copy;
  retry?: () => void;
  insideShell?: boolean;
}) {
  const [title, description] = copy[status];
  const content = (
    <section aria-labelledby="admin-error-title">
      {!insideShell && <p className="admin-wordmark">NextPress</p>}
      <p className="my-3 text-5xl font-bold text-primary">{status}</p>
      <h1 id="admin-error-title" className="admin-page-title">
        {title}
      </h1>
      <p className="admin-page-description">{description}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {retry && (
          <Button type="button" color="primary" onClick={retry}>
            Try again
          </Button>
        )}
        <Link href="/admin" className="btn btn-outline" prefetch={false}>
          Back to dashboard
        </Link>
      </div>
    </section>
  );

  if (insideShell) {
    return (
      <div className="grid place-items-center p-8 text-center">{content}</div>
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-base-200 p-6 text-center">
      {content}
    </main>
  );
}
