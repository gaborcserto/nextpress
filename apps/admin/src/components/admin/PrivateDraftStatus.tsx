"use client";

import { useState } from "react";

import { Button } from "@/ui/primitives/Buttons";
import { ConfirmDialog } from "@/ui/primitives/ConfirmDialog";

import type { PrivateDraftControls } from "@/lib/content/usePrivateDraft";

export function PrivateDraftStatus({ draft }: { draft: PrivateDraftControls }) {
  const [confirmation, setConfirmation] = useState<
    "local" | "reset" | "reload" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setBusy(true);
    setError("");

    try {
      if (confirmation === "local") {
        draft.discardLocal();
      } else if (confirmation === "reset") {
        await draft.reset();
      } else {
        await draft.reload();
      }
      setConfirmation(null);
    } catch {
      setError(
        "Unable to reload the private draft. Your current edits remain here.",
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
        changes do not alter the public version. Publishing is unavailable in
        this private editing rehearsal.
      </p>
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
      <ConfirmDialog
        open={confirmation !== null}
        title={
          confirmation === "reset"
            ? "Reset persisted private draft?"
            : confirmation === "local"
              ? "Discard local changes?"
              : "Reload private draft?"
        }
        confirmLabel="Confirm"
        onCancelAction={() => setConfirmation(null)}
        onConfirmAction={() => {
          void confirm();
        }}
        loading={busy}
        error={error}
      >
        {confirmation === "reset"
          ? "This resets the working copy to the current live source. Earlier private revisions remain retained in immutable historical storage. Public content is unchanged."
          : confirmation === "local"
            ? "Unsent local changes will be discarded. The last acknowledged private state is retained. Historical storage is unchanged."
            : "Unsaved local changes will be lost. Copy any edits you need before loading the latest private snapshot. No changes will be merged automatically."}
      </ConfirmDialog>
    </section>
  );
}
