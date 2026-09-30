import type { Descendant } from "slate";

export type TagValue = {
  id: string;
  name: string;
  slug: string;
};

export type TagLoadOptionsFn = (query: string) => Promise<TagValue[]>;
export type TagCreateFn = (name: string) => Promise<TagValue>;
export type TagLoadEntityFn = (entityId: string) => Promise<TagValue[]>;
export type TagUpdateEntityFn = (
  entityId: string,
  tagIds: string[],
) => Promise<void>;

export type MediaValue = {
  id: string;
  url: string;
  alt?: string | null;
};

export type UploadFn = (file: File) => Promise<MediaValue>;

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
  type: PageType;
  status: PageStatus;
  slug: string;
  title: string;
  content: Descendant[];
  tags: TagValue[];
  parentId: string | null;
  inHeaderMenu: boolean;
  inFooterMenu: boolean;
  listingKind?: ListingKind | null;
  listingTaxonomyId?: string | null;
  eventStart?: string | null;
  eventEnd?: string | null;
  eventLocation?: string | null;
  registrationUrl?: string | null;
  redirectTo?: string | null;
};

export type PostStatus = "DRAFT" | "PUBLISHED";

export type PostFormValues = {
  status: PostStatus;
  slug: string;
  title: string;
  excerpt: Descendant[];
  content: Descendant[];
  tags: TagValue[];
  cover: MediaValue | null;
  publishedAt?: string | null;
};
