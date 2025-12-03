import type { PageTypeFieldProps } from "./PageTypeField.types";
import Select from "@/ui/components/Select";
import type { PageType } from "@/ui/layout/PageForm"

const PAGE_TYPE_OPTIONS = [
  { value: "STANDARD",      label: "Standard Page" },
  { value: "HOMEPAGE",      label: "Homepage" },
  { value: "LISTING",       label: "Listing / Archive" },
  { value: "GALLERY",       label: "Gallery Page" },
  { value: "CONTACT",       label: "Contact Page" },
  { value: "LANDING",       label: "Landing Page" },
  { value: "REDIRECT",      label: "Redirect Page" },
  { value: "DOWNLOAD",      label: "Download Page" },
  { value: "CATEGORY_PAGE", label: "Category Page" },
  { value: "EVENT_PAGE",    label: "Event Page" },
] as const;

/**
 * Simple select field for choosing the page type.
 */
export default function PageTypeField({ value, onChange }: PageTypeFieldProps) {
  return (
    <Select
      fullWidth
      value={value}
      options={PAGE_TYPE_OPTIONS}
      placeholder="– select page type –"
      onChangeAction={(val) => onChange(val as PageType)}
    />
  );
}
