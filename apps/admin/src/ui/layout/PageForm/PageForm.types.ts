import type { TagValue, TagLoadOptionsFn, TagCreateFn } from "@/ui/components/TagMultiSelect";
import type { Descendant } from "slate";

export type PageType =
  | "STANDARD"
  | "HOMEPAGE"
  | "LISTING"
  | "GALLERY"
  | "CONTACT"
  | "LANDING"
  | "REDIRECT"
  | "DOWNLOAD"
  | "CATEGORY_PAGE"
  | "EVENT_PAGE";

export type PageStatus = "DRAFT" | "PUBLISHED";

export type ListingKind = "POSTS" | "PRODUCTS" | "EVENTS";

export type PageFormValues = {
  // basic
  type: PageType;
  status: PageStatus;
  slug: string;
  title: string;
  content: Descendant[];

  // tags
  tags: TagValue[];

  // hierarchy / menu
  parentId: string | null;
  inHeaderMenu: boolean;
  inFooterMenu: boolean;

  // listing
  listingKind?: ListingKind | null;
  listingTaxonomyId?: string | null;

  // event
  eventStart?: string | null;
  eventEnd?: string | null;
  eventLocation?: string | null;
  registrationUrl?: string | null;

  // redirect
  redirectTo?: string | null;
};

export type PageFormProps = {
  initial: PageFormValues;
  onSubmitAction: (values: PageFormValues) => Promise<void> | void;
  submitting?: boolean;
  submitLabel?: string;

  /** Async tag search (required) */
  loadTagOptionsAction: TagLoadOptionsFn;

  /** Create new tag (required) */
  createTagAction: TagCreateFn;
  initialTags?: TagValue[];

  sidebarTitle?: string;
  sidebarSubtitle?: string;
};
