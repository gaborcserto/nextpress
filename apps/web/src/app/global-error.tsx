"use client";

import { publicSkinId, resolvePublicSkin, resolveColorMode } from "@/lib/skin";

import PublicError from "./error";
import "./globals.css";
import "./skins/default.css";

export default function GlobalError(props: {
  error: unknown;
  retry: () => void;
}) {
  const skin = resolvePublicSkin(publicSkinId);

  return (
    <html
      lang="en"
      data-skin={skin.id}
      data-color-mode={resolveColorMode(skin)}
    >
      <body>
        <PublicError {...props} />
      </body>
    </html>
  );
}
