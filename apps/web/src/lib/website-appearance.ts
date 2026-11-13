import "server-only";

import { normalizeAppearance } from "@nextpress/shared";

import { resolvePostListTemplate } from "@/components/public-content/templates";
import { resolveWebsiteTemplate } from "@/templates/registry";

import { publicAppearance } from "./appearance";

/** One resolver for the document and every route; registry imports stay server-only. */
export function resolveWebsiteAppearance(value: unknown) {
  const appearance = normalizeAppearance(value);
  const template = resolveWebsiteTemplate(
    appearance.websiteTemplate,
    appearance.stylePreset,
  );

  return {
    websiteTemplate: template.id,
    stylePreset: template.stylePreset,
    colorMode: appearance.colorMode,
    views: template.views,
    listVariant: resolvePostListTemplate(publicAppearance.template).id,
  };
}
