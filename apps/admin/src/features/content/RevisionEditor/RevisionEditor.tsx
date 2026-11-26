"use client";

import { readRichContent } from "@nextpress/shared/content";
import {
  RevisionInputSchema,
  RevisionListSchema,
  RevisionRecordSchema,
} from "@nextpress/shared/revisions";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaArrowLeft,
  FaCheck,
  FaEyeSlash,
  FaHistory,
  FaSave,
} from "react-icons/fa";

import { AdminTimestamp } from "@/lib/settings/admin-date-time";
import { AdminAsyncButton, Section } from "@/ui/primitives";
import { LinkButton } from "@/ui/primitives/Buttons";
import { AdminPageLayout } from "@/ui/shell";

import { RevisionActionButton } from "./RevisionActionButton";
import { revisionActions } from "./RevisionEditor.constants";
import LivePreview from "../LivePreview/LivePreview";

import type {
  RevisionAction,
  RevisionEditorProps,
  RevisionList,
  RevisionRecord,
} from "./RevisionEditor.types";

function buildRevisionInput(revisions: RevisionList) {
  const source = revisions.current;

  return RevisionInputSchema.parse({
    slug: source.slug,
    layout: source.layout,
    expectedVersion: revisions.version,
    title: source.title,
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
  const [message, setMessage] = useState("Loading revisions...");
  const [pending, setPending] = useState<RevisionAction | null>(null);
  const busy = pending !== null;
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
    setRevisions(data);
    setSelectedRevisionId(data.revisions[0]?.id ?? "");
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

  async function perform(
    action: RevisionAction,
    revisionId = selectedRevisionId,
  ) {
    if (!revisions || activeAction.current) {
      return;
    }

    const feedback = revisionActions[action];

    activeAction.current = true;
    setPending(action);
    setMessage("");

    try {
      if (action === "preview") {
        const response = await fetch(
          `/api/pages/${pageId}/revisions?revisionId=${encodeURIComponent(revisionId)}`,
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
        body = buildRevisionInput(revisions);
      } else {
        body = {
          expectedVersion: revisions.version,
          revisionId,
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
      setPending(null);
    }
  }

  function selectRevision(id: string) {
    setSelectedRevisionId(id);

    setPreview(null);
  }

  const currentAuthorName = revisions?.revisions.find(
    (revision) =>
      revision.workingVersion === revisions.version &&
      revision.title === revisions.current.title &&
      revision.slug === revisions.current.slug &&
      revision.content === revisions.current.content &&
      revision.excerpt === revisions.current.excerpt &&
      revision.layout === revisions.current.layout &&
      revision.pageDocument === revisions.current.pageDocument,
  )?.authorName;

  return (
    <AdminPageLayout
      title="Working revisions"
      description="Manage the working copy and saved snapshots for this document."
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <LinkButton href={`/admin/${kind}/${pageId}`} variant="ghost">
            <FaArrowLeft aria-hidden="true" />
            Back to editor
          </LinkButton>
          {revisions && (
            <AdminAsyncButton
              type="button"
              color="primary"
              disabled={busy}
              loading={pending === "save"}
              onClick={() => void perform("save")}
            >
              <FaSave aria-hidden="true" />
              Save working revision
            </AdminAsyncButton>
          )}
        </div>
      }
    >
      <p role="status" className="text-sm text-(--text-muted) empty:hidden">
        {message}
      </p>
      {revisions && (
        <div className="admin-revisions-layout">
          <Section
            title="Working copy"
            headerAside={
              <span className="admin-revision-version-badge">
                Working version {revisions.version}
              </span>
            }
          >
            <dl className="admin-working-copy-details">
              <div>
                <dt>Document title</dt>
                <dd>{revisions.current.title}</dd>
              </div>
              <div>
                <dt>Last modified:</dt>
                <dd>
                  <AdminTimestamp value={revisions.current.updatedAt} />
                  {currentAuthorName && <span> · {currentAuthorName}</span>}
                </dd>
              </div>
            </dl>
          </Section>
          <Section title="Revision history">
            <fieldset disabled={busy} className="admin-revision-timeline">
              <article className="admin-revision-entry admin-current-revision">
                <div className="admin-revision-date">
                  <AdminTimestamp value={revisions.current.updatedAt} />
                </div>
                <span className="admin-revision-marker" aria-hidden="true">
                  <FaHistory />
                </span>
                <div className="admin-revision-card">
                  <div className="admin-revision-card-heading">
                    <span>Working version {revisions.version}</span>
                    <span className="admin-revision-current-badge">
                      Current working copy
                    </span>
                  </div>
                  <strong>{revisions.current.title}</strong>
                  {currentAuthorName && (
                    <span className="admin-revision-author">
                      Modified by {currentAuthorName}
                    </span>
                  )}
                </div>
              </article>
              {revisions.revisions.map((revision, index) => (
                <article
                  className="admin-revision-entry"
                  data-selected={revision.id === selectedRevisionId}
                  key={revision.id}
                >
                  <div className="admin-revision-date">
                    <AdminTimestamp value={revision.createdAt} />
                  </div>
                  <span className="admin-revision-marker" aria-hidden="true">
                    <FaHistory />
                  </span>
                  <div
                    className="admin-revision-card"
                    data-selected={revision.id === selectedRevisionId}
                  >
                    <label className="admin-revision-select">
                      <input
                        type="radio"
                        name="saved-revision"
                        aria-label={`Select revision ${revision.workingVersion}: ${revision.title}`}
                        checked={revision.id === selectedRevisionId}
                        onChange={() => selectRevision(revision.id)}
                      />
                      <span className="admin-revision-card-copy">
                        <span className="admin-revision-card-heading">
                          <span>Revision {revision.workingVersion}</span>
                          {index === 0 && (
                            <span className="admin-revision-latest">
                              Latest saved
                            </span>
                          )}
                        </span>
                        <strong>{revision.title}</strong>
                        <span className="admin-revision-slug">
                          /{revision.slug}
                        </span>
                        {revision.authorName && (
                          <span className="admin-revision-author">
                            By {revision.authorName}
                          </span>
                        )}
                      </span>
                    </label>
                    <div className="admin-revision-actions">
                      <RevisionActionButton
                        revision={revision}
                        action="preview"
                        disabled={busy}
                        onAction={(action, id) => void perform(action, id)}
                      />
                      <RevisionActionButton
                        revision={revision}
                        action="restore"
                        disabled={busy}
                        onAction={(action, id) => void perform(action, id)}
                      />
                    </div>
                  </div>
                </article>
              ))}
              {revisions.revisions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <AdminAsyncButton
                    className="min-w-0 max-w-full"
                    color="primary"
                    disabled={!selectedRevisionId || busy}
                    loading={pending === "publish"}
                    onClick={() => void perform("publish")}
                  >
                    <FaCheck aria-hidden="true" />
                    {revisionActions.publish.label}
                  </AdminAsyncButton>
                  <AdminAsyncButton
                    className="min-w-0 max-w-full"
                    variant="ghost"
                    color="neutral"
                    disabled={!selectedRevisionId || busy}
                    loading={pending === "unpublish"}
                    onClick={() => void perform("unpublish")}
                  >
                    <FaEyeSlash aria-hidden="true" />
                    {revisionActions.unpublish.label}
                  </AdminAsyncButton>
                </div>
              )}
            </fieldset>
            {!revisions.revisions.length && (
              <div className="admin-revision-empty-state">
                <FaHistory aria-hidden="true" />
                <p>No saved revisions yet</p>
                <span>Previous document versions will appear here.</span>
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
