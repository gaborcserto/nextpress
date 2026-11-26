import Image from "next/image";
import { useState } from "react";

import { useMessages } from "@/lib/i18n/client";

import type { MediaProps } from "../ContentMediaImage.types";

export function GifPlayback({
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
