import type { ComponentType } from "react";

export type Provider =
  | "apple"
  | "google"
  | "twitter"
  | "github"
  | "facebook"
  | "discord";

export type SignInFormOAuthRowProps = {
  onProviderAction: (provider: Provider) => void | Promise<void>;
  providers?: Provider[];
  compact?: boolean;
  stacked?: boolean;
  labelOnMobile?: boolean;
};

export type ProviderIconMap = Record<
  Provider,
  ComponentType<{ size?: number }>
>;
