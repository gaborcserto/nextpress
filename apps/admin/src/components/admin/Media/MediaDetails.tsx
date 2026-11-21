"use client";

import {
  MediaAssetSchema,
  MediaDetailsSchema,
  MediaEditSchema,
  type MediaDetails as Asset,
} from "@nextpress/shared/media";
import { useState } from "react";
import useSWR from "swr";

import { ApiRequestError, apiFetch, jsonFetcher } from "@/lib/api";
import { Button, ConfirmDialog } from "@/ui/primitives";

import { MediaThumbnail } from "./MediaBrowser";
import { MediaDialog } from "./MediaDialog";
import { useMediaMessages } from "./messages";

const time = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

async function fetchDetails(url: string) {
  return MediaDetailsSchema.parse(
    await jsonFetcher<unknown>(url, { cache: "no-store" }),
  );
}

export function MediaDetails({
  id,
  onClose,
  onChange,
  onDelete,
}: {
  id: string;
  onClose: () => void;
  onChange: () => void;
  onDelete: () => void;
}) {
  const text = useMediaMessages();
  const endpoint = `/api/media/${id}/metadata`;
  const { data, error } = useSWR(endpoint, fetchDetails, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });

  return (
    <MediaDialog title={text.details} onClose={onClose}>
      {error && <p role="alert">{text.loadError}</p>}
      {!data && !error && <p role="status">{text.loading}</p>}
      {data && (
        <MetadataForm
          key={id}
          asset={data}
          endpoint={endpoint}
          onChange={onChange}
          onDelete={onDelete}
        />
      )}
    </MediaDialog>
  );
}

function MetadataForm({
  asset: initial,
  endpoint,
  onChange,
  onDelete,
}: {
  asset: Asset;
  endpoint: string;
  onChange: () => void;
  onDelete: () => void;
}) {
  const text = useMediaMessages();
  const [asset, setAsset] = useState(initial);
  const [decorative, setDecorative] = useState(initial.alt === "");
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [deleteFailure, setDeleteFailure] = useState("");

  async function save(form: FormData) {
    const alt = String(form.get("alt") ?? "").trim();
    const changes = MediaEditSchema.safeParse({
      alt: decorative ? "" : alt || null,
      caption: form.get("caption"),
      description: form.get("description"),
    });

    if (!changes.success) {
      setFailure(text.saveError);

      return;
    }

    setSaving(true);
    setFailure("");
    setNotice("");

    try {
      const response = await jsonFetcher<unknown>(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes.data),
      });
      setAsset({ ...MediaAssetSchema.parse(response), inUse: asset.inUse });
      setNotice(text.saved);
      onChange();
    } catch {
      setFailure(text.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    setDeleteFailure("");

    try {
      const response = await apiFetch(`/api/media/${asset.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new ApiRequestError("Delete failed", response.status);
      }

      onDelete();
    } catch (error) {
      setDeleteFailure(
        error instanceof ApiRequestError && error.status === 409
          ? text.deleteConflict
          : text.deleteError,
      );
    } finally {
      setDeleting(false);
    }
  }

  async function copy(value: string) {
    setFailure("");

    try {
      await navigator.clipboard.writeText(value);
      setNotice(text.copied);
    } catch {
      setFailure(text.copyError);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="min-w-0 space-y-3">
        <MediaThumbnail asset={asset} />
        <dl className="grid gap-2 text-sm wrap-anywhere">
          {[
            [text.id, asset.id, true],
            [text.filename, asset.filename],
            [text.imageType, text.image],
            [text.format, asset.originalMime],
            [text.mime, asset.mime],
            [
              text.size,
              asset.size === null
                ? null
                : `${new Intl.NumberFormat().format(asset.size)} B`,
            ],
            [
              text.dimensions,
              asset.width && asset.height
                ? `${asset.width} × ${asset.height}`
                : null,
            ],
            [text.createdAt, time.format(new Date(asset.createdAt))],
            [
              text.updatedAt,
              asset.updatedAt ? time.format(new Date(asset.updatedAt)) : null,
            ],
            [text.url, asset.url, true],
            [
              text.usage,
              asset.inUse === null
                ? null
                : asset.inUse
                  ? text.used
                  : text.unused,
            ],
          ].map(([label, value, canCopy]) => (
            <div key={String(label)}>
              <dt className="font-semibold">{label}</dt>
              <dd className="flex flex-wrap items-center gap-1">
                {value ?? text.unknown}
                {canCopy && typeof value === "string" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`${text.copy} ${label}`}
                    onClick={() => void copy(value)}
                  >
                    {text.copy}
                  </Button>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <form
        className="min-w-0 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save(new FormData(event.currentTarget));
        }}
      >
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="checkbox"
            checked={decorative}
            onChange={(event) => setDecorative(event.currentTarget.checked)}
          />
          {text.decorative}
        </label>
        <label className="grid gap-1">
          {text.alt}
          <input
            name="alt"
            className="input w-full"
            maxLength={500}
            defaultValue={asset.alt ?? ""}
            disabled={decorative || saving}
          />
        </label>
        <label className="grid gap-1">
          {text.caption}
          <textarea
            name="caption"
            className="textarea w-full"
            maxLength={500}
            defaultValue={asset.caption ?? ""}
            readOnly={saving}
          />
        </label>
        <label className="grid gap-1">
          {text.description}
          <textarea
            name="description"
            className="textarea w-full"
            maxLength={2000}
            defaultValue={asset.description ?? ""}
            readOnly={saving}
          />
        </label>
        {notice && <p role="status">{notice}</p>}
        {failure && (
          <p role="alert" className="text-error">
            {failure}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={saving}>
            {text.save}
          </Button>
          <Button
            type="button"
            variant="outline"
            color="error"
            disabled={saving || asset.inUse === true}
            onClick={() => setConfirm(true)}
          >
            {text.delete}
          </Button>
        </div>
        <ConfirmDialog
          open={confirm}
          title={text.deleteTitle}
          confirmLabel={text.delete}
          cancelLabel={text.cancel}
          confirmColor="error"
          loading={deleting}
          error={deleteFailure}
          onCancelAction={() => setConfirm(false)}
          onConfirmAction={() => void remove()}
        >
          {text.deleteConfirm}
        </ConfirmDialog>
      </form>
    </div>
  );
}
