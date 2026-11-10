import { z } from "zod";

/** Only identities with trusted compiled assets may appear here. */
export const PublicAppearanceSchema = z.strictObject({
  theme: z.literal("default").catch("default"),
  template: z.enum(["default", "compact"]).catch("default"),
  colorMode: z.enum(["light", "dark", "system"]).catch("light"),
});

export function resolvePublicAppearance(value: unknown) {
  const result = PublicAppearanceSchema.safeParse(value);

  return result.success ? result.data : PublicAppearanceSchema.parse({});
}

// Trusted build configuration shared by SSR and Load More's client rendering.
export const publicAppearance = resolvePublicAppearance({
  theme: "default",
  template: "default",
  colorMode: "light",
});
