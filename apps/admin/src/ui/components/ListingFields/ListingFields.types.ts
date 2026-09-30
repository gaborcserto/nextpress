import type { ListingKind } from "@/lib/content/contracts";

export type ListingFieldsProps = {
  listingKind?: ListingKind | null;
  listingTaxonomyId?: string | null;
  onChangeAction: (key: "listingKind" | "listingTaxonomyId", value: string | null) => void;
};
