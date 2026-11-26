import { useState } from "react";

import { useUnsavedChanges } from "./useUnsavedChanges";
import { usePrivateDraft } from "../private-drafts/usePrivateDraft";

import type { WorkingPatch } from "@nextpress/shared/working-aggregate";
import type { Dispatch, FormEvent, SetStateAction } from "react";

import type { PageFormValues, PostFormValues } from "./contracts";
import type { LegacySaveOutcome } from "./legacy-editor";
import type { PrivateEditing } from "../private-drafts/usePrivateDraft";
import type { PublicationFields } from "../publication/publication-status";

type FormValues = PageFormValues | PostFormValues;

type EditorSubmission<T> = {
  form: T;
  setForm: Dispatch<SetStateAction<T>>;
  submitting: boolean;
  privateEditing?: PrivateEditing;
  formPatch: (values: T) => WorkingPatch;
  onSubmitAction: (values: T) => LegacySaveOutcome | Promise<LegacySaveOutcome>;
};

export function useEditorSubmission<T extends FormValues>({
  form,
  setForm,
  submitting,
  privateEditing,
  formPatch,
  onSubmitAction,
}: EditorSubmission<T>) {
  const privateDraft = usePrivateDraft(
    form,
    setForm,
    formPatch,
    privateEditing,
  );
  const unsaved = useUnsavedChanges(form, false, privateDraft?.dirty);
  const [savedPublication, setSavedPublication] =
    useState<PublicationFields | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    slug?: string;
  }>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const errors = {
      ...(form.title.trim() ? {} : { title: "Title is required." }),
      ...(form.slug.trim() ? {} : { slug: "Slug is required." }),
    };
    setFieldErrors(errors);

    if (Object.keys(errors).length) {
      return;
    }

    setSaveFailed(false);

    if (privateDraft) {
      await privateDraft.save();

      return;
    }

    const outcome = await onSubmitAction(form);

    if (!outcome) {
      setSaveFailed(true);

      return;
    }

    const saved = outcome === true ? form : { ...form, ...outcome };

    if (outcome !== true) {
      setForm((current) => ({
        ...current,
        status: current.status === form.status ? saved.status : current.status,
        publishedAt:
          current.publishedAt === form.publishedAt
            ? saved.publishedAt
            : current.publishedAt,
      }));
    }

    unsaved.markSaved(saved);
    setSavedPublication({
      status: saved.status,
      publishedAt: saved.publishedAt,
    });
  };

  let saveStatus = savedPublication ? "Saved" : "No unsaved changes";

  if (submitting) {
    saveStatus = "Saving...";
  } else if (saveFailed) {
    saveStatus = "Save failed. Your edits are retained. Retry saving.";
  } else if (unsaved.dirty) {
    saveStatus = "Unsaved changes";
  }

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  return {
    privateDraft,
    unsaved,
    handleSubmit,
    fieldErrors,
    clearFieldError,
    saveStatus,
    savedPublication,
  };
}
