"use client";

import { useState } from "react";

import { Button } from "@/ui/primitives/Buttons";
import { ConfirmDialog } from "@/ui/primitives/ConfirmDialog";

import type { PrivateDraftControls } from "@/lib/content/usePrivateDraft";

const recoveryConfirmation = {
  publish: {
    title: "Publish accepted private revision?",
    description:
      "The saved private revision will replace the public content atomically. Any pending scheduled release will be cancelled.",
  },
  unpublish: {
    title: "Unpublish content?",
    description:
      "Public visibility will be removed and any pending release cancelled. Historical content and revisions will remain retained.",
  },
  schedule: {
    title: "Schedule accepted private revision?",
    description:
      "The saved revision is pinned for the specified UTC instant. Current public content stays visible until execution. An existing pending release is replaced. Execution requires the deployment scheduler.",
  },
  cancelSchedule: {
    title: "Cancel scheduled release?",
    description:
      "The pending release will be cancelled. Its evidence and public content will remain retained.",
  },
  local: {
    title: "Discard local changes?",
    description:
      "Unsent local changes will be discarded. The last acknowledged private state is retained. Historical storage is unchanged.",
  },
  reset: {
    title: "Reset persisted private draft?",
    description:
      "This resets the working copy to the current live source. Earlier private revisions remain retained in immutable historical storage. Public content is unchanged.",
  },
  reload: {
    title: "Reload private draft?",
    description:
      "Unsaved local changes will be lost. Copy any edits you need before loading the latest private snapshot. No changes will be merged automatically.",
  },
  restore: {
    title: "Restore historical private revision?",
    description:
      "This appends a new private working revision from the selected historical content. Immutable history is retained. Public content and publication dates are unchanged.",
  },
  legacy: {
    title: "Restore historical legacy revision?",
    description:
      "Restore title, slug, excerpt, content, layout and page document into a new private draft. Other fields and relationships retain their current private values because legacy history did not record them. Historical author is the revision actor, not proof of past ownership or kind. History and public content remain unchanged. Publication requires a separate explicit command.",
  },
};

