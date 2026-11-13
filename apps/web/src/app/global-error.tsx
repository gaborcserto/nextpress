"use client";

import { ActionButton } from "@/components/public-ui/ActionButton";
import { LocaleLink as Link, UiText } from "@/lib/i18n/client";
import { publicSkinId, resolvePublicSkin, resolveColorMode } from "@/lib/skin";

import styles from "./public-state.module.css";
import "./globals.css";
import "./skins/default.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const skin = resolvePublicSkin(publicSkinId);

  return (
    <html
      lang="en"
      data-skin={skin.id}
      data-color-mode={resolveColorMode(skin)}
    >
      <body>
        <main className={styles.state}>
          <h1>
            <UiText id="errors.loadTitle" />
          </h1>
          <p>
            <UiText id="errors.loadHelp" />
          </p>
          <div className={styles.actions}>
            <ActionButton type="button" onClick={reset}>
              <UiText id="errors.retry" />
            </ActionButton>
            <Link href="/">
              <UiText id="navigation.home" />
            </Link>
            <Link href="/posts">
              <UiText id="navigation.posts" />
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
