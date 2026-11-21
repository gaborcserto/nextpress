"use client";

import {
  maxMediaUploadBytes,
  MediaAssetSchema,
  MediaInputMimeSchema,
} from "@nextpress/shared/media";
import { useEffect, useId, useRef, useState } from "react";

import { jsonFetcher } from "@/lib/api";
import { Button } from "@/ui/primitives";

import { useMediaMessages } from "./messages";

type Upload = {
  id: number;
  file: File;
  status:
    | "queued"
    | "uploading"
    | "uploaded"
    | "invalidFile"
    | "failedUpload"
    | "cancelled";
};
const batchLimit = 12;

async function upload(file: File) {
  const input = await file.arrayBuffer();
  const bytes = new Uint8Array(input);
  const chunks: string[] = [];

  for (let offset = 0; offset < bytes.length; offset += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  }

  const response = await jsonFetcher<unknown>("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      mime: file.type,
      data: btoa(chunks.join("")),
      alt: null,
    }),
  });

  return MediaAssetSchema.parse(response);
}

export function MediaUploads({ onUploaded }: { onUploaded: () => void }) {
  const text = useMediaMessages();
  const inputId = useId();
  const sequence = useRef(0);
  const busy = useRef(false);
  const stop = useRef(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [running, setRunning] = useState(false);
  const [tooMany, setTooMany] = useState(false);

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
    let uploaded = false;

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

        if (
          item.file.size > maxMediaUploadBytes ||
          !MediaInputMimeSchema.safeParse(item.file.type).success
        ) {
          setStatus(item.id, "invalidFile");
          continue;
        }

        setStatus(item.id, "uploading");

        try {
          await upload(item.file);
          uploaded = true;
          setStatus(item.id, "uploaded");
        } catch {
          setStatus(item.id, "failedUpload");
        }
      }
    } finally {
      busy.current = false;
      setRunning(false);

      if (uploaded) {
        onUploaded();
      }
    }
  }

  function select(files: FileList) {
    if (busy.current || files.length === 0) {
      return;
    }

    setTooMany(files.length > batchLimit);

    if (files.length > batchLimit) {
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
      className="grid gap-2 rounded-lg border border-dashed border-base-300 p-3"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        select(event.dataTransfer.files);
      }}
    >
      <label htmlFor={inputId} className="font-semibold">
        {text.upload}
      </label>
      <p id={inputId + "-hint"} className="text-sm text-(--text-muted)">
        {text.uploadHint}
      </p>
      <input
        id={inputId}
        type="file"
        multiple
        accept="image/png,image/jpeg"
        aria-describedby={inputId + "-hint"}
        disabled={running}
        className="file-input w-full max-w-sm"
        onChange={(event) => {
          if (event.currentTarget.files) {
            select(event.currentTarget.files);
            event.currentTarget.value = "";
          }
        }}
      />
      {uploads.length > 0 && (
        <ul className="grid gap-1 text-sm" aria-live="polite">
          {uploads.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-3 wrap-anywhere"
            >
              <span>{item.file.name}</span>
              <span>{text[item.status]}</span>
              {item.status === "failedUpload" && (
                <Button
                  type="button"
                  size="sm"
                  disabled={running}
                  onClick={() => void run([item])}
                >
                  {text.retry}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {tooMany && (
        <p role="alert" className="text-error">
          {text.tooMany}
        </p>
      )}
      {running && uploads.some(({ status }) => status === "queued") && (
        <Button
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
        </Button>
      )}
    </section>
  );
}
