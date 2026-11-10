"use client";

import { readRichContent } from "@nextpress/shared/content";
import { MediaMetadataSchema } from "@nextpress/shared/media";
import { PageDocumentSchema } from "@nextpress/shared/page-document";
import {
  RevisionInputSchema,
  RevisionListSchema,
  RevisionRecordSchema,
} from "@nextpress/shared/revisions";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

import { AdminPageLayout } from "@/ui/shell";

import RevisionPreview from "./RevisionPreview";

type RevisionList = z.infer<typeof RevisionListSchema>;
const mediaSchema = z.array(MediaMetadataSchema);

export default function RevisionEditor({ pageId }: { pageId: string }) {
  const [state, setState] = useState<RevisionList | null>(null);
  const [selected, setSelected] = useState("");
  const [title, setTitle] = useState("");
  const [document, setDocument] = useState('{"version":1,"blocks":[]}');
  const [message, setMessage] = useState("Loading revisions...");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<z.infer<
    typeof RevisionRecordSchema
  > | null>(null);
  const [media, setMedia] = useState<z.infer<typeof mediaSchema>>([]);
  const [mediaId, setMediaId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/pages/${pageId}/revisions`, {
      cache: "no-store",
    });

    if (!response.ok) throw new Error("Unable to load revisions");
    const data = RevisionListSchema.parse(await response.json());
    setState(data);
    const latest = data.revisions[0] ?? data.current;
    setSelected(data.revisions[0]?.id ?? "");
    setTitle(latest.title);
    setDocument(latest.pageDocument ?? '{"version":1,"blocks":[]}');
    const assets = await fetch("/api/media", { cache: "no-store" });

    if (!assets.ok) throw new Error("Unable to load media");
    setMedia(mediaSchema.parse(await assets.json()));
  }, [pageId]);

  useEffect(() => {
    void load()
      .then(() => setMessage(""))
      .catch(() => setMessage("Unable to load revisions or media"));
  }, [load]);

  async function perform(
    action: "save" | "restore" | "publish" | "unpublish" | "preview" | "upload",
  ) {
    if (!state) return;
    setBusy(true);
    setMessage("");
    try {
      if (action === "preview") {
        const response = await fetch(
          `/api/pages/${pageId}/revisions?revisionId=${encodeURIComponent(selected)}`,
          { cache: "no-store" },
        );

        if (!response.ok)
          throw new Error(
            "Preview unavailable; sign in again if your session expired",
          );
        setPreview(RevisionRecordSchema.parse(await response.json()));

        return;
      }
      let body: unknown;
      let endpoint = `/api/pages/${pageId}/revisions`;
      let method = action === "save" ? "POST" : "PATCH";

      if (action === "save") {
        const source =
          state.revisions.find((revision) => revision.id === selected) ??
          state.current;
        body = RevisionInputSchema.parse({
          slug: source.slug,
          layout: source.layout,
          expectedVersion: state.version,
          title,
          content: JSON.stringify(readRichContent(source.content)),
          excerpt: JSON.stringify(readRichContent(source.excerpt)),
          pageDocument: PageDocumentSchema.parse(JSON.parse(document)),
        });
      } else if (action === "upload") {
        if (!file || file.size > 2_097_152)
          throw new Error("Choose a PNG/JPEG image no larger than 2 MiB");
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";

        for (const byte of bytes) binary += String.fromCharCode(byte);
        body = { data: btoa(binary), mime: file.type, alt: file.name };
        endpoint = "/api/media";
        method = "POST";
      } else
        body = { expectedVersion: state.version, revisionId: selected, action };
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok)
        throw new Error(
          response.status === 409
            ? "Content changed or media is referenced. Reload before retrying."
            : "Operation failed; check your input and session",
        );
      await load();
      setPreview(null);
      setMessage("Saved successfully");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }

  function selectRevision(id: string) {
    setSelected(id);
    const revision = state?.revisions.find((item) => item.id === id);

    if (revision) {
      setTitle(revision.title);
      setDocument(revision.pageDocument ?? '{"version":1,"blocks":[]}');
    }
    setPreview(null);
  }

  function insertImage() {
    try {
      const parsed = PageDocumentSchema.parse(JSON.parse(document));
      parsed.blocks.push({
        id: crypto.randomUUID(),
        type: "image",
        version: 1,
        props: {
          mediaId,
          alt: media.find((item) => item.id === mediaId)?.alt ?? "",
        },
      });
      setDocument(JSON.stringify(parsed, null, 2));
    } catch {
      setMessage("Fix the document JSON before inserting an image");
    }
  }

  return (
    <AdminPageLayout
      title="Composition and working revisions"
      description="Save drafts independently from published content. Continue using the existing Slate editor for rich text."
    >
      <p role="status">{message}</p>
      <fieldset disabled={busy || !state}>
        <legend>Working content and media</legend>
        <label htmlFor="revision-title">Working title</label>
        <input
          id="revision-title"
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <label htmlFor="revision-document">Page document JSON</label>
        <textarea
          id="revision-document"
          className="textarea w-full"
          rows={16}
          value={document}
          onChange={(event) => setDocument(event.target.value)}
        />
        <button
          className="btn"
          disabled={busy || !state}
          onClick={() => void perform("save")}
        >
          Save working revision
        </button>
        <label htmlFor="revision-select">Saved revision</label>
        <select
          id="revision-select"
          className="select"
          value={selected}
          onChange={(event) => selectRevision(event.target.value)}
        >
          <option value="">Choose a revision</option>
          {state?.revisions.map((revision) => (
            <option key={revision.id} value={revision.id}>
              {revision.workingVersion}: {revision.title}
            </option>
          ))}
        </select>
        {(["preview", "restore", "publish", "unpublish"] as const).map(
          (action) => (
            <button
              className="btn"
              key={action}
              disabled={busy || !selected}
              onClick={() => void perform(action)}
            >
              {action}
            </button>
          ),
        )}
        <label htmlFor="media-file">Upload image</label>
        <input
          id="media-file"
          type="file"
          accept="image/png,image/jpeg"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <button
          className="btn"
          disabled={busy || !file}
          onClick={() => void perform("upload")}
        >
          Upload
        </button>
        <label htmlFor="media-select">Media</label>
        <select
          id="media-select"
          value={mediaId}
          onChange={(event) => setMediaId(event.target.value)}
        >
          <option value="">Choose an image</option>
          {media.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.alt || asset.id}
            </option>
          ))}
        </select>
        <button
          className="btn"
          disabled={!mediaId || busy}
          onClick={insertImage}
        >
          Insert image reference
        </button>
      </fieldset>
      {preview && (
        <RevisionPreview
          title={preview.title}
          content={preview.content}
          pageDocument={preview.pageDocument}
        />
      )}
    </AdminPageLayout>
  );
}
