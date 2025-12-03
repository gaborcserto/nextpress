"use client";

import { useState } from "react";
import {
  FaApple,
  FaGoogle,
  FaTwitter,
  FaGithub,
  FaFacebook,
  FaDiscord,
} from "react-icons/fa";

import type {
  Provider,
  ProviderIconMap,
  SignInFormOAuthRowProps,
} from "./SignInFormOAuthRow.types";
import { IconButton } from "@/ui/components/Buttons";

const ICONS: ProviderIconMap = {
  apple: FaApple,
  google: FaGoogle,
  twitter: FaTwitter,
  github: FaGithub,
  facebook: FaFacebook,
  discord: FaDiscord,
};

export function SignInFormOAuthRow({
  onProviderAction,
  providers = ["apple", "google", "twitter"],
  compact = false,
  stacked = false,
  labelOnMobile = false,
}: SignInFormOAuthRowProps) {
  const [loading, setLoading] = useState<Provider | null>(null);

  const handleProviderClick = async (provider: Provider) => {
    if (loading) return;
    setLoading(provider);
    try {
      await onProviderAction(provider);
    } finally {
      setLoading(null);
    }
  };

  const iconSize = compact ? 18 : 20;
  const itemSize = compact ? "h-11 min-w-[72px]" : "h-12 min-w-[88px]";

  return (
    <div
      className={
        stacked
          ? "mb-2 flex flex-col items-center gap-2"
          : "mb-2 flex flex-wrap items-center justify-center gap-3"
      }
    >
      {providers.map((provider) => {
        const Icon = ICONS[provider];
        const isLoading = loading === provider;

        return (
          <div key={provider} className="flex items-center justify-center">
            <IconButton
              aria-label={provider}
              icon={() => <Icon size={iconSize} />}
              onClick={() => handleProviderClick(provider)}
              loading={isLoading}
              className={[
                "rounded-xl border border-base-300 bg-base-100",
                "hover:bg-base-200 transition-colors",
                "flex items-center justify-center",
                itemSize,
                "px-5",
                "shadow-sm",
              ].join(" ")}
              variant="solid"
              color="neutral"
              size={compact ? "sm" : "md"}
              disabled={loading !== null}
            >
              {labelOnMobile && (
                <span className="ml-2 text-sm sm:hidden capitalize">
                  {provider}
                </span>
              )}
            </IconButton>
          </div>
        );
      })}
    </div>
  );
}

export default SignInFormOAuthRow;
