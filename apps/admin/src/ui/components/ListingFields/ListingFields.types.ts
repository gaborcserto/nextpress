export type ListingKind = "POSTS" | "PRODUCTS" | "EVENTS";

export type ListingFieldsProps = {
  listingKind?: ListingKind | null;
  listingTaxonomyId?: string | null;
  onChangeAction: (key: "listingKind" | "listingTaxonomyId", value: string | null) => void;
};
