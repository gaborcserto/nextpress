"use client";

import { type DragEvent, useRef, useState } from "react";

import type { ImageUploaderProps } from "./ImageUploader.types";
import { Alert, Button } from "@/ui/primitives";

const cx = (...values: Array<string | false | undefined>) =>
  values.filter(Boolean).join(" ");

export default function ImageUploader({
  label,
  value,
  onChangeAction,
  uploaderAction,
  disabled,
  className,
}: ImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadAvailable = Boolean(uploaderAction);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || !uploaderAction) return;

    const file = files[0];
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed.");
      return;
    }

    setError(null);
    setUploading(true);
    try {
      onChangeAction(await uploaderAction(file));
    } catch (caught) {
      console.error(caught);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setDragOver(false);
    }
  };

  const unavailable = disabled || uploading || !uploadAvailable;

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (unavailable) return;
    void handleFiles(event.dataTransfer.files);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (unavailable) return;
    setDragOver(true);
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
  };

  return (
    <div className={cx("form-control w-full", className)}>
      {label ? (
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
      ) : null}

      <div
        className={cx(
          "border border-dashed rounded-xl p-4 flex flex-col gap-3 items-center justify-center text-sm cursor-pointer transition-colors",
          dragOver && "border-primary bg-primary/5",
          uploading && "opacity-70 cursor-progress",
          !uploadAvailable && "opacity-70 cursor-not-allowed",
        )}
        aria-disabled={unavailable}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !unavailable && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          aria-label={label ?? "Upload image"}
          accept="image/*"
          className="hidden"
          disabled={unavailable}
          onChange={(event) => void handleFiles(event.target.files)}
        />

        {value ? (
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="w-full max-h-48 overflow-hidden rounded-lg border border-base-300 bg-base-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value.url}
                alt={value.alt ?? ""}
                className="w-full h-auto object-cover"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                color="neutral"
                size="sm"
                disabled={!uploadAvailable}
                onClick={(event) => {
                  event.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                Change image
              </Button>
              <Button
                type="button"
                variant="ghost"
                color="error"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onChangeAction(null);
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-center text-base-content/70">
            <span className="font-medium">
              {uploadAvailable
                ? "Drag & drop an image here, or click to browse"
                : "Image uploads are not configured"}
            </span>
            {uploadAvailable ? (
              <span className="text-xs">
                PNG, JPG, GIF (size limit depends on storage)
              </span>
            ) : null}
          </div>
        )}

        {uploading ? (
          <span className="text-xs text-base-content/70">Uploading...</span>
        ) : null}
      </div>

      <Alert message={error} status="error" className="mt-2" />
    </div>
  );
}
