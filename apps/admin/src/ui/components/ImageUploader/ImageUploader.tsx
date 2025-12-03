"use client";
import { type DragEvent, useState, useRef } from "react";

import type { ImageUploaderProps, UploadFn } from "./ImageUploader.types";
import Alert from "@/ui/components/Alert";
import { Button } from "@/ui/components/Buttons";

/**
 * Default local uploader:
 * - POST /api/uploads
 * - body: FormData { file }
 * - response: { id: string; url: string; alt?: string }
 */
const defaultLocalUpload: UploadFn = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/uploads", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Upload failed");
  }

  const data = (await res.json()) as {
    id: string;
    url: string;
    alt?: string | null;
  };

  return {
    id: data.id,
    url: data.url,
    alt: data.alt ?? null,
  };
};

const cx = (...xs: Array<string | false | undefined>) =>
  xs.filter(Boolean).join(" ");

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

  const effectiveUploader: UploadFn = uploaderAction ?? defaultLocalUpload;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed.");
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const media = await effectiveUploader(file);
      onChangeAction(media);
    } catch (err) {
      console.error(err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setDragOver(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled || uploading) return;
    void handleFiles(e.dataTransfer.files); // ⬅ Itt a `void`
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled || uploading) return;
    setDragOver(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const removeImage = () => {
    onChangeAction(null);
  };

  return (
    <div className={cx("form-control w-full", className)}>
      {label && (
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
      )}

      <div
        className={cx(
          "border border-dashed rounded-xl p-4 flex flex-col gap-3 items-center justify-center text-sm cursor-pointer transition-colors",
          dragOver && "border-primary bg-primary/5",
          uploading && "opacity-70 cursor-progress"
        )}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => void handleFiles(e.target.files)}
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
                variant="outline"
                color="neutral"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                Change image
              </Button>
              <Button
                variant="ghost"
                color="error"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage();
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-center text-base-content/70">
            <span className="font-medium">
              Drag &amp; drop an image here, or click to browse
            </span>
            <span className="text-xs">
              PNG, JPG, GIF – max ~5MB (backend dependent)
            </span>
          </div>
        )}

        {uploading && (
          <span className="text-xs text-base-content/70">Uploading…</span>
        )}
      </div>

      {error && (
        <Alert
          message={error}
          status="error"
          className="mt-2"
        />
      )}
    </div>
  );
}
