/** Identities compiled into both applications; styles and capabilities stay local. */
export const compiledSkins = [{ id: "default" }] as const;

export type SkinId = (typeof compiledSkins)[number]["id"];
export type Skin = { readonly id: SkinId };

export const defaultSkin = compiledSkins[0];

/** Stored values never determine imports or escape the compiled registry. */
export function resolveSkin(identity: unknown): Skin {
  return compiledSkins.find((skin) => skin.id === identity) ?? defaultSkin;
}
