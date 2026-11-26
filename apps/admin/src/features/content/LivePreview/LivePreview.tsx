"use client";

import {
  LivePreviewMessageSchema,
  LivePreviewReadySchema,
  PreviewMediaRequestSchema,
  RevisionListSchema,
  type LivePreviewSnapshot,
} from "@nextpress/shared/revisions";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  FaCompress,
  FaExpand,
  FaEye,
  FaEyeSlash,
  FaExternalLinkAlt,
} from "react-icons/fa";

import {
  loadPreviewMedia,
  previewMediaIds,
} from "@/features/media/preview-media";
import { useAdminLocale } from "@/lib/i18n/admin-locale";
import { AdminIconButton } from "@/ui/primitives";
import { Select } from "@/ui/primitives/Select";

import styles from "./LivePreview.module.css";
import { slateToString, type SlateLike } from "../editor/editor";

import type { ContentLayout } from "@nextpress/shared/content";
import type { EditorImage } from "@nextpress/shared/media";
import type { PageDocument } from "@nextpress/shared/page-document";

const origin = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;

type PreviewStatus = "loading" | "unavailable" | "expired" | "ready";
type FrontendAvailability = "checking" | "available" | "unavailable";

const availabilityCheckInterval = 30_000;

type PreviewSnapshot = LivePreviewSnapshot;
type PreviewValues = {
  type?: ContentLayout;
  publishedAt?: string | null;
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
  const hu = useAdminLocale() === "hu";
  const text = hu
    ? {
        title: "Élő előnézet",
        close: "Élő előnézet bezárása",
        newTab: "Előnézet megnyitása új lapon",
        fullscreen: "Teljes képernyős előnézet",
        exitFullscreen: "Kilépés a teljes képernyős nézetből",
        showEditor: "Szerkesztés megjelenítése",
        showPreview: "Előnézet megjelenítése",
        viewport: "Nézetméret",
        desktop: "Asztali",
        tablet: "Táblagép",
        mobile: "Mobil",
        language: "Előnézet nyelve",
        live: "Mentetlen módosítások élő követése",
        savedError:
          "A mentett előnézet nem érhető el. Ellenőrizze a munkamenetet, majd nyissa meg újra az előnézetet.",
        missingOrigin:
          "Az előnézethez állítsa be a NEXT_PUBLIC_PREVIEW_ORIGIN változót.",
        retry: "Előnézet újrapróbálása",
        frame: "A nyilvános webhely előnézete",
        loading: "Előnézet betöltése…",
        unavailable:
          "Az előnézet nem érhető el. Ellenőrizze a webhely címét és a beágyazási beállításokat.",
        expired: "Az előnézet lejárt. Zárja be, majd nyissa meg újra.",
        ready: "",
      }
    : {
        title: "Live Preview",
        close: "Close Live Preview",
        newTab: "Open preview in new tab",
        fullscreen: "Fullscreen preview",
        exitFullscreen: "Exit fullscreen",
        showEditor: "Show editing",
        showPreview: "Show preview",
        viewport: "Viewport",
        desktop: "Desktop",
        tablet: "Tablet",
        mobile: "Mobile",
        language: "Preview language",
        live: "Unsaved live updates",
        savedError:
          "Saved preview unavailable. Check your session and reopen Live Preview to retry.",
        missingOrigin:
          "Preview unavailable. Configure NEXT_PUBLIC_PREVIEW_ORIGIN.",
        retry: "Retry preview",
        frame: "Public frontend preview",
        loading: "Loading preview...",
        unavailable:
          "Preview unavailable. Check the frontend URL and framing configuration.",
        expired: "Preview expired. Close and reopen Live Preview.",
        ready: "",
      };

  const [open, setOpen] = useState(Boolean(snapshot));
  const [frontendAvailability, setFrontendAvailability] =
    useState<FrontendAvailability>(origin ? "checking" : "unavailable");
  const [mobilePreview, setMobilePreview] = useState(Boolean(snapshot));
  const [fullscreen, setFullscreen] = useState(false);
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
  const [status, setStatus] = useState<PreviewStatus>("loading");
  const [savedUnavailable, setSavedUnavailable] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [session] = useState(() => crypto.randomUUID());
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const previewPanel = useRef<HTMLElement>(null);
  const previewWindow = useRef<Window | null>(null);
  const fullscreenTrigger = useRef<HTMLButtonElement>(null);
  const readyWindows = useRef(new WeakSet<Window>());
  const url = origin
    ? `${origin}/live-preview?locale=${locale}#${session}`
    : "";

  const previewUnavailable = status === "unavailable";

  useEffect(() => {
    if (!origin) {
      return;
    }

    let active = true;
    let checking = false;

    async function checkFrontend() {
      if (checking || document.visibilityState === "hidden") {
        return;
      }

      checking = true;

      try {
        const response = await fetch("/api/frontend-availability", {
          cache: "no-store",
        });

        const availability: unknown = await response.json();

        if (
          !response.ok ||
          typeof availability !== "object" ||
          availability === null ||
          !("available" in availability) ||
          availability.available !== true
        ) {
          throw new Error("Public frontend unavailable");
        }

        if (active) {
          setFrontendAvailability("available");
        }
      } catch {
        if (active) {
          setFrontendAvailability("unavailable");
          setOpen(false);
          setFullscreen(false);
        }
      } finally {
        checking = false;
      }
    }

    void checkFrontend();
    const interval = window.setInterval(
      () => void checkFrontend(),
      availabilityCheckInterval,
    );

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!fullscreen) {
      return;
    }

    fullscreenTrigger.current?.focus();

    function closeFullscreen(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFullscreen(false);
        fullscreenTrigger.current?.focus();
      }
    }

    function onFullscreenChange() {
      if (!document.fullscreenElement) {
        setFullscreen(false);
        fullscreenTrigger.current?.focus();
      }
    }

    window.addEventListener("keydown", closeFullscreen);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      window.removeEventListener("keydown", closeFullscreen);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [fullscreen]);

  const currentSnapshot = useRef<PreviewSnapshot | null>(null);

  useEffect(() => {
    const debounce = window.setTimeout(() => {
      if (live && values) {
        currentSnapshot.current = {
          title: values.title,
          publishedAt: values.publishedAt,
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
  }, [open, id, snapshot, savedContent, privateSnapshot, retryKey]);

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
      setStatus("ready");
    }

    window.addEventListener("message", receivePreviewReady);

    const interval = window.setInterval(() => {
      if (Date.now() > expiresAt) {
        setStatus("expired");

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
          previous === "loading" ? "unavailable" : previous,
        ),
      15000,
    );

    return () => {
      window.removeEventListener("message", receivePreviewReady);
      abortMedia.abort();
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [open, session, kind, locale, retryKey]);

  function openPreviewTab() {
    if (previewWindow.current) {
      readyWindows.current.delete(previewWindow.current);
    }

    previewWindow.current = window.open(url, "nextpress-preview");
  }

  function retryPreview() {
    const frame = previewFrame.current?.contentWindow;

    if (frame) {
      readyWindows.current.delete(frame);
    }

    setStatus("loading");
    setSavedUnavailable(false);
    setRetryKey((current) => current + 1);
  }

  async function toggleFullscreen() {
    if (fullscreen) {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }

      setFullscreen(false);
      fullscreenTrigger.current?.focus();

      return;
    }

    setFullscreen(true);

    try {
      await previewPanel.current?.requestFullscreen();
    } catch {
      // The fixed viewport panel remains available when fullscreen is denied.
    }
  }

  const previewAction = (
    <button
      type="button"
      className="btn btn-ghost"
      aria-expanded={open}
      onClick={() => {
        if (!open) {
          setStatus("loading");
          setSavedUnavailable(false);
          setLegacySaved(null);
        }

        setOpen(!open);
        setMobilePreview(!open);
      }}
    >
      {open ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
      {open ? text.close : text.title}
    </button>
  );

  return (
    <>
      {renderHeader
        ? renderHeader(
            frontendAvailability === "available" ? previewAction : null,
          )
        : frontendAvailability === "available"
          ? previewAction
          : null}
      <div
        className={open && children ? styles.split : undefined}
        data-preview={open && mobilePreview}
      >
        <div className={styles.editor}>{children}</div>
        {open && frontendAvailability === "available" && (
          <section
            ref={previewPanel}
            className={`${styles.preview} ${fullscreen ? styles.fullscreen : ""}`}
            aria-label={text.title}
            aria-modal={fullscreen ? true : undefined}
            role={fullscreen ? "dialog" : undefined}
            aria-labelledby="live-preview-heading"
          >
            <header className={styles.previewHeader}>
              <h2 id="live-preview-heading">{text.title}</h2>
              <div className={styles.previewHeaderActions}>
                {origin && (
                  <AdminIconButton
                    icon={FaExternalLinkAlt}
                    variant="ghost"
                    size="sm"
                    title={text.newTab}
                    aria-label={text.newTab}
                    onClick={openPreviewTab}
                  />
                )}
                <button
                  ref={fullscreenTrigger}
                  type="button"
                  className="btn btn-ghost btn-sm btn-square"
                  title={fullscreen ? text.exitFullscreen : text.fullscreen}
                  aria-label={
                    fullscreen ? text.exitFullscreen : text.fullscreen
                  }
                  onClick={() => void toggleFullscreen()}
                >
                  {fullscreen ? (
                    <FaCompress aria-hidden="true" />
                  ) : (
                    <FaExpand aria-hidden="true" />
                  )}
                </button>
              </div>
            </header>
            <div className={styles.previewControls}>
              {children && (
                <button
                  type="button"
                  className="btn btn-ghost min-[75rem]:hidden"
                  onClick={() => setMobilePreview(!mobilePreview)}
                >
                  {mobilePreview ? text.showEditor : text.showPreview}
                </button>
              )}
              <Select
                label={text.viewport}
                value={width}
                options={[
                  { value: "100%", label: text.desktop },
                  { value: "768px", label: text.tablet },
                  { value: "375px", label: text.mobile },
                ]}
                onChangeAction={setWidth}
              />
              <Select
                label={text.language}
                value={locale}
                options={[
                  { value: "en", label: "English" },
                  { value: "hu", label: "Magyar" },
                ]}
                onChangeAction={(next) => {
                  if (next !== locale) {
                    retryPreview();
                    setLocale(next);
                  }
                }}
              />
              {values && (
                <label className={styles.liveToggle}>
                  <input
                    type="checkbox"
                    checked={live}
                    disabled={!saved}
                    onChange={(event) => setLive(event.target.checked)}
                  />
                  {text.live}
                </label>
              )}
            </div>
            {savedUnavailable && <p role="status">{text.savedError}</p>}
            <p role="status" aria-live="polite">
              {origin ? text[status] : text.missingOrigin}
            </p>
            {previewUnavailable && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={retryPreview}
              >
                {text.retry}
              </button>
            )}
            {origin && !previewUnavailable && (!values || live || saved) && (
              <iframe
                key={retryKey}
                ref={previewFrame}
                src={url}
                title={text.frame}
                className={styles.previewFrame}
                style={{ width }}
              />
            )}
          </section>
        )}
      </div>
    </>
  );
}
