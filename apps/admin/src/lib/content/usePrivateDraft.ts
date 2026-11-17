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
    reload: editing.reloadAction,
  };
}

export type PrivateDraftControls = NonNullable<
  ReturnType<typeof usePrivateDraft>
>;
