"use client";

import { readRichContent } from "@nextpress/shared/content";
import {
  RevisionInputSchema,
  RevisionListSchema,
  RevisionRecordSchema,
} from "@nextpress/shared/revisions";
import { useCallback, useEffect, useState } from "react";

import { AdminPageLayout } from "@/ui/shell";

import LivePreview from "./LivePreview";

import type { z } from "zod";

type RevisionList = z.infer<typeof RevisionListSchema>;
type RevisionRecord = z.infer<typeof RevisionRecordSchema>;
type RevisionEditorProps = { pageId: string; kind?: "pages" | "posts" };
type RevisionAction = "save" | "restore" | "publish" | "unpublish" | "preview";

const revisionActions = {
  save: {
    label: "Save working revision",
    success: "Working revision saved.",
    error: "Unable to save the working revision",
  },
  restore: {
    label: "Restore revision",
    success: "Revision restored as a new draft.",
    error: "Unable to restore the revision",
  },
  publish: {
    label: "Publish revision",
    success: "Revision published.",
    error: "Unable to publish the revision",
  },
  unpublish: {
    label: "Unpublish content",
    success: "Content unpublished.",
    error: "Unable to unpublish the content",
  },
  preview: {
    label: "Preview revision",
    success: "Revision preview loaded.",
    error: "Unable to preview the revision",
  },
} satisfies Record<
  RevisionAction,
  { label: string; success: string; error: string }
>;

function buildRevisionInput(
  revisions: RevisionList,
  selectedRevisionId: string,
  title: string,
) {
  const source =
    revisions.revisions.find(
      (revision) => revision.id === selectedRevisionId,
    ) ?? revisions.current;

  return RevisionInputSchema.parse({
    slug: source.slug,
    layout: source.layout,
    expectedVersion: revisions.version,
    title,
    content: JSON.stringify(readRichContent(source.content)),
    excerpt: JSON.stringify(readRichContent(source.excerpt)),
    pageDocument: source.pageDocument ? JSON.parse(source.pageDocument) : null,
  });
}

export default function RevisionEditor({
  pageId,
  kind = "pages",
}: RevisionEditorProps) {
  const [revisions, setRevisions] = useState<RevisionList | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("Loading revisions...");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<RevisionRecord | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/pages/${pageId}/revisions`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Unable to load revisions");
    }

    const data = RevisionListSchema.parse(await response.json());
    const latest = data.revisions[0] ?? data.current;

    setRevisions(data);
    setSelectedRevisionId(data.revisions[0]?.id ?? "");
    setTitle(latest.title);
  }, [pageId]);

  useEffect(() => {
    void load()
      .then(() => setMessage(""))
      .catch(() => setMessage("Unable to load revisions"));
  }, [load]);

  async function perform(action: RevisionAction) {
    if (!revisions) {
      return;
    }

    const feedback = revisionActions[action];

    setBusy(true);
    setMessage("");

    try {
      if (action === "preview") {
        const response = await fetch(
          `/api/pages/${pageId}/revisions?revisionId=${encodeURIComponent(selectedRevisionId)}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error(
            "Preview unavailable; sign in again if your session expired",
          );
        }

        setPreview(RevisionRecordSchema.parse(await response.json()));
        setMessage(feedback.success);

        return;
      }

      let body: unknown;
      const endpoint = `/api/pages/${pageId}/revisions`;
      const method = action === "save" ? "POST" : "PATCH";

      if (action === "save") {
        body = buildRevisionInput(revisions, selectedRevisionId, title);
      } else {
        body = {
          expectedVersion: revisions.version,
          revisionId: selectedRevisionId,
          action,
        };
      }

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(
          response.status === 409
            ? "Content changed or media is referenced. Reload before retrying."
            : "Check your input and session before retrying.",
        );
      }

      await load();
      setPreview(null);
      setMessage(feedback.success);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `${feedback.error}: ${error.message}`
          : feedback.error,
      );
    } finally {
      setBusy(false);
    }
  }

  function selectRevision(id: string) {
    const revision = revisions?.revisions.find((item) => item.id === id);

    setSelectedRevisionId(id);

    if (revision) {
      setTitle(revision.title);
    }

    setPreview(null);
  }

  return (
    <AdminPageLayout
      title="Working revisions"
      description="Save drafts independently from published content."
    >
      <p role="status">{message}</p>
      <fieldset disabled={busy || !revisions}>
        <legend>Working revision</legend>
        <label htmlFor="revision-title">Working title</label>
        <input
          id="revision-title"
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button
          className="btn"
          disabled={busy || !revisions}
          onClick={() => void perform("save")}
        >
          Save working revision
        </button>
        <label htmlFor="revision-select">Saved revision</label>
        <select
          id="revision-select"
          className="select"
          value={selectedRevisionId}
          onChange={(event) => selectRevision(event.target.value)}
        >
          <option value="">Choose a revision</option>
          {revisions?.revisions.map((revision) => (
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
              disabled={busy || !selectedRevisionId}
              onClick={() => void perform(action)}
            >
              {revisionActions[action].label}
            </button>
          ),
        )}
      </fieldset>
      {preview && (
        <LivePreview kind={kind} key={preview.id} snapshot={preview} />
      )}
    </AdminPageLayout>
  );
}
