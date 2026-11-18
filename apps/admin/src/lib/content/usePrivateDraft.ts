"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

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
  reloadAction: () => Promise<void>;
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

  if (!controller || !state || !editing) {
    return null;
  }

  return {
    ...state,
    contentKey,
    publicStatus: editing.draft.aggregate.publicState.status,
    pendingPrivateChanges:
      state.dirty ||
      state.version > editing.draft.version ||
      editing.draft.pendingPrivateChanges === true,
    history: editing.draft.history ?? [],
    legacyHistory: editing.draft.legacyHistory ?? [],
    release: editing.draft.aggregate.release,
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
        await editing.reloadAction();
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
      if (await controller.save("RESET")) {
        await editing.reloadAction();
      }
    },
    restore: async (version: number) => {
      if (!(await controller.save("RESTORE", version))) {
        throw new Error("Private restore was not acknowledged");
      }

      await editing.reloadAction();
    },
    restoreLegacy: async (id: string) => {
      if (!(await controller.save("RESTORE_LEGACY", undefined, id))) {
        throw new Error("Legacy restore was not acknowledged");
      }

      await editing.reloadAction();
    },
    reload: editing.reloadAction,
  };
}

export type PrivateDraftControls = NonNullable<
  ReturnType<typeof usePrivateDraft>
>;
