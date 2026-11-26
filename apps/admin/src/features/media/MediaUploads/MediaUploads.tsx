"use client";

import {
  documentMime,
  DocumentFilenameSchema,
  maxDocumentUploadBytes,
  maxMediaUploadBytes,
  MediaInputMimeSchema,
  type MediaAsset,
} from "@nextpress/shared/media";
import { useEffect, useId, useRef, useState } from "react";
import { FaCloudUploadAlt } from "react-icons/fa";
import { FaFileCirclePlus } from "react-icons/fa6";

import { ApiRequestError } from "@/lib/api";
import { useAdminLocale } from "@/lib/i18n/admin-locale";
import { AdminButton } from "@/ui/primitives";

import { useMediaMessages } from "../messages";
import { uploadMediaFile } from "./media-upload.client";
import { UploadThumbnail } from "./UploadThumbnail";

type Upload = {
  id: number;
  file: File;
  status:
    | "queued"
    | "uploading"
    | "uploaded"
    | "invalidFile"
    | "unsupportedAnimation"
    | "failedUpload"
    | "cancelled";
};
const batchLimit = 12;

export function MediaUploads({
  onUploaded,
  documents = false,
  all = false,
  multiple = true,
}: {
  onUploaded: (assets: MediaAsset[], complete: boolean) => void;
  documents?: boolean;
  all?: boolean;
  multiple?: boolean;
}) {
  const text = useMediaMessages(documents);
  const locale = useAdminLocale();
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const title = all ? text.uploadAssets : text.upload;
  const limit = multiple ? batchLimit : 1;
  const imageTypes = MediaInputMimeSchema.options.join(",");
  const accept = documents
    ? documentMime
    : [imageTypes, ...(all ? [documentMime] : [])].join(",");

  const imageFormats = MediaInputMimeSchema.options
    .map((mime) => mime.split("/")[1].toUpperCase())
    .join(", ");
  const imageLimit = `${imageFormats} · ${number.format(maxMediaUploadBytes / 1024 ** 2)} MiB`;
  const documentLimit = `PDF · ${number.format(maxDocumentUploadBytes / 1024 ** 2)} MiB`;
  const formats = documents
    ? documentLimit
    : all
      ? `${imageLimit} / ${documentLimit}`
      : imageLimit;

  const sequence = useRef(0);
  const busy = useRef(false);
  const stop = useRef(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [running, setRunning] = useState(false);
  const [tooMany, setTooMany] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(
    () => () => {
      stop.current = true;
    },
    [],
  );

  async function run(batch: Upload[]) {
    if (!batch.length || busy.current) {
      return;
    }

    busy.current = true;
    stop.current = false;
    setRunning(true);
    const uploaded: MediaAsset[] = [];

    function setStatus(id: number, status: Upload["status"]) {
      setUploads((previous) =>
        previous.map((item) => (item.id === id ? { ...item, status } : item)),
      );
    }

    try {
      for (const item of batch) {
        if (stop.current) {
          setStatus(item.id, "cancelled");
          continue;
        }

        const isDocument =
          documents || (all && item.file.type === documentMime);

        if (
          isDocument
            ? item.file.size > maxDocumentUploadBytes ||
              item.file.type !== documentMime ||
              !DocumentFilenameSchema.safeParse(item.file.name).success
            : item.file.size > maxMediaUploadBytes ||
              !MediaInputMimeSchema.safeParse(item.file.type).success
        ) {
          setStatus(item.id, "invalidFile");
          continue;
        }

        setStatus(item.id, "uploading");

        try {
          uploaded.push(await uploadMediaFile(item.file, isDocument));
          setStatus(item.id, "uploaded");
        } catch (error) {
          const unsupportedAnimation =
            error instanceof ApiRequestError &&
            error.status === 400 &&
            error.message === "Unsupported image animation";
          setStatus(
            item.id,
            unsupportedAnimation ? "unsupportedAnimation" : "failedUpload",
          );
        }
      }
    } finally {
      busy.current = false;
      setRunning(false);

      if (uploaded.length) {
        onUploaded(uploaded, uploaded.length === batch.length);
      }
    }
  }

  function select(files: FileList) {
    if (busy.current || files.length === 0) {
      return;
    }

    setTooMany(files.length > limit);

    if (files.length > limit) {
      return;
    }

    const batch = Array.from(files).map((file): Upload => ({
      id: sequence.current++,
      file,
      status: "queued",
    }));
    setUploads(batch);
    void run(batch);
  }

  return (
    <section
      className={`block w-full min-w-0 rounded-(--radius-surface) border border-dashed p-4 text-center transition-colors sm:p-6 ${dragging ? "border-primary bg-primary/10" : "border-(--field-border) bg-(--surface-rail)"}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setDragging(false);
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        select(event.dataTransfer.files);
      }}
    >
      <div className="grid min-w-0 justify-items-center gap-2">
        <span className="grid size-12 place-items-center rounded-full bg-base-200 text-primary">
          <FaCloudUploadAlt aria-hidden className="size-6" />
        </span>
        <p className="font-semibold text-base">
          {multiple ? text.dropFiles : text.singleUploadHint}
        </p>
        <p
          id={inputId + "-hint"}
          className="text-sm wrap-anywhere text-(--text-muted)"
        >
          {formats}
        </p>
        <button
          type="button"
          className="group inline-flex min-h-11 items-center justify-center rounded-sm px-2 font-semibold text-(--accent-text) transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-color) disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          disabled={running}
          aria-describedby={inputId + "-hint"}
          onClick={() => inputRef.current?.click()}
        >
          <span className="inline-flex items-center gap-2 border-b border-transparent transition-colors group-hover:border-current group-focus-visible:border-current motion-reduce:transition-none">
            <FaFileCirclePlus aria-hidden="true" className="size-4 shrink-0" />
            {multiple ? text.browseFiles : text.browseFile}
          </span>
        </button>
      </div>
      {running && (
        <progress
          className="progress progress-primary mt-4 block w-full"
          aria-label={text.uploading}
          max={uploads.length}
          value={
            uploads.filter(
              ({ status }) => status !== "queued" && status !== "uploading",
            ).length
          }
        />
      )}
      <input
        ref={inputRef}
        type="file"
        aria-label={title}
        multiple={multiple}
        accept={accept}
        disabled={running}
        hidden
        onChange={(event) => {
          if (event.currentTarget.files) {
            select(event.currentTarget.files);
            event.currentTarget.value = "";
          }
        }}
      />
      {uploads.length > 0 && (
        <ul
          className="mt-4 grid w-full min-w-0 gap-2 text-sm"
          aria-live="polite"
        >
          {uploads.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-base-300 p-2"
            >
              <UploadThumbnail file={item.file} />
              <div className="min-w-0 flex-1 wrap-anywhere">
                <p className="font-medium">{item.file.name}</p>
                <p className="text-(--text-muted)">
                  {number.format(item.file.size / 1024)} KiB ·{" "}
                  {text[item.status]}
                </p>
                {item.status === "uploading" && (
                  <progress
                    className="progress progress-primary w-full"
                    aria-label={`${text.uploading} ${item.file.name}`}
                  />
                )}
              </div>
              {item.status === "failedUpload" && (
                <AdminButton
                  type="button"
                  size="sm"
                  disabled={running}
                  onClick={() => void run([item])}
                >
                  {text.retry}
                </AdminButton>
              )}
              <AdminButton
                type="button"
                variant="ghost"
                size="sm"
                disabled={running}
                aria-label={`${text.removeUpload} ${item.file.name}`}
                onClick={() =>
                  setUploads((current) =>
                    current.filter(({ id }) => id !== item.id),
                  )
                }
              >
                {text.removeUpload}
              </AdminButton>
            </li>
          ))}
        </ul>
      )}
      {tooMany && (
        <p role="alert" className="mt-3 w-full text-error">
          {multiple ? text.tooMany : text.oneFile}
        </p>
      )}
      {running && uploads.some(({ status }) => status === "queued") && (
        <AdminButton
          type="button"
          variant="ghost"
          className="w-fit"
          onClick={() => {
            stop.current = true;
            setUploads((current) =>
              current.map((item) =>
                item.status === "queued"
                  ? { ...item, status: "cancelled" }
                  : item,
              ),
            );
          }}
        >
          {text.stop}
        </AdminButton>
      )}
    </section>
  );
}
