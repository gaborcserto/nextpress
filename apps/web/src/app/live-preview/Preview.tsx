"use client";

import {
  LivePreviewMessageSchema,
  type LivePreviewSnapshot,
} from "@nextpress/shared/revisions";
import { useCallback, useEffect, useState } from "react";

import { ContentArticle } from "@/components/ContentArticle";
import { PreviewMediaContext } from "@/components/public-content/ContentMediaImage";
import { PostCover } from "@/components/public-content/PostCover";
import { RichContent } from "@/components/RichContent";
import { parsePublicRichContent } from "@/lib/content/rich-content";
import { LocalizedDate } from "@/lib/i18n/client";

import {
  PreviewPageContent,
  PreviewDocumentBlocks,
  previewCover,
  type PreviewAppearance,
} from "./PreviewPageContent";
import { requestPreviewMedia } from "./request-preview-media";

type PreviewProps = { adminOrigin: string; appearance: PreviewAppearance };

export default function Preview({ adminOrigin, appearance }: PreviewProps) {
  const [kind, setKind] = useState<"pages" | "posts">("pages");
  const [snapshot, setSnapshot] = useState<LivePreviewSnapshot | null>(null);

  const loadMedia = useCallback(
    (id: string, signal: AbortSignal) =>
      requestPreviewMedia(adminOrigin, id, signal),
    [adminOrigin],
  );

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

      window.clearInterval(readyInterval);
      setSnapshot(parsed.data.snapshot);
      setKind(parsed.data.kind);
    }

    window.addEventListener("message", receivePreview);

    const announceReady = () =>
      host.postMessage({ type: "nextpress:ready", session }, adminOrigin);
    const readyInterval = window.setInterval(announceReady, 500);
    announceReady();

    const timeout = window.setTimeout(() => setSnapshot(null), 15 * 60_000);

    return () => {
      window.removeEventListener("message", receivePreview);
      clearInterval(readyInterval);
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

  return (
    <PreviewMediaContext.Provider value={loadMedia}>
      {kind === "pages" ? (
        <PreviewPageContent
          adminOrigin={adminOrigin}
          snapshot={snapshot}
          appearance={appearance}
        />
      ) : (
        <ContentArticle
          kind="posts"
          title={snapshot.title}
          content={snapshot.content}
          mediaOrigin={adminOrigin}
          intro={
            <>
              {snapshot.publishedAt && (
                <LocalizedDate value={snapshot.publishedAt} />
              )}
              {snapshot.excerpt && (
                <RichContent
                  content={parsePublicRichContent(snapshot.excerpt)}
                  mediaOrigin={adminOrigin}
                />
              )}
              <PostCover
                cover={previewCover(snapshot.cover)}
                title={snapshot.title}
              />
            </>
          }
        >
          <PreviewDocumentBlocks
            adminOrigin={adminOrigin}
            raw={snapshot.pageDocument}
          />
        </ContentArticle>
      )}
    </PreviewMediaContext.Provider>
  );
}
