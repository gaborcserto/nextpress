"use client";

import { maxGalleryImages, type EditorImage } from "@nextpress/shared/media";
import { useState } from "react";

import { Button } from "@/ui/primitives";

import { MediaThumbnail } from "./MediaBrowser";
import { MediaPicker } from "./MediaPicker";
import { useMediaMessages } from "./messages";

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
    <fieldset className="min-w-0 space-y-2">
      <legend className="font-semibold">{text.cover}</legend>
      {value && (
        <div className="max-w-64">
          <MediaThumbnail asset={value} />
        </div>
      )}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => setOpen(true)}
          >
            {text.choose}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => onChange(null)}
            >
              {text.remove}
            </Button>
          )}
        </div>
      )}
      {open && (
        <MediaPicker
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
                    <Button
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
                    </Button>
                    <Button
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
                    </Button>
                    <Button
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
                    </Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          disabled={disabled || value.length >= maxGalleryImages}
          onClick={() => setOpen(true)}
        >
          {text.chooseMany}
        </Button>
      )}
      {open && (
        <MediaPicker
          limit={maxGalleryImages - value.length}
          onCancel={() => setOpen(false)}
          onConfirm={add}
        />
      )}
    </fieldset>
  );
}
