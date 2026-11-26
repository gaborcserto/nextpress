import type { ListingKind } from "@/features/content/editor/contracts";

export type ListingFieldsProps = {
  listingKind?: ListingKind | null;
  listingTaxonomyId?: string | null;
  onChangeAction: (
    key: "listingKind" | "listingTaxonomyId",
    value: string | null,
  ) => void;
};
