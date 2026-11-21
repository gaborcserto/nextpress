"use client";

import { MediaIdSchema } from "@nextpress/shared/media";
import Image, { type ImageProps } from "next/image";
import { createContext, useContext, useEffect, useRef } from "react";

export const PreviewMediaContext = createContext<
  ((id: string, signal: AbortSignal) => Promise<ArrayBuffer | null>) | null
>(null);

type MediaProps = Pick<ImageProps, "alt" | "loading" | "sizes" | "style"> & {
  src: string;
  width: number;
  height: number;
};

export function ContentMediaImage({
  src,
  width,
  height,
  alt,
  ...props
}: MediaProps) {
  const load = useContext(PreviewMediaContext);
  const id = src.startsWith("/media/")
    ? MediaIdSchema.safeParse(src.slice(7))
    : null;

  if (load) {
    return id?.success ? (
      <PreviewImage
        key={id.data}
        id={id.data}
        width={width}
        height={height}
        alt={alt}
        load={load}
      />
    ) : null;
  }

  return (
    <Image
      src={src}
      width={width}
      height={height}
      alt={alt}
      {...props}
      unoptimized
    />
  );
}

function PreviewImage({
  id,
  width,
  height,
  alt,
  load,
}: {
  id: string;
  width: number;
  height: number;
  alt: string;
  load: NonNullable<React.ContextType<typeof PreviewMediaContext>>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;

    if (!canvas) {
      return;
    }

    const abort = new AbortController();

    async function draw(element: HTMLCanvasElement) {
      try {
        const bytes = await load(id, abort.signal);

        if (!bytes || abort.signal.aborted) {
          return;
        }

        const image = await createImageBitmap(
          new Blob([bytes], { type: "image/png" }),
        );

        try {
          if (!abort.signal.aborted) {
            const scale = Math.min(
              1,
              1024 / Math.max(image.width, image.height),
            );
            element.width = Math.max(1, Math.round(image.width * scale));
            element.height = Math.max(1, Math.round(image.height * scale));
            element
              .getContext("2d")
              ?.drawImage(image, 0, 0, element.width, element.height);
          }
        } finally {
          image.close();
        }
      } catch {
        // Failed media keeps its accessible name and reserved space.
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          void draw(canvas);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      abort.abort();
    };
  }, [id, load]);

  const scale = Math.min(1, 1024 / Math.max(width, height));

  return (
    <canvas
      ref={ref}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={!alt || undefined}
      style={{ width: "100%", height: "auto", display: "block" }}
      width={Math.max(1, Math.round(width * scale))}
      height={Math.max(1, Math.round(height * scale))}
    />
  );
}
