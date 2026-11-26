import { HomepageSelectionSchema } from "@nextpress/shared/api-contracts";
import { ContentLayoutSchema, pageLayouts } from "@nextpress/shared/content";
import { useEffect, useState } from "react";

import { jsonFetcher } from "@/lib/api";
import { useAdminLocale } from "@/lib/i18n/admin-locale";
import { Select } from "@/ui/primitives";

import type { PageTypeFieldProps } from "./PageTypeField.types";

const SUPPORTED_PAGE_TYPES = [
  { value: pageLayouts.standard, label: "Standard Page" },
  { value: pageLayouts.home, label: "Homepage — default landing page" },
  { value: pageLayouts.posts, label: "Posts Page" },
  { value: pageLayouts.gallery, label: "Gallery Page" },
];

const LEGACY_PAGE_TYPES = [
  { value: "HOMEPAGE", label: "Homepage" },
  { value: "LISTING", label: "Listing / Archive" },
  { value: "CONTACT", label: "Contact Page" },
  { value: "LANDING", label: "Landing Page" },
  { value: "REDIRECT", label: "Redirect Page" },
  { value: "DOWNLOAD", label: "Download Page" },
  { value: "CATEGORY_PAGE", label: "Category Page" },
  { value: "EVENT_PAGE", label: "Event Page" },
] as const;

/**
 * Simple select field for choosing the page type.
 */
export default function PageTypeField({
  id,
  value,
  onChange,
  pageId,
}: PageTypeFieldProps) {
  const hu = useAdminLocale() === "hu";
  const [homepageId, setHomepageId] = useState<string | null | undefined>();

  useEffect(() => {
    const controller = new AbortController();

    void jsonFetcher<unknown>("/api/pages?select=homepage", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) =>
        setHomepageId(HomepageSelectionSchema.parse(response).id),
      )
      .catch(() => {
        if (!controller.signal.aborted) {
          setHomepageId(null);
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <Select
      id={id}
      fullWidth
      value={value}
      hint={
        value === pageLayouts.home
          ? hu
            ? "Ez az oldal a webhely alapértelmezett nyitóoldala."
            : "This page is the website's default landing page."
          : homepageId && homepageId !== pageId
            ? hu
              ? "Már van nyitóoldal. Egyszerre csak egy Homepage oldal lehet."
              : "A Homepage already exists. Only one page can use this type."
            : undefined
      }
      options={[
        ...SUPPORTED_PAGE_TYPES.map((option) =>
          option.value === pageLayouts.home &&
          homepageId !== undefined &&
          homepageId !== null &&
          homepageId !== pageId
            ? { ...option, disabled: true }
            : option,
        ),
        ...LEGACY_PAGE_TYPES.filter((option) => option.value === value).map(
          (option) => ({
            ...option,
            label: `${option.label} (legacy)`,
            disabled: true,
          }),
        ),
      ]}
      placeholder="– select page type –"
      onChangeAction={(value) => {
        const parsed = ContentLayoutSchema.safeParse(value);

        if (parsed.success) {
          onChange(parsed.data);
        }
      }}
    />
  );
}
