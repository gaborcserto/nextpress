import type { ContentLayout } from "@nextpress/shared/content";
import type { EditorImage } from "@nextpress/shared/media";
import type { PageDocument } from "@nextpress/shared/page-document";
import type { Descendant } from "slate";

import type { TagValue } from "@/features/taxonomy/tag.types";

export type PageType = ContentLayout;

export type PageStatus = "DRAFT" | "PUBLISHED";
export type ListingKind = "POSTS" | "PRODUCTS" | "EVENTS";

export type PageFormValues = {
  pageDocument?: PageDocument | null;
  cover?: EditorImage | null;
  gallery?: EditorImage[];
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
  cover: EditorImage | null;
  publishedAt?: string | null;
};
