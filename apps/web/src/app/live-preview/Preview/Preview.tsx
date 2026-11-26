"use client";

import { useCallback } from "react";

import { ContentArticle } from "@/components/ContentArticle";
import { PreviewMediaContext } from "@/components/public-content/ContentMediaImage";
import { PostCover } from "@/components/public-content/PostCover";
import { RichContent } from "@/components/RichContent";
import { parsePublicRichContent } from "@/lib/content/rich-content";
import { LocalizedDate } from "@/lib/i18n/client";

import { usePreviewSnapshot } from "./Preview.hooks";
import {
  PreviewPageContent,
  PreviewDocumentBlocks,
  previewCover,
  type PreviewAppearance,
} from "./PreviewPageContent";
import { requestPreviewMedia } from "./request-preview-media";

type PreviewProps = { adminOrigin: string; appearance: PreviewAppearance };

export function Preview({ adminOrigin, appearance }: PreviewProps) {
  const { kind, snapshot } = usePreviewSnapshot(adminOrigin);

  const loadMedia = useCallback(
    (id: string, signal: AbortSignal) =>
      requestPreviewMedia(adminOrigin, id, signal),
    [adminOrigin],
  );

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
