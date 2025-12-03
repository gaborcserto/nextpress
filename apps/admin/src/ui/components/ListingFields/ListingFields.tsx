"use client";

import type { ListingFieldsProps, ListingKind } from "./ListingFields.types";
import { Field, FormGrid12 } from "@/ui/components/FormGrid";
import Input from "@/ui/components/Input";
import Select from "@/ui/components/Select";
import type { ChangeEvent } from "react";

/**
 * Listing configuration fields:
 * - which content type to list
 * - optional taxonomy filter
 */
export default function ListingFields({
  listingKind,
  listingTaxonomyId,
  onChangeAction,
}: ListingFieldsProps) {

  const listingKindOptions: readonly { value: ListingKind; label: string }[] = [
    { value: "POSTS", label: "Posts" },
    { value: "PRODUCTS", label: "Products" },
    { value: "EVENTS", label: "Events" },
  ];

  const handleListingKindChange = (raw: string | number | "") => {
    if (!raw) {
      onChangeAction("listingKind", null);
      return;
    }
    onChangeAction("listingKind", raw as ListingKind);
  };

  const handleTaxonomyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    onChangeAction("listingTaxonomyId", raw ? raw : null);
  };

  return (
    <FormGrid12>
      <Field label="Content type to list" span={6}>
        <Select
          fullWidth
          value={listingKind ?? ""}
          placeholder="– select –"
          options={listingKindOptions}
          onChangeAction={handleListingKindChange}
        />
      </Field>

      <Field label="Filter by taxonomy (optional)" span={6}>
        <Input
          fullWidth
          placeholder="taxonomyId"
          value={listingTaxonomyId ?? ""}
          onChange={handleTaxonomyChange}
          clearable
        />
      </Field>
    </FormGrid12>
  );
}
