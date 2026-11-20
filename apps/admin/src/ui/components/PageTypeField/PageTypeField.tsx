import { ContentLayoutSchema, pageLayouts } from "@nextpress/shared/content";

import { Select } from "@/ui/primitives";

import type { PageTypeFieldProps } from "./PageTypeField.types";

const SUPPORTED_PAGE_TYPES = [
  { value: pageLayouts.standard, label: "Standard Page" },
  { value: pageLayouts.home, label: "Home Page" },
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
}: PageTypeFieldProps) {
  return (
    <Select
      id={id}
      fullWidth
      value={value}
      options={[
        ...SUPPORTED_PAGE_TYPES,
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
