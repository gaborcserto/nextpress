"use client";

import { richContentText } from "@nextpress/shared/content";
import {
  LivePreviewMessageSchema,
  type LivePreviewSnapshot,
} from "@nextpress/shared/revisions";
import { useEffect, useState } from "react";

import { ContentArticle } from "@/components/ContentArticle";
import { parsePublicRichContent } from "@/lib/content/rich-content";

import {
  PreviewPageContent,
  type PreviewAppearance,
} from "./PreviewPageContent";

type PreviewProps = { adminOrigin: string; appearance: PreviewAppearance };

export default function Preview({ adminOrigin, appearance }: PreviewProps) {
  const [kind, setKind] = useState<"pages" | "posts">("pages");
  const [snapshot, setSnapshot] = useState<LivePreviewSnapshot | null>(null);

  useEffect(() => {
    const session = window.location.hash.slice(1);
    const host =
      window.opener ?? (window.parent !== window ? window.parent : null);

    if (!adminOrigin || !host || !session) {
      return;
    }

    const expiresAt = Date.now() + 15 * 60_000;

    function receivePreview(event: MessageEvent) {
      if (
        event.origin !== adminOrigin ||
        event.source !== host ||
        Date.now() > expiresAt
      ) {
        return;
      }

      const parsed = LivePreviewMessageSchema.safeParse(event.data);

      if (!parsed.success || parsed.data.session !== session) {
        return;
      }

      setSnapshot(parsed.data.snapshot);
      setKind(parsed.data.kind);
    }

    window.addEventListener("message", receivePreview);
    host.postMessage({ type: "nextpress:ready", session }, adminOrigin);

    const timeout = window.setTimeout(() => setSnapshot(null), 15 * 60_000);

    return () => {
      window.removeEventListener("message", receivePreview);
      clearTimeout(timeout);
    };
  }, [adminOrigin]);

  if (!snapshot) {
    return (
      <p role="status">
        Waiting for authenticated preview. Open Live Preview from the editor.
      </p>
    );
  }

  if (kind === "pages") {
    return <PreviewPageContent snapshot={snapshot} appearance={appearance} />;
  }

  return (
    <ContentArticle
      kind={kind}
      title={snapshot.title}
      content={snapshot.content}
      intro={
        kind === "posts" && snapshot.excerpt ? (
          <p>{richContentText(parsePublicRichContent(snapshot.excerpt))}</p>
        ) : undefined
      }
    />
  );
}
