"use client";

import { readRichContent } from "@nextpress/shared/content";
import {
  RevisionInputSchema,
  RevisionListSchema,
  RevisionRecordSchema,
} from "@nextpress/shared/revisions";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaArrowLeft,
  FaCheck,
  FaEye,
  FaEyeSlash,
  FaHistory,
  FaSave,
  FaUndo,
} from "react-icons/fa";

import { Button, Field, Input, Section, Select } from "@/ui/primitives";
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
  const activeAction = useRef(false);
  const [preview, setPreview] = useState<RevisionRecord | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const response = await fetch(`/api/pages/${pageId}/revisions`, {
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        throw new Error("Unable to load revisions");
      }

      const data = RevisionListSchema.parse(await response.json());

      return data;
    },
    [pageId],
  );

  const showRevisions = useCallback((data: RevisionList) => {
    const latest = data.revisions[0] ?? data.current;
    setRevisions(data);
    setSelectedRevisionId(data.revisions[0]?.id ?? "");
    setTitle(latest.title);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          showRevisions(data);
          setMessage("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setMessage("Unable to load revisions");
        }
      });

    return () => controller.abort();
  }, [load, showRevisions]);

  async function perform(action: RevisionAction) {
    if (!revisions || activeAction.current) {
      return;
    }

    const feedback = revisionActions[action];

    activeAction.current = true;
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

      showRevisions(await load());
      setPreview(null);
      setMessage(feedback.success);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `${feedback.error}: ${error.message}`
          : feedback.error,
      );
    } finally {
      activeAction.current = false;
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

  const selectedRevision = revisions?.revisions.find(
    (revision) => revision.id === selectedRevisionId,
  );

  return (
    <AdminPageLayout
      title="Working revisions"
      description="Manage the working copy and saved snapshots for this document."
      actions={
        <Link href={`/admin/${kind}/${pageId}`} className="btn btn-ghost">
          <FaArrowLeft aria-hidden="true" />
          Back to editor
        </Link>
      }
    >
      <p role="status" className="text-sm text-(--text-muted) empty:hidden">
        {message}
      </p>
      {revisions && (
        <div
          className="admin-revisions-layout"
          data-has-revisions={revisions.revisions.length > 0}
        >
          <Section
            title="Working copy"
            desc="The current editable document state. Save it to create a snapshot in revision history."
          >
            <dl className="admin-revision-meta">
              <div>
                <dt>Current title</dt>
                <dd>{revisions.current.title}</dd>
              </div>
              <div>
                <dt>Working version</dt>
                <dd>{revisions.version}</dd>
              </div>
            </dl>
            <form
              className="mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                void perform("save");
              }}
            >
              <fieldset disabled={busy} className="min-w-0 space-y-4">
                <Field label="Working title" htmlFor="revision-title">
                  <Input
                    id="revision-title"
                    fullWidth
                    required
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </Field>
                <p className="text-sm text-(--text-muted)">
                  The saved snapshot uses content from{" "}
                  {selectedRevision
                    ? `version ${selectedRevision.workingVersion}`
                    : "the current working copy"}
                  .
                </p>
                <Button
                  type="submit"
                  color="primary"
                  disabled={!title.trim() || busy}
                >
                  <FaSave aria-hidden="true" />
                  Save working revision
                </Button>
              </fieldset>
            </form>
          </Section>
          <Section
            title="Revision history"
            desc={
              revisions.revisions.length
                ? "Select a saved snapshot to preview, restore, or publish it."
                : "Saved snapshots will appear here after you save the working copy."
            }
            className={
              revisions.revisions.length ? undefined : "admin-revision-empty"
            }
            variant={revisions.revisions.length ? "soft" : "plain"}
          >
            {revisions.revisions.length ? (
              <fieldset disabled={busy} className="min-w-0 space-y-4">
                <Select
                  id="revision-select"
                  label="Saved revision"
                  fullWidth
                  value={selectedRevisionId}
                  options={[
                    { value: "", label: "Choose a revision" },
                    ...revisions.revisions.map((revision) => ({
                      value: revision.id,
                      label: `${revision.workingVersion}: ${revision.title}`,
                    })),
                  ]}
                  onChangeAction={selectRevision}
                />
                {selectedRevision && (
                  <dl className="admin-revision-meta">
                    <div>
                      <dt>Saved</dt>
                      <dd>
                        <time dateTime={selectedRevision.createdAt}>
                          {new Date(
                            selectedRevision.createdAt,
                          ).toLocaleString()}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt>Slug</dt>
                      <dd>{selectedRevision.slug}</dd>
                    </div>
                  </dl>
                )}
                <p className="text-sm text-(--text-muted)">
                  {selectedRevision
                    ? "Preview, restore, and publish use the selected revision. Unpublish removes this document from public view."
                    : "Choose a saved revision to enable its actions."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="min-w-0 max-w-full"
                    variant="soft"
                    color="info"
                    disabled={!selectedRevisionId || busy}
                    onClick={() => void perform("preview")}
                  >
                    <FaEye aria-hidden="true" />
                    {revisionActions.preview.label}
                  </Button>
                  <Button
                    className="min-w-0 max-w-full"
                    variant="outline"
                    color="neutral"
                    disabled={!selectedRevisionId || busy}
                    onClick={() => void perform("restore")}
                  >
                    <FaUndo aria-hidden="true" />
                    {revisionActions.restore.label}
                  </Button>
                  <Button
                    className="min-w-0 max-w-full"
                    color="primary"
                    disabled={!selectedRevisionId || busy}
                    onClick={() => void perform("publish")}
                  >
                    <FaCheck aria-hidden="true" />
                    {revisionActions.publish.label}
                  </Button>
                  <Button
                    className="min-w-0 max-w-full"
                    variant="ghost"
                    color="neutral"
                    disabled={!selectedRevisionId || busy}
                    onClick={() => void perform("unpublish")}
                  >
                    <FaEyeSlash aria-hidden="true" />
                    {revisionActions.unpublish.label}
                  </Button>
                </div>
              </fieldset>
            ) : (
              <div className="admin-revision-empty-state">
                <FaHistory aria-hidden="true" />
                <p>No saved revisions yet.</p>
                <span>Save the working copy above to start a history.</span>
              </div>
            )}
          </Section>
        </div>
      )}
      {preview && (
        <Section title="Revision preview" desc={preview.title}>
          <LivePreview kind={kind} key={preview.id} snapshot={preview} />
        </Section>
      )}
    </AdminPageLayout>
  );
}
