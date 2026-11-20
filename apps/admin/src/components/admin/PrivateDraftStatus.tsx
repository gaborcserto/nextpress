"use client";

import { useEffect, useState } from "react";

import { Button } from "@/ui/primitives/Buttons";
import { ConfirmDialog } from "@/ui/primitives/ConfirmDialog";
import { Select } from "@/ui/primitives/Select";

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

export function PrivateDraftRecovery({
  draft,
}: {
  draft: PrivateDraftControls;
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function discard() {
    setBusy(true);
    setError("");

    try {
      await draft.reset();
      setConfirmDiscard(false);
    } catch {
      setError(
        "Discard could not be confirmed. Cancel this dialog and open the draft to check its status or retry an outstanding request.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-private-draft" aria-label="Recover private draft">
      <h2 className="font-semibold">Recover private draft</h2>
      <p>
        Private revision {draft.version} has edits that differ from the
        authoritative content.
      </p>
      <p>
        {draft.savedAt ? (
          <>
            Saved{" "}
            <time dateTime={draft.savedAt}>
              {new Date(draft.savedAt).toLocaleString()}
            </time>
          </>
        ) : (
          "Save time unavailable for this revision."
        )}
      </p>
      <p role="status">{draft.message}</p>
      <div className="flex flex-wrap gap-2 mt-2">
        <Button type="button" disabled={busy} onClick={draft.recover}>
          Recover private draft
        </Button>
        <Button
          type="button"
          disabled={busy || draft.pending}
          onClick={() => setConfirmDiscard(true)}
        >
          Discard recovery draft
        </Button>
      </div>
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard recovery draft?"
        confirmLabel="Discard recovery draft"
        onCancelAction={() => setConfirmDiscard(false)}
        onConfirmAction={() => {
          void discard();
        }}
        loading={busy}
        error={error}
      >
        {recoveryConfirmation.reset.description}
      </ConfirmDialog>
    </section>
  );
}

export function PrivateDraftStatus({ draft }: { draft: PrivateDraftControls }) {
  const [confirmation, setConfirmation] = useState<
    keyof typeof recoveryConfirmation | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [restoreVersion, setRestoreVersion] = useState("");
  const [legacyRevisionId, setLegacyRevisionId] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [scheduleIsFuture, setScheduleIsFuture] = useState(false);
  const scheduledTime = Date.parse(`${scheduledFor}:00Z`);

  useEffect(() => {
    if (!scheduleIsFuture) {
      return;
    }

    let timer: ReturnType<typeof setTimeout>;

    function waitForExpiry() {
      const remaining = scheduledTime - Date.now();
      timer = setTimeout(
        () => {
          if (Date.now() < scheduledTime) {
            waitForExpiry();
          } else {
            setScheduleIsFuture(false);
          }
        },
        Math.max(0, Math.min(remaining, 2_147_483_647)),
      );
    }

    waitForExpiry();

    return () => clearTimeout(timer);
  }, [scheduledTime, scheduleIsFuture]);

  const changeSchedule = (value: string) => {
    setScheduledFor(value);
    setScheduleIsFuture(Date.parse(`${value}:00Z`) > Date.now());
  };

  const requestSchedule = () => {
    if (scheduledTime > Date.now()) {
      setError("");
      setConfirmation("schedule");
    } else {
      setScheduleIsFuture(false);
    }
  };
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
        if (scheduledTime <= Date.now()) {
          setScheduleIsFuture(false);
          setError("Choose a publication time in the future.");

          return;
        }

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
    <section
      className="admin-private-draft"
      id="private-publication"
      aria-label="Private draft"
    >
      <h2 className="font-semibold">Private draft</h2>
      <p>
        Private changes require an explicit publication command. Save pending
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
          {draft.publicState.status === "PUBLISHED"
            ? "Publish Changes"
            : "Publish"}
        </Button>
        <Button
          type="button"
          disabled={
            publicationDisabled || draft.publicState.status !== "PUBLISHED"
          }
          onClick={() => setConfirmation("unpublish")}
        >
          Unpublish
        </Button>
      </div>
      <details
        className="admin-editor-disclosure"
        open={draft.release?.state === "PENDING" || undefined}
      >
        <summary>Schedule publication</summary>
        <div className="space-y-2 pt-2">
          <label htmlFor="private-schedule" className="block">
            Publication time (UTC)
          </label>
          <input
            id="private-schedule"
            type="datetime-local"
            className="input w-full"
            value={scheduledFor}
            onChange={(event) => changeSchedule(event.target.value)}
          />
          <Button
            type="button"
            disabled={publicationDisabled || !scheduleIsFuture}
            onClick={requestSchedule}
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
      </details>
      {draft.savedAt && (
        <p>
          Last acknowledged at{" "}
          <time dateTime={draft.savedAt}>
            {new Date(draft.savedAt).toLocaleString()}
          </time>
        </p>
      )}
      {draft.pending && draft.phase === "error" && (
        <p>
          Resolve the outstanding save with Retry before discarding or
          reloading. It may already have been stored.
        </p>
      )}
      <details
        className="admin-editor-disclosure"
        open={
          draft.phase === "error" || draft.phase === "conflict" || undefined
        }
      >
        <summary>Draft recovery and history</summary>
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
            disabled={draft.pending || busy || !draft.dirty}
            onClick={() => setConfirmation("local")}
          >
            Discard local changes
          </Button>
          <Button
            type="button"
            disabled={draft.pending || busy || draft.phase === "unsaved"}
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
          <Select
            id="private-revision"
            label="Private revision history (latest 100 at load)"
            fullWidth
            value={restoreVersion}
            disabled={busy || draft.pending}
            options={[
              { value: "", label: "Select a revision" },
              ...draft.history.map((revision) => ({
                value: String(revision.version),
                label: `${revision.version}: ${revision.title}`,
              })),
            ]}
            onChangeAction={setRestoreVersion}
          />
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
          <Select
            id="legacy-revision"
            label="Supported legacy history (from latest 100 at load)"
            value={legacyRevisionId}
            disabled={busy || draft.pending}
            options={[
              { value: "", label: "Select a legacy revision" },
              ...draft.legacyHistory.map((revision) => ({
                value: revision.id,
                label: `${revision.createdAt}: ${revision.title}`,
              })),
            ]}
            onChangeAction={setLegacyRevisionId}
          />
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
      </details>
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
