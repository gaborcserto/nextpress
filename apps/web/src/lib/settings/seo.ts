import type { Metadata } from "next";

export function siteOrigin(): URL {
  const configured = process.env.SITE_URL;

  if (!configured && process.env.NODE_ENV === "production")
    throw new Error("SITE_URL is required for public canonical URLs");
  const origin = new URL(configured || "http://localhost:49100");

  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("SITE_URL must be a canonical HTTP(S) origin");

  return origin;
}

export function contentMetadata(
  title: string,
  pathname: string,
  description?: string,
): Metadata {
  const url = new URL(pathname, siteOrigin());

  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical: url },
    openGraph: {
      title,
      url,
      type: "website",
      ...(description ? { description } : {}),
    },
  };
}
