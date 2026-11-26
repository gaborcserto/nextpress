import {
  LivePreviewMessageSchema,
  type LivePreviewSnapshot,
} from "@nextpress/shared/revisions";
import { useEffect, useState } from "react";

import {
  PREVIEW_SESSION_DURATION_MS,
  PREVIEW_READY_INTERVAL_MS,
} from "./Preview.constants";

export function usePreviewSnapshot(adminOrigin: string) {
  const [kind, setKind] = useState<"pages" | "posts">("pages");
  const [snapshot, setSnapshot] = useState<LivePreviewSnapshot | null>(null);

  useEffect(() => {
    const session = window.location.hash.slice(1);
    const host =
      window.opener ?? (window.parent !== window ? window.parent : null);

    if (!adminOrigin || !host || !session) {
      return;
    }

    const expiresAt = Date.now() + PREVIEW_SESSION_DURATION_MS;

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
    const readyInterval = window.setInterval(
      announceReady,
      PREVIEW_READY_INTERVAL_MS,
    );
    announceReady();

    const timeout = window.setTimeout(
      () => setSnapshot(null),
      PREVIEW_SESSION_DURATION_MS,
    );

    return () => {
      window.removeEventListener("message", receivePreview);
      clearInterval(readyInterval);
      clearTimeout(timeout);
    };
  }, [adminOrigin]);

  return { kind, snapshot };
}
