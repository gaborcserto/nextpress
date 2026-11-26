"use client";

import { maxGalleryImages, type EditorImage } from "@nextpress/shared/media";
import { useState } from "react";
import { FaImages } from "react-icons/fa";

import { AdminButton } from "@/ui/primitives";

import { MediaPicker } from "../MediaPicker/MediaPicker";
import { MediaThumbnail } from "../MediaThumbnail";
import { MediaUploads } from "../MediaUploads/MediaUploads";
import { useMediaMessages } from "../messages";

export function CoverMediaField({
  value,
  onChange,
  readOnly,
  disabled,
}: {
  value: EditorImage | null | undefined;
  onChange: (asset: EditorImage | null) => void;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const text = useMediaMessages();

  return (
    <fieldset className="block w-full min-w-0 space-y-2">
      <legend className="whitespace-nowrap font-semibold">{text.cover}</legend>
      {value && (
        <div className="w-full min-w-0">
          <MediaThumbnail asset={value} />
        </div>
      )}
      {!readOnly && (
        <div className="block w-full min-w-0 space-y-2">
          {!disabled && (
            <MediaUploads
              multiple={false}
              onUploaded={([asset]) => onChange(asset)}
            />
          )}
          <div className="flex flex-col items-center gap-2">
            <AdminButton
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => setOpen(true)}
            >
              <FaImages size={16} aria-hidden="true" />
              {text.choose}
            </AdminButton>
            {value && (
              <AdminButton
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => onChange(null)}
              >
                {text.remove}
              </AdminButton>
            )}
          </div>
        </div>
      )}
      {open && (
        <MediaPicker
          mode="images"
          onCancel={() => setOpen(false)}
          onConfirm={([asset]) => {
            if (asset) {
              onChange(asset);
              setOpen(false);
            }
          }}
        />
      )}
    </fieldset>
  );
}

export function GalleryMediaField({
  value,
  onChange,
  readOnly,
  disabled,
}: {
  value: readonly EditorImage[];
  onChange: (assets: EditorImage[]) => void;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const text = useMediaMessages();

  function move(index: number, target: number) {
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function add(selected: EditorImage[]) {
    const existing = new Set(value.map(({ id }) => id));
    onChange(
      [...value, ...selected.filter(({ id }) => !existing.has(id))].slice(
        0,
        maxGalleryImages,
      ),
    );
    setOpen(false);
  }

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="font-semibold">{text.gallery}</legend>
      {value.length === 0 && <p>{text.empty}</p>}
      <ol className="grid gap-2">
        {value.map((asset, index) => {
          const label = asset.filename ?? asset.id;

          return (
            <li
              key={asset.id}
              className="grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-2"
            >
              <MediaThumbnail asset={asset} />
              <div className="min-w-0 wrap-anywhere">
                <p>{label}</p>
                {!readOnly && (
                  <div className="flex flex-wrap gap-1">
                    <AdminButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`${text.up} ${label}`}
                      disabled={disabled}
                      aria-disabled={index === 0 || disabled}
                      onClick={() => {
                        if (index > 0) {
                          move(index, index - 1);
                        }
                      }}
                    >
                      {text.up}
                    </AdminButton>
                    <AdminButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`${text.down} ${label}`}
                      disabled={disabled}
                      aria-disabled={index === value.length - 1 || disabled}
                      onClick={() => {
                        if (index < value.length - 1) {
                          move(index, index + 1);
                        }
                      }}
                    >
                      {text.down}
                    </AdminButton>
                    <AdminButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`${text.remove} ${label}`}
                      disabled={disabled}
                      onClick={() =>
                        onChange(value.filter(({ id }) => id !== asset.id))
                      }
                    >
                      {text.remove}
                    </AdminButton>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {!readOnly && (
        <AdminButton
          type="button"
          variant="outline"
          disabled={disabled || value.length >= maxGalleryImages}
          onClick={() => setOpen(true)}
        >
          {text.chooseMany}
        </AdminButton>
      )}
      {open && (
        <MediaPicker
          mode="images"
          limit={maxGalleryImages - value.length}
          onCancel={() => setOpen(false)}
          onConfirm={add}
        />
      )}
    </fieldset>
  );
}
