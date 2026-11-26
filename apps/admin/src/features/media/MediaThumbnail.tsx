import Image from "next/image";

import { safeImageUrl } from "@/lib/security/image-url";

export function MediaThumbnail({
  asset,
  showGif = false,
}: {
  showGif?: boolean;
  asset: {
    id: string;
    url: string;
    mime?: string | null;
    alt?: string | null;
    width?: number | null;
    height?: number | null;
  };
}) {
  const url =
    asset.url === `/media/${asset.id}`
      ? `/api/media/${asset.id}`
      : safeImageUrl(asset.url);

  if (!url) {
    return null;
  }

  if (asset.mime === "image/gif" && !showGif) {
    return (
      <span className="grid aspect-[4/3] place-items-center rounded-md bg-base-200">
        GIF
      </span>
    );
  }

  return (
    <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-md bg-base-200">
      <Image
        src={url}
        alt={asset.alt ?? ""}
        fill
        sizes="(max-width: 640px) 50vw, 240px"
        loading="lazy"
        unoptimized
        className="object-contain"
      />
    </span>
  );
}
