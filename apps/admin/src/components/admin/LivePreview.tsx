"use client";

import {
  LivePreviewMessageSchema,
  LivePreviewReadySchema,
  PreviewMediaRequestSchema,
  RevisionListSchema,
  type LivePreviewSnapshot,
} from "@nextpress/shared/revisions";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FaEye, FaEyeSlash, FaExternalLinkAlt } from "react-icons/fa";

import { slateToString, type SlateLike } from "@/lib/content/editor";
import { Select } from "@/ui/primitives/Select";

import styles from "./LivePreview.module.css";
import { loadPreviewMedia, previewMediaIds } from "./Media/preview-media";

import type { ContentLayout } from "@nextpress/shared/content";
import type { EditorImage } from "@nextpress/shared/media";
import type { PageDocument } from "@nextpress/shared/page-document";

const origin = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;

type PreviewSnapshot = LivePreviewSnapshot;
type PreviewValues = {
  type?: ContentLayout;
  title: string;
  slug: string;
  content?: SlateLike;
  excerpt?: SlateLike;
  listingTag?: { slug: string } | null;
  cover?: EditorImage | null;
  gallery?: EditorImage[];
  pageDocument?: PageDocument | null;
};
type LivePreviewProps = {
  children?: ReactNode;
  renderHeader?: (previewAction: ReactNode) => ReactNode;
  kind?: "pages" | "posts";
  id?: string;
  savedContent?: { title: string; slug: string };
  values?: PreviewValues;
  snapshot?: PreviewSnapshot;
  privateSnapshot?: PreviewSnapshot;
};

