"use client";

import Link from "next/link";

import styles from "./public-state.module.css";
import { activeSkin, resolveColorMode } from "@/lib/skin";
import "./globals.css";
import "./skins/default.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" data-skin={activeSkin.id} data-color-mode={resolveColorMode(activeSkin)}>
      <body>
        <main className={styles.state}>
          <h1>This page could not be loaded</h1>
          <p>Please try again, or continue to another part of the site.</p>
          <div className={styles.actions}>
            <button type="button" onClick={reset}>Try again</button>
            <Link href="/">Home</Link>
            <Link href="/posts">Posts</Link>
          </div>
        </main>
      </body>
    </html>
  );
}
