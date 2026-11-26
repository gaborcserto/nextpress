"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import useSWR from "swr";

import { jsonFetcher } from "@/lib/api";
import { showToast } from "@/ui/utils";

import {
  legacyEditorRevalidation,
  prepareLegacyUpdate,
  reportLegacySaveFailure,
  type readLegacyUpdateResponse,
  type LegacySaveOutcome,
  type LegacyUpdate,
} from "./legacy-editor";

import type { PublicationFields } from "../publication/publication-status";

type LegacyEditorValues = PublicationFields & { title: string; slug: string };

type LegacyEditorOptions<T> = {
  id?: string;
  endpoint: string;
  listHref: string;
  label: "Page" | "Post";
  initial: T;
  create: (
    values: T,
  ) => Promise<{ ok: boolean; status: number; message?: string }>;
  update: (
    id: string,
    values: LegacyUpdate<T>,
    expectedVersion: number,
  ) => Promise<Awaited<ReturnType<typeof readLegacyUpdateResponse>>>;
};

export function useLegacyEditor<T extends LegacyEditorValues>({
  id,
  endpoint,
  listHref,
  label,
  initial,
  create,
  update,
}: LegacyEditorOptions<T>) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const isEdit = !!id;

  const { data, error, isLoading, mutate } = useSWR<{
    item: T & { workingVersion: number };
  }>(id ? `${endpoint}/${id}` : null, jsonFetcher, legacyEditorRevalidation);

  const item = isEdit ? (data?.item ?? null) : initial;
  const notFound = isEdit && !isLoading && !data?.item;

  const handleSubmit = async (values: T): Promise<LegacySaveOutcome> => {
    if (savingRef.current) {
      return false;
    }

    if (!values.title || !values.slug) {
      showToast("Title and slug are required.", "warning");

      return false;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      if (id && data?.item.workingVersion === undefined) {
        showToast("Reload the editor before saving.", "warning");

        return false;
      }

      if (id && data) {
        const submittedValues = prepareLegacyUpdate(values, data.item);

        const result = await update(
          id,
          submittedValues,
          data.item.workingVersion,
        );

        if (!result.ok) {
          reportLegacySaveFailure(result.status, true, result.message);

          return false;
        }

        const { workingVersion, ...publication } = result.acknowledgement;
        await mutate(
          { item: { ...values, ...publication, workingVersion } },
          { revalidate: false },
        );
        showToast(`${label} updated.`, "success");

        return publication;
      }

      const result = await create(values);

      if (!result.ok) {
        reportLegacySaveFailure(result.status, false, result.message);

        return false;
      }

      showToast(`${label} created.`, "success");
      router.push(listHref);

      return true;
    } catch {
      showToast(
        `Unable to ${isEdit ? "update" : "create"} ${label.toLowerCase()}. Please try again.`,
        "error",
      );

      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return {
    isEdit,
    item,
    isLoading,
    notFound,
    saving,
    error,
    handleSubmit,
  };
}
