"use client";

import Link from "next/link";

import styles from "./public-state.module.css";
import { ActionButton } from "@/components/public-ui/ActionButton";
import { publicSkinId, resolvePublicSkin, resolveColorMode } from "@/lib/skin";
import "./globals.css";
import "./skins/default.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const skin = resolvePublicSkin(publicSkinId);
  return (
    <html lang="en" data-skin={skin.id} data-color-mode={resolveColorMode(skin)}>
      <body>
        <main className={styles.state}>
          <h1>This page could not be loaded</h1>
          <p>Please try again, or continue to another part of the site.</p>
          <div className={styles.actions}>
            <ActionButton type="button" onClick={reset}>Try again</ActionButton>
            <Link href="/">Home</Link>
            <Link href="/posts">Posts</Link>
          </div>
        </main>
      </body>
    </html>
  );
}
