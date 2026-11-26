import { ContentMediaImage } from "../ContentMediaImage";
import { GalleryEmpty } from "./GalleryEmpty";
import styles from "./MediaGallery.module.css";

import type { GalleryImage } from "@nextpress/shared/media";

export function MediaGallery({ images = [] }: { images?: GalleryImage[] }) {
  if (!images.length) {
    return <GalleryEmpty />;
  }

  return (
    <ul className={styles.gallery}>
      {images.map((image) => (
        <li key={image.id}>
          <figure>
            <ContentMediaImage
              src={image.url}
              gif={image.gif}
              alt={image.alt ?? ""}
              width={image.width ?? 1200}
              height={image.height ?? 800}
              sizes="(max-width: 43rem) 100vw, (max-width: 72rem) 50vw, 360px"
            />
            {image.caption && <figcaption>{image.caption}</figcaption>}
          </figure>
        </li>
      ))}
    </ul>
  );
}
