export type ColorMode = "light" | "dark";
export type ColorModePreference = ColorMode | "system";

export type SkinColorMode =
  | { readonly kind: "fixed" }
  | { readonly kind: "light-only" }
  | { readonly kind: "dark-only" }
  | {
      readonly kind: "switchable";
      readonly supportsSystem: false;
      readonly defaultPreference: ColorMode;
    }
  | {
      readonly kind: "switchable";
      readonly supportsSystem: true;
      readonly defaultPreference: ColorModePreference;
    };

/** Trusted application configuration; each identity has a compiled skin stylesheet. */
export type PublicSkin = {
  readonly id: string;
  readonly colorMode: SkinColorMode;
};

export const defaultSkin = {
  id: "default",
  colorMode: {
    kind: "switchable",
    supportsSystem: true,
    defaultPreference: "light",
  },
} as const satisfies PublicSkin;

// Site configuration can select another compiled skin here in a later phase.
export const activeSkin = defaultSkin;

/** Keep system unresolved for CSS; ignore preferences that the skin cannot support. */
export function resolveColorMode(
  skin: PublicSkin,
  preference?: unknown,
): ColorModePreference | undefined {
  const capability = skin.colorMode;

  switch (capability.kind) {
    case "fixed":
      return undefined;
    case "light-only":
      return "light";
    case "dark-only":
      return "dark";
    case "switchable":
      if (preference === "light" || preference === "dark") {
        return preference;
      }
      if (preference === "system" && capability.supportsSystem) {
        return "system";
      }
      return capability.defaultPreference;
  }
}
