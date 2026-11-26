import {
  documentMime,
  maxMediaUploadBytes,
  MediaInputMimeSchema,
} from "@nextpress/shared/media";
import { useEffect, useRef } from "react";
import { BsFileEarmark, BsFileEarmarkPdf } from "react-icons/bs";

export function UploadThumbnail({ file }: { file: File }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canPreview =
    typeof createImageBitmap === "function" &&
    file.size <= maxMediaUploadBytes &&
    MediaInputMimeSchema.safeParse(file.type).success;

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    let cancelled = false;

    void createImageBitmap(file)
      .then((bitmap) => {
        try {
          if (!cancelled) {
            const size = Math.min(bitmap.width, bitmap.height);
            canvas
              .getContext("2d")
              ?.drawImage(
                bitmap,
                (bitmap.width - size) / 2,
                (bitmap.height - size) / 2,
                size,
                size,
                0,
                0,
                canvas.width,
                canvas.height,
              );
          }
        } finally {
          bitmap.close();
        }
      })
      .catch(() => {
        canvas.hidden = true;
      });

    return () => {
      cancelled = true;
    };
  }, [file, canPreview]);

  const Icon = file.type === documentMime ? BsFileEarmarkPdf : BsFileEarmark;

  return (
    <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-md bg-base-200">
      <Icon aria-hidden className="size-5" />
      {canPreview && (
        <canvas
          ref={canvasRef}
          aria-hidden
          width={88}
          height={88}
          className="absolute inset-0 size-full"
        />
      )}
    </span>
  );
}
