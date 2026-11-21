"use client";

import { MediaIdSchema } from "@nextpress/shared/media";
import Image, { type ImageProps } from "next/image";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { useMessages } from "@/lib/i18n/client";

export const PreviewMediaContext = createContext<
  ((id: string, signal: AbortSignal) => Promise<ArrayBuffer | null>) | null
>(null);

type MediaProps = Pick<ImageProps, "alt" | "loading" | "sizes" | "style"> & {
  src: string;
  gif?: boolean;
  width: number;
  height: number;
};

export function ContentMediaImage({
  src,
  width,
  height,
  alt,
  gif,
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

  if (gif) {
    return <GifPlayback src={src} alt={alt} width={width} height={height} />;
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

function GifPlayback({
  src,
  alt,
  width,
  height,
}: Pick<MediaProps, "src" | "alt" | "width" | "height">) {
  const [show, setShow] = useState(false);
  const { media } = useMessages();

  return (
    <div>
      <button type="button" onClick={() => setShow(!show)}>
        {show ? media.hideGif : media.showGif}
        {alt && ` · ${alt}`}
      </button>
      {show && (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          style={{ width: "100%", height: "auto" }}
          unoptimized
        />
      )}
    </div>
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
  const [gif, setGif] = useState<{ url: string; loader: typeof load } | null>(
    null,
  );

  useEffect(() => {
    const canvas = ref.current;

    if (!canvas) {
      return;
    }

    const abort = new AbortController();
    let objectUrl: string | undefined;

    async function draw(element: HTMLCanvasElement) {
      try {
        const bytes = await load(id, abort.signal);

        if (!bytes || abort.signal.aborted) {
          return;
        }

        const signature = new TextDecoder().decode(bytes.slice(0, 6));

        if (signature === "GIF87a" || signature === "GIF89a") {
          objectUrl = URL.createObjectURL(
            new Blob([bytes], { type: "image/gif" }),
          );
          setGif({ url: objectUrl, loader: load });

          return;
        }

        const image = await createImageBitmap(new Blob([bytes]));

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

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [id, load]);

  if (gif?.loader === load) {
    return (
      <GifPlayback src={gif.url} alt={alt} width={width} height={height} />
    );
  }

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
