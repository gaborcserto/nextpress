"use client";

import { useEffect, useState } from "react";

import {
  privatePageValues,
  privatePostValues,
  PrivateDraftRequestError,
  requestPrivateDraft,
} from "@/lib/content/private-draft.client";
import {
  createTagAction,
  loadEntityTagsAction,
  loadTagOptionsAction,
  updateEntityTagsAction,
} from "@/lib/services/tag.client";
import { PageForm } from "@/ui/shell/PageForm";
import { PostForm } from "@/ui/shell/PostForm";

import type { WorkingAggregateEnvelope } from "@nextpress/shared/working-aggregate";
import type { ReactNode } from "react";

type Admission =
  | { phase: "checking" }
  | { phase: "legacy" }
  | { phase: "error" }
  | { phase: "private"; draft: WorkingAggregateEnvelope; generation: number };

/** A rejected or uncertain private session never falls back to a legacy live-save handler. */
export function PrivateDraftBoundary({
  id,
  kind,
  children,
}: {
  id: string;
  kind: "PAGE" | "POST";
  children: ReactNode;
}) {
  const [admission, setAdmission] = useState<Admission>({ phase: "checking" });

  useEffect(() => {
    let active = true;

    requestPrivateDraft(id)
      .then((draft) => {
        if (active) {
          setAdmission(
            draft.aggregate.kind === kind
              ? { phase: "private", draft, generation: 0 }
              : { phase: "error" },
          );
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setAdmission(
            error instanceof PrivateDraftRequestError &&
              error.status === 503 &&
              error.code === "PRIVATE_DRAFT_DISABLED"
              ? { phase: "legacy" }
              : { phase: "error" },
          );
        }
      });

    return () => {
      active = false;
    };
  }, [id, kind]);

  if (admission.phase === "legacy") {
    return children;
  }

  if (admission.phase !== "private") {
    return (
      <p role="status">
        {admission.phase === "checking"
          ? "Checking private editing admission…"
          : "Private editing could not be loaded. Reload this page after checking access. No live save is available from this session."}
      </p>
    );
  }

  const editing = {
    draft: admission.draft,
    reloadAction: async () => {
      const draft = await requestPrivateDraft(id);

      if (draft.aggregate.kind !== kind) {
        throw new Error("Content type changed");
      }

      setAdmission({
        phase: "private",
        draft,
        generation: admission.generation + 1,
      });
    },
  };
  const tagActions = {
    createTagAction,
    loadEntityTagsAction,
    loadTagOptionsAction,
    updateEntityTagsAction,
  };

  return kind === "PAGE" ? (
    <PageForm
      key={admission.generation}
      initial={privatePageValues(admission.draft)}
      privateEditing={editing}
      onSubmitAction={() => false}
      submitLabel="Save private draft"
      sidebarTitle="Edit private Page"
      {...tagActions}
    />
  ) : (
    <PostForm
      key={admission.generation}
      initial={privatePostValues(admission.draft)}
      privateEditing={editing}
      onSubmitAction={() => false}
      submitLabel="Save private draft"
      sidebarTitle="Edit private Post"
      {...tagActions}
    />
  );
}