export function PrivateDraftStatus({ draft }: { draft: PrivateDraftControls }) {
  const [confirmation, setConfirmation] = useState<
    keyof typeof recoveryConfirmation | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [restoreVersion, setRestoreVersion] = useState("");
  const [legacyRevisionId, setLegacyRevisionId] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const publicationDisabled =
    busy ||
    draft.pending ||
    draft.dirty ||
    draft.phase !== "saved" ||
    draft.version === 0;
  const dialog = recoveryConfirmation[confirmation ?? "reload"];

  const confirm = async () => {
    setBusy(true);
    setError("");

    try {
      if (confirmation === "publish") {
        await draft.publication("PUBLISH");
      } else if (confirmation === "unpublish") {
        await draft.publication("UNPUBLISH");
      } else if (confirmation === "schedule") {
        await draft.publication("SCHEDULE", `${scheduledFor}:00Z`);
      } else if (confirmation === "cancelSchedule") {
        await draft.publication("CANCEL_SCHEDULE");
      } else if (confirmation === "local") {
        draft.discardLocal();
      } else if (confirmation === "reset") {
        await draft.reset();
      } else if (confirmation === "restore") {
        await draft.restore(Number(restoreVersion));
      } else if (confirmation === "legacy") {
        await draft.restoreLegacy(legacyRevisionId);
      } else {
        await draft.reload();
      }
      setConfirmation(null);
    } catch {
      setError(
        confirmation &&
          ["publish", "unpublish", "schedule", "cancelSchedule"].includes(
            confirmation,
          )
          ? "Publication command was not acknowledged. Check the draft status and retry the outstanding request before reloading. Your edits remain here."
          : "Private recovery was not completed. Check the draft status and retry an outstanding request, or reload after acknowledgment. Your current edits remain here.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="alert alert-info block mb-4" aria-label="Private draft">
      <p>
        Private editing. The live source is{" "}
        {draft.publicStatus === "PUBLISHED" ? "Published" : "Draft"}. These
        private changes require an explicit publication command. Save pending
        edits before publishing.
      </p>
      <p>
        {draft.pendingPrivateChanges
          ? "Pending private changes"
          : "Private content matches the public source"}
      </p>
      <p>
        Scheduled release:{" "}
        {draft.release
          ? `${draft.release.state} at ${draft.release.scheduledFor}`
          : "None"}
      </p>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <Button
          type="button"
          disabled={publicationDisabled}
          onClick={() => setConfirmation("publish")}
        >
          {draft.publicStatus === "PUBLISHED" ? "Publish Changes" : "Publish"}
        </Button>
        <Button
          type="button"
          disabled={publicationDisabled || draft.publicStatus !== "PUBLISHED"}
          onClick={() => setConfirmation("unpublish")}
        >
          Unpublish
        </Button>
        <label htmlFor="private-schedule">Publication time (UTC)</label>
        <input
          id="private-schedule"
          type="datetime-local"
          className="input input-bordered"
          value={scheduledFor}
          onChange={(event) => setScheduledFor(event.target.value)}
        />
        <Button
          type="button"
          disabled={
            publicationDisabled ||
            !scheduledFor ||
            Date.parse(`${scheduledFor}:00Z`) <= Date.now()
          }
          onClick={() => setConfirmation("schedule")}
        >
          {draft.release?.state === "PENDING" ? "Reschedule" : "Schedule"}
        </Button>
        <Button
          type="button"
          disabled={publicationDisabled || draft.release?.state !== "PENDING"}
          onClick={() => setConfirmation("cancelSchedule")}
        >
          Cancel Schedule
        </Button>
      </div>
      <p role="status" aria-live="polite">
        {draft.phase === "saving"
          ? "Saving private draft…"
          : draft.phase === "unsaved"
            ? "Unsaved private changes"
            : draft.phase === "saved"
              ? draft.version === 0
                ? "Loaded live source. No private revision saved yet."
                : `Private draft saved · revision ${draft.version}`
              : draft.message}
        {draft.savedAt && ` · Last acknowledged at ${draft.savedAt}`}
      </p>
      {draft.pending && draft.phase === "error" && (
        <p>
          Resolve the outstanding save with Retry before discarding or
          reloading. It may already have been stored.
        </p>
      )}
      <div className="flex flex-wrap gap-2 mt-2">
        {draft.phase === "error" && (
          <Button
            type="button"
            onClick={() => {
              void draft.save();
            }}
          >
            Retry private save
          </Button>
        )}
        <Button
          type="button"
          disabled={draft.pending || busy}
          onClick={() => setConfirmation("local")}
        >
          Discard local changes
        </Button>
        <Button
          type="button"
          disabled={draft.pending || busy}
          onClick={() => setConfirmation("reset")}
        >
          Reset private draft to live source
        </Button>
        <Button
          type="button"
          disabled={draft.pending || busy}
          onClick={() => setConfirmation("reload")}
        >
          Reload private draft
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <label htmlFor="private-revision">
          Private revision history (latest 100 at load)
        </label>
        <select
          id="private-revision"
          className="select select-bordered"
          value={restoreVersion}
          disabled={busy || draft.pending}
          onChange={(event) => setRestoreVersion(event.target.value)}
        >
          <option value="">Select a revision</option>
          {draft.history.map((revision) => (
            <option key={revision.version} value={revision.version}>
              {revision.version}: {revision.title}
            </option>
          ))}
        </select>
        <Button
          type="button"
          disabled={
            !restoreVersion ||
            busy ||
            draft.pending ||
            draft.dirty ||
            draft.phase !== "saved"
          }
          onClick={() => setConfirmation("restore")}
        >
          Restore to Draft
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <label htmlFor="legacy-revision">
          Supported legacy history (from latest 100 at load)
        </label>
        <select
          id="legacy-revision"
          className="select select-bordered"
          value={legacyRevisionId}
          disabled={busy || draft.pending}
          onChange={(event) => setLegacyRevisionId(event.target.value)}
        >
          <option value="">Select a legacy revision</option>
          {draft.legacyHistory.map((revision) => (
            <option key={revision.id} value={revision.id}>
              {revision.createdAt}: {revision.title}
            </option>
          ))}
        </select>
        <Button
          type="button"
          disabled={
            !legacyRevisionId ||
            busy ||
            draft.pending ||
            draft.dirty ||
            draft.phase !== "saved"
          }
          onClick={() => setConfirmation("legacy")}
        >
          Restore Legacy to Draft
        </Button>
      </div>
      <ConfirmDialog
        open={confirmation !== null}
        title={dialog.title}
        confirmLabel="Confirm"
        onCancelAction={() => setConfirmation(null)}
        onConfirmAction={() => {
          void confirm();
        }}
        loading={busy}
        error={error}
      >
        {dialog.description}
      </ConfirmDialog>
    </section>
  );
}
