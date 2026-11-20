"use client";

import { isServiceUnavailable } from "@nextpress/shared/service-unavailable";

import { AdminErrorPage } from "./AdminErrorPage";

export default function AdminError({
  error,
  retry,
  insideShell = false,
}: {
  error: unknown;
  retry: () => void;
  insideShell?: boolean;
}) {
  const unavailable = isServiceUnavailable(error);

  return (
    <AdminErrorPage
      status={unavailable ? 503 : 500}
      retry={retry}
      insideShell={insideShell}
    />
  );
}
