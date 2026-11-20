"use client";

import AdminError from "../error";

export default function AdminRouteError(props: {
  error: unknown;
  retry: () => void;
}) {
  return <AdminError {...props} insideShell />;
}
