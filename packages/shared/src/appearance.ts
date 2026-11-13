import { z } from "zod";

/** Selectable options only: each entry has a compiled public implementation. */
export const APPEARANCE_CATALOG = [
  {
    id: "blog",
    label: "Blog",
    defaultPreset: "classic",
    presets: [
      { id: "classic", label: "Classic" },
      { id: "modern", label: "Modern" },
      { id: "minimal", label: "Minimal" },
    ],
  },
] as const;

const blog = APPEARANCE_CATALOG[0];
export const AppearanceSchema = z.strictObject({
  websiteTemplate: z.literal(blog.id),
  stylePreset: z.enum([
    blog.presets[0].id,
    blog.presets[1].id,
    blog.presets[2].id,
  ]),
  colorMode: z.enum(["light", "dark", "system"]),
});
export type Appearance = z.infer<typeof AppearanceSchema>;
export type WebsiteTemplateId = Appearance["websiteTemplate"];
export type StylePresetId = Appearance["stylePreset"];
export const DEFAULT_APPEARANCE: Appearance = {
  websiteTemplate: blog.id,
  stylePreset: blog.defaultPreset,
  colorMode: "light",
};

/** Wire identifiers may be obsolete, but malformed response shapes remain errors. */
export const PublicAppearanceSchema = z.strictObject({
  websiteTemplate: z.string(),
  stylePreset: z.string(),
  colorMode: z.string(),
});

export function normalizeAppearance(value: unknown): Appearance {
  const input = PublicAppearanceSchema.partial().safeParse(value);

  if (!input.success) {
    return { ...DEFAULT_APPEARANCE };
  }

  const template = APPEARANCE_CATALOG.find(
    (entry) => entry.id === input.data.websiteTemplate,
  );
  const colorMode = AppearanceSchema.shape.colorMode.safeParse(
    input.data.colorMode,
  );

  return {
    websiteTemplate: template?.id ?? DEFAULT_APPEARANCE.websiteTemplate,
    stylePreset:
      template?.presets.find((entry) => entry.id === input.data.stylePreset)
        ?.id ??
      template?.defaultPreset ??
      DEFAULT_APPEARANCE.stylePreset,
    colorMode: colorMode.success
      ? colorMode.data
      : DEFAULT_APPEARANCE.colorMode,
  };
}
