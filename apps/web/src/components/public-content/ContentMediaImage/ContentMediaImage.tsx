"use client";

import { MediaIdSchema } from "@nextpress/shared/media";
import Image from "next/image";
import { createContext, useContext } from "react";

import { GifPlayback } from "./components/GifPlayback";
import { PreviewImage } from "./components/PreviewImage";

import type { MediaProps, PreviewMediaLoader } from "./ContentMediaImage.types";

export const PreviewMediaContext = createContext<PreviewMediaLoader | null>(
  null,
);

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
