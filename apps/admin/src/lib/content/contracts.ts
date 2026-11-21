import type { ContentLayout } from "@nextpress/shared/content";
import type { EditorImage } from "@nextpress/shared/media";
import type { PageDocument } from "@nextpress/shared/page-document";
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

export type MediaValue = EditorImage;

export type UploadFn = (file: File) => Promise<MediaValue>;

export type PageType = ContentLayout;

export type PageStatus = "DRAFT" | "PUBLISHED";
export type ListingKind = "POSTS" | "PRODUCTS" | "EVENTS";

export type PageFormValues = {
  pageDocument?: PageDocument | null;
  cover?: MediaValue | null;
  gallery?: MediaValue[];
  publishedAt?: string | null;
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
  listingTag?: TagValue | null;
  eventStart?: string | null;
  eventEnd?: string | null;
  eventLocation?: string | null;
  registrationUrl?: string | null;
  redirectTo?: string | null;
};

export type PostStatus = "DRAFT" | "PUBLISHED";

export type PostFormValues = {
  pageDocument?: PageDocument | null;
  status: PostStatus;
  slug: string;
  title: string;
  excerpt: Descendant[];
  content: Descendant[];
  tags: TagValue[];
  cover: MediaValue | null;
  publishedAt?: string | null;
};