export default function LivePreview({
  children,
  renderHeader,
  kind = "pages",
  id,
  values,
  snapshot,
  privateSnapshot,
  savedContent,
}: LivePreviewProps) {
  const [open, setOpen] = useState(Boolean(snapshot));
  const [mobilePreview, setMobilePreview] = useState(Boolean(snapshot));
  const [width, setWidth] = useState("100%");
  const [locale, setLocale] = useState("en");
  const [legacySaved, setLegacySaved] = useState<{
    snapshot: PreviewSnapshot;
    id: string;
    source: LivePreviewProps["savedContent"];
  } | null>(null);
  const saved =
    privateSnapshot ??
    snapshot ??
    (legacySaved?.id === id && legacySaved?.source === savedContent
      ? (legacySaved?.snapshot ?? null)
      : null);

  const [live, setLive] = useState(true);
  const [status, setStatus] = useState("Loading preview...");
  const [savedUnavailable, setSavedUnavailable] = useState(false);
  const [session] = useState(() => crypto.randomUUID());
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const previewWindow = useRef<Window | null>(null);
  const readyWindows = useRef(new WeakSet<Window>());
  const url = origin
    ? `${origin}/live-preview?locale=${locale}#${session}`
    : "";

  const currentSnapshot = useRef<PreviewSnapshot | null>(null);

  useEffect(() => {
    const debounce = window.setTimeout(() => {
      if (live && values) {
        currentSnapshot.current = {
          title: values.title,
          slug: values.slug,
          content: slateToString(values.content),
          excerpt: slateToString(values.excerpt),
          layout: values.type ?? saved?.layout ?? "STANDARD",
          pageDocument: values.pageDocument
            ? JSON.stringify(values.pageDocument)
            : (saved?.pageDocument ?? null),
          cover: values.cover === undefined ? saved?.cover : values.cover,
          gallery: values.gallery?.flatMap(
            ({ id, url, alt, width, height, caption }) =>
              url === `/media/${id}`
                ? [{ id, url, alt, width, height, caption }]
                : [],
          ),
          listingTagSlug: values.listingTag?.slug ?? null,
        };
      } else {
        currentSnapshot.current = saved;
      }
    }, 250);

    return () => clearTimeout(debounce);
  }, [live, values, saved]);

  useEffect(() => {
    if (!open || !id || snapshot || privateSnapshot) {
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

        if (abort.signal.aborted) {
          return;
        }

        setLegacySaved({ snapshot: data.current, id, source: savedContent });
        setSavedUnavailable(false);
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setSavedUnavailable(true);
        }
      });

    return () => abort.abort();
  }, [open, id, snapshot, savedContent, privateSnapshot]);

  useEffect(() => {
    if (!open || !origin) {
      return;
    }

    const previewOrigin = origin;
    const expiresAt = Date.now() + 15 * 60_000;
    const lastSentMessages = new Map<Window, string>();
    const lastSentMedia = new Map<Window, Set<string>>();
    const pending = new Map<string, Promise<ArrayBuffer | null>>();
    const abortMedia = new AbortController();
    let mediaQueue = Promise.resolve();

    function sendPreview(target: Window | null) {
      if (
        !target ||
        !readyWindows.current.has(target) ||
        !currentSnapshot.current ||
        Date.now() > expiresAt
      ) {
        return;
      }

      const message = LivePreviewMessageSchema.safeParse({
        type: "nextpress:preview",
        kind,
        session,
        snapshot: currentSnapshot.current,
      });

      if (!message.success) {
        return;
      }

      const serialized = JSON.stringify(message.data);

      if (lastSentMessages.get(target) === serialized) {
        return;
      }

      target.postMessage(message.data, previewOrigin);
      lastSentMessages.set(target, serialized);
      lastSentMedia.set(target, previewMediaIds(message.data.snapshot));
    }

    function receivePreviewReady(event: MessageEvent) {
      if (
        event.origin !== origin ||
        (event.source !== previewFrame.current?.contentWindow &&
          event.source !== previewWindow.current)
      ) {
        return;
      }

      const target =
        event.source === previewWindow.current
          ? previewWindow.current
          : previewFrame.current?.contentWindow;

      const media = PreviewMediaRequestSchema.safeParse(event.data);

      if (
        media.success &&
        media.data.session === session &&
        target &&
        Date.now() <= expiresAt
      ) {
        const { id } = media.data;

        if (!lastSentMedia.get(target)?.has(id)) {
          return;
        }

        let request = pending.get(id);

        if (!request && pending.size < 48) {
          request = mediaQueue
            .then(() => loadPreviewMedia(id, abortMedia.signal))
            .finally(() => pending.delete(id));
          pending.set(id, request);
          mediaQueue = request.then(() => undefined);
        }

        void (request ?? Promise.resolve(null)).then((bytes) => {
          if (
            !abortMedia.signal.aborted &&
            Date.now() <= expiresAt &&
            lastSentMedia.get(target)?.has(id)
          ) {
            target.postMessage(
              { ...media.data, type: "nextpress:media-response", bytes },
              previewOrigin,
            );
          }
        });

        return;
      }

      const ready = LivePreviewReadySchema.safeParse(event.data);

      if (!ready.success || ready.data.session !== session) {
        return;
      }

      if (target) {
        readyWindows.current.add(target);
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
      abortMedia.abort();
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [open, session, kind, locale]);

  function openPreviewTab() {
    if (previewWindow.current) {
      readyWindows.current.delete(previewWindow.current);
    }

    previewWindow.current = window.open(url, "nextpress-preview");
  }

  const previewAction = (
    <button
      type="button"
      className="btn btn-ghost"
      aria-expanded={open}
      onClick={() => {
        if (!open) {
          setStatus("Loading preview...");
          setSavedUnavailable(false);
          setLegacySaved(null);
        }

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
          <Select
            label="Preview language"
            value={locale}
            options={[
              { value: "en", label: "English" },
              { value: "hu", label: "Magyar" },
            ]}
            onChangeAction={setLocale}
          />
          <span role="status">
            {values && live
              ? "Live preview of unsaved editor values"
              : privateSnapshot
                ? "Saved preview of the private working copy"
                : snapshot
                  ? "Saved preview of the selected revision"
                  : "Saved preview of authoritative editor content"}
          </span>
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
            {savedUnavailable && (
              <p role="status">
                Saved preview unavailable. Check your session and reopen Live
                Preview to retry.
              </p>
            )}
            <p role="status">
              {origin
                ? status
                : "Preview unavailable. Configure NEXT_PUBLIC_PREVIEW_ORIGIN."}
            </p>
            {origin && (!values || live || saved) && (
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
