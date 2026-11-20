"use client";

import { adminSkinId } from "@/lib/skin";

import AdminError from "./error";
import "./globals.css";

export default function GlobalError(props: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="en" data-skin={adminSkinId} data-theme="light">
      <body>
        <AdminError {...props} />
      </body>
    </html>
  );
}
