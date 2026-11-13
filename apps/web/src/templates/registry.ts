import "server-only";

import { DEFAULT_APPEARANCE, normalizeAppearance } from "@nextpress/shared";

import { BlogArchive } from "./blog/BlogArchive";
import { BlogHome } from "./blog/BlogHome";
import { BlogPage } from "./blog/BlogPage";
import { BlogPost } from "./blog/BlogPost";
import { BlogShell } from "./blog/BlogShell";
import { BlogTags } from "./blog/BlogTags";

import type { WebsiteTemplate, StylePresetId } from "./types";

export const websiteTemplates = [
  {
    id: "blog",
    // Local compiled availability is independent of catalog upgrades.
    presets: ["classic", "modern", "minimal"],
    views: {
      Shell: BlogShell,
      Home: BlogHome,
      Archive: BlogArchive,
      Tags: BlogTags,
      Post: BlogPost,
      Page: BlogPage,
    },
  },
] as const satisfies readonly WebsiteTemplate[];

export function resolveWebsiteTemplate(
  identity: unknown = DEFAULT_APPEARANCE.websiteTemplate,
  preset: unknown = DEFAULT_APPEARANCE.stylePreset,
) {
  const appearance = normalizeAppearance({
    websiteTemplate: identity,
    stylePreset: preset,
  });
  const template =
    websiteTemplates.find((entry) => entry.id === appearance.websiteTemplate) ??
    websiteTemplates[0];
  const stylePreset: StylePresetId =
    template.presets.find((entry) => entry === appearance.stylePreset) ??
    DEFAULT_APPEARANCE.stylePreset;

  return { ...template, stylePreset };
}
