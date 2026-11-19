"use client";

import {
  LivePreviewMessageSchema,
  LivePreviewReadySchema,
  RevisionListSchema,
  type RevisionSnapshotSchema,
} from "@nextpress/shared/revisions";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FaEye, FaEyeSlash, FaExternalLinkAlt } from "react-icons/fa";

import { slateToString, type SlateLike } from "@/lib/content/editor";
import { Select } from "@/ui/primitives/Select";

import styles from "./LivePreview.module.css";

import type { z } from "zod";

const origin = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;

type PreviewSnapshot = z.infer<typeof RevisionSnapshotSchema>;
type PreviewValues = {
  title: string;
  slug: string;
  content?: SlateLike;
  excerpt?: SlateLike;
};
type LivePreviewProps = {
  children?: ReactNode;
  renderHeader?: (previewAction: ReactNode) => ReactNode;
  kind?: "pages" | "posts";
  id?: string;
  savedContent?: { title: string; slug: string };
  values?: PreviewValues;
  snapshot?: PreviewSnapshot;
};

export default function LivePreview({
  children,
  renderHeader,
  kind = "pages",
  id,
  values,
  snapshot,
  savedContent,
}: LivePreviewProps) {
  const [open, setOpen] = useState(Boolean(snapshot));
  const [mobilePreview, setMobilePreview] = useState(Boolean(snapshot));
  const [width, setWidth] = useState("100%");
  const [saved, setSaved] = useState<PreviewSnapshot | null>(snapshot ?? null);
  const [live, setLive] = useState(true);
  const [status, setStatus] = useState("Loading preview...");
  const [session] = useState(() => crypto.randomUUID());
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const previewWindow = useRef<Window | null>(null);
  const url = origin ? `${origin}/live-preview#${session}` : "";
  const currentSnapshot = useRef<PreviewSnapshot | null>(null);

  useEffect(() => {
    const debounce = window.setTimeout(() => {
      if (live && values) {
        currentSnapshot.current = {
          title: values.title,
          slug: values.slug,
          content: slateToString(values.content),
          excerpt: slateToString(values.excerpt),
          layout: saved?.layout ?? "STANDARD",
          pageDocument: saved?.pageDocument ?? null,
        };
      } else {
        currentSnapshot.current = saved;
      }
    }, 250);

    return () => clearTimeout(debounce);
  }, [live, values, saved]);

  useEffect(() => {
    if (!open || !id || snapshot) {
      return;
    }

    const abort = new AbortController();

    void fetch(`/api/pages/${id}/revisions`, {
      cache: "no-store",
      signal: abort.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load saved preview");
        }

        const data = RevisionListSchema.parse(await response.json());

        setSaved(data.revisions[0] ?? data.current);
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setStatus("Saved preview unavailable. Check your session and retry.");
        }
      });

    return () => abort.abort();
  }, [open, id, snapshot, savedContent]);

  useEffect(() => {
    if (!open || !origin) {
      return;
    }

    const previewOrigin = origin;
    const expiresAt = Date.now() + 15 * 60_000;
    const lastSentMessages = new Map<Window, string>();

    function sendPreview(target: Window | null) {
      if (!currentSnapshot.current || Date.now() > expiresAt) {
        return;
      }

      const message = LivePreviewMessageSchema.safeParse({
        type: "nextpress:preview",
        kind,
        session,
        snapshot: currentSnapshot.current,
      });

      if (!message.success || !target) {
        return;
      }

      const serialized = JSON.stringify(message.data);

      if (lastSentMessages.get(target) === serialized) {
        return;
      }

      target.postMessage(message.data, previewOrigin);
      lastSentMessages.set(target, serialized);
    }

    function receivePreviewReady(event: MessageEvent) {
      if (
        event.origin !== origin ||
        (event.source !== previewFrame.current?.contentWindow &&
          event.source !== previewWindow.current)
      ) {
        return;
      }

      const ready = LivePreviewReadySchema.safeParse(event.data);

      if (!ready.success || ready.data.session !== session) {
        return;
      }

      const target =
        event.source === previewWindow.current
          ? previewWindow.current
          : previewFrame.current?.contentWindow;

      if (target) {
        lastSentMessages.delete(target);
      }

      sendPreview(target ?? null);
      setStatus("");
    }

    window.addEventListener("message", receivePreviewReady);

    const interval = window.setInterval(() => {
      if (Date.now() > expiresAt) {
        setStatus("Preview expired. Close and reopen Live Preview.");

        return;
      }

      sendPreview(previewFrame.current?.contentWindow ?? null);

      if (previewWindow.current && !previewWindow.current.closed) {
        sendPreview(previewWindow.current);
      }
    }, 400);

    const timeout = window.setTimeout(
      () =>
        setStatus((previous) =>
          previous
            ? "Preview unavailable. Check the frontend URL and framing configuration."
            : "",
        ),
      15000,
    );

    return () => {
      window.removeEventListener("message", receivePreviewReady);
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [open, session, kind]);

  function openPreviewTab() {
    previewWindow.current = window.open(url, "nextpress-preview");
  }

  const previewAction = (
    <button
      type="button"
      className="btn btn-ghost"
      aria-expanded={open}
      onClick={() => {
        setOpen(!open);
        setMobilePreview(!open);
      }}
    >
      {open ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
      {open ? "Close Live Preview" : "Live Preview"}
    </button>
  );

  return (
    <>
      {renderHeader ? renderHeader(previewAction) : previewAction}
      {open && (
        <div
          className="admin-preview-controls"
          role="group"
          aria-label="Live Preview controls"
        >
          {children && (
            <button
              type="button"
              className="btn btn-ghost min-[1001px]:hidden"
              onClick={() => setMobilePreview(!mobilePreview)}
            >
              {mobilePreview ? "Show editing" : "Show preview"}
            </button>
          )}
          <Select
            label="Viewport"
            value={width}
            options={[
              { value: "100%", label: "Desktop" },
              { value: "768px", label: "Tablet" },
              { value: "375px", label: "Mobile" },
            ]}
            onChangeAction={setWidth}
          />
          {values && (
            <label>
              <input
                type="checkbox"
                checked={live}
                disabled={!saved}
                onChange={(event) => setLive(event.target.checked)}
              />{" "}
              Unsaved live updates
            </label>
          )}
          {origin && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={openPreviewTab}
            >
              <FaExternalLinkAlt aria-hidden="true" />
              Open preview in new tab
            </button>
          )}
        </div>
      )}
      <div
        className={open && children ? styles.split : undefined}
        data-preview={open && mobilePreview}
      >
        <div className={styles.editor}>{children}</div>
        {open && (
          <section className={styles.preview} aria-label="Live Preview">
            <p role="status">
              {origin
                ? status
                : "Preview unavailable. Configure NEXT_PUBLIC_PREVIEW_ORIGIN."}
            </p>
            {origin && (
              <iframe
                ref={previewFrame}
                src={url}
                title="Public frontend preview"
                style={{ width, height: "80vh", border: 0 }}
              />
            )}
          </section>
        )}
      </div>
    </>
  );
}
