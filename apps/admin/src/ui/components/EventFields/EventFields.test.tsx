import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import EventFields from "./EventFields";
import ListingFields from "../ListingFields/ListingFields";
import PageTypeField from "../PageTypeField/PageTypeField";
import RedirectField from "../RedirectField/RedirectField";

describe("Content field labels", () => {
  it("associates event labels with their inputs", () => {
    render(<EventFields values={{ type: "EVENT_PAGE", status: "DRAFT", title: "Event", slug: "event", content: [], tags: [], parentId: null, inHeaderMenu: false, inFooterMenu: false }} onChangeAction={vi.fn()} />);
    for (const label of ["Start date/time", "End date/time", "Location", "Registration URL"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("names listing, page type, and redirect controls", () => {
    render(<>
      <ListingFields listingKind={null} listingTaxonomyId={null} onChangeAction={vi.fn()} />
      <label htmlFor="page-type-test">Page type</label>
      <PageTypeField id="page-type-test" value="STANDARD" onChange={vi.fn()} />
      <RedirectField value={null} onChangeAction={vi.fn()} />
    </>);
    for (const label of ["Content type to list", "Filter by taxonomy (optional)", "Page type", "Redirect URL"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});
