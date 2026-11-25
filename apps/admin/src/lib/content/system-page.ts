import { pageLayouts } from "@nextpress/shared/content";

export function isSystemPage(layout: string | undefined, slug: string) {
  return (
    layout === pageLayouts.home ||
    (layout === pageLayouts.posts && slug === "posts")
  );
}
