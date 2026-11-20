"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { pageValuesToDto } from "@/lib/services/page.client";
import { postValuesToDto } from "@/lib/services/post.client";

import { PrivateDraftController } from "./private-draft-controller";

import type {
  WorkingAggregateEnvelope,
  WorkingPatch,
} from "@nextpress/shared/working-aggregate";
import type { Dispatch, SetStateAction } from "react";

import type { PageFormValues, PostFormValues } from "./contracts";

export type PrivateEditing = {
  draft: WorkingAggregateEnvelope;
  reloadAction: (
    canApply: () => boolean,
    acceptedVersion?: number,
  ) => Promise<void>;
  offerRecovery: boolean;
};

function formPatch(values: PageFormValues | PostFormValues): WorkingPatch {
  const dto =
    "type" in values ? pageValuesToDto(values) : postValuesToDto(values);

  return {
    title: dto.title,
    slug: dto.slug,
    content: dto.content,
    tagIds: dto.tagIds,
    ...("type" in values
      ? {
          layout: values.type,
          ...(dto.listingTaxonomyId !== undefined
            ? { listingTaxonomyId: dto.listingTaxonomyId }
            : {}),
          inHeaderMenu: values.inHeaderMenu,
          inFooterMenu: values.inFooterMenu,
        }
      : { excerpt: dto.excerpt }),
  };
}

export function usePrivateDraft<T extends PageFormValues | PostFormValues>(
  values: T,
  setValues: Dispatch<SetStateAction<T>>,
  editing?: PrivateEditing,
) {
  const [contentKey, setContentKey] = useState(0);
  const [recovering, setRecovering] = useState(editing?.offerRecovery ?? false);
  const [controller] = useState(() =>
    editing
      ? new PrivateDraftController(editing.draft, values, formPatch(values))
      : null,
  );
  const state = useSyncExternalStore(
    controller?.subscribe ?? (() => () => {}),
    controller?.snapshot ?? (() => null),
    controller?.snapshot ?? (() => null),
  );

  useEffect(() => {
    controller?.activate();

    return () => controller?.dispose();
  }, [controller]);

  useEffect(() => {
    controller?.update(values, formPatch(values));
  }, [controller, values]);

  const snapshot = state?.snapshot;
  const acknowledgedValues = controller?.acknowledgedValues();
  const savedPreview = useMemo(() => {
    if (!snapshot) {
      return null;
    }

    const { fields } = snapshot.snapshot;

    return {
      title: fields.title,
      slug: fields.slug,
      content: fields.content,
      excerpt: fields.excerpt,
      layout: fields.layout,
      pageDocument: snapshot.rawPageDocument,
      listingTagSlug:
        acknowledgedValues && "type" in acknowledgedValues
          ? (acknowledgedValues.listingTag?.slug ?? null)
          : null,
    };
  }, [snapshot, acknowledgedValues]);

  if (!controller || !state || !editing || !savedPreview) {
    return null;
  }

  const reload = (acceptedVersion?: number) =>
    controller.reload((canApply) =>
      editing.reloadAction(canApply, acceptedVersion),
    );
  const { snapshot: acknowledged, ...saveState } = state;

  return {
    ...saveState,
    contentKey,
    recovering,
    recover: () => setRecovering(false),
    savedPreview,
    publicState: acknowledged.publicState,
    pendingPrivateChanges:
      state.dirty ||
      state.version > editing.draft.version ||
      editing.draft.pendingPrivateChanges === true,
    history: editing.draft.history ?? [],
    legacyHistory: editing.draft.legacyHistory ?? [],
    release: acknowledged.release,
    publication: async (
      operation: "PUBLISH" | "UNPUBLISH" | "SCHEDULE" | "CANCEL_SCHEDULE",
      scheduledFor?: string,
    ) => {
      if (
        !(await controller.save(operation, undefined, undefined, scheduledFor))
      ) {
        throw new Error(
          "Publication command was not acknowledged; check status before retrying",
        );
      }

      if (!controller.hasLocalChanges()) {
        await reload(controller.snapshot().version);
      }
    },
    save: () => {
      controller.update(values, formPatch(values));

      return controller.save();
    },
    discardLocal: () => {
      const saved = controller.discardLocal();

      if (saved) {
        setValues(saved);
        setContentKey((key) => key + 1);
      }
    },
    reset: async () => {
      if (!(await controller.save("RESET"))) {
        throw new Error("Private discard was not acknowledged");
      }

      if (!controller.hasLocalChanges()) {
        await reload(controller.snapshot().version);
      }
    },
    restore: async (version: number) => {
      if (!(await controller.save("RESTORE", version))) {
        throw new Error("Private restore was not acknowledged");
      }

      if (!controller.hasLocalChanges()) {
        await reload(controller.snapshot().version);
      }
    },
    restoreLegacy: async (id: string) => {
      if (!(await controller.save("RESTORE_LEGACY", undefined, id))) {
        throw new Error("Legacy restore was not acknowledged");
      }

      if (!controller.hasLocalChanges()) {
        await reload(controller.snapshot().version);
      }
    },
    reload: () => reload(),
  };
}

export type PrivateDraftControls = NonNullable<
  ReturnType<typeof usePrivateDraft>
>;
