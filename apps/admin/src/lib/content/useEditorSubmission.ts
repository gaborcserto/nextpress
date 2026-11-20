import { useState } from "react";

import type { Dispatch, FormEvent, SetStateAction } from "react";

import type { LegacySaveOutcome } from "./legacy-editor";
import type { PublicationFields } from "./publication-status";

type FormValues = PublicationFields & { title: string; slug: string };

type EditorSubmission<T> = {
  form: T;
  setForm: Dispatch<SetStateAction<T>>;
  submitting: boolean;
  dirty: boolean;
  markSaved: (saved: T) => void;
  savePrivateDraft?: () => Promise<unknown>;
  onSubmitAction: (values: T) => LegacySaveOutcome | Promise<LegacySaveOutcome>;
};

export function useEditorSubmission<T extends FormValues>({
  form,
  setForm,
  submitting,
  dirty,
  markSaved,
  savePrivateDraft,
  onSubmitAction,
}: EditorSubmission<T>) {
  const [hasSaved, setHasSaved] = useState(false);
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

    if (savePrivateDraft) {
      await savePrivateDraft();

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

    markSaved(saved);
    setHasSaved(true);
  };

  let saveStatus = hasSaved ? "Saved" : "No unsaved changes";

  if (submitting) {
    saveStatus = "Saving...";
  } else if (saveFailed) {
    saveStatus = "Save failed. Your edits are retained. Retry saving.";
  } else if (dirty) {
    saveStatus = "Unsaved changes";
  }

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  return { handleSubmit, fieldErrors, clearFieldError, saveStatus };
}
