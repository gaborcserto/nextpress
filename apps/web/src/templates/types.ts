import type { WebsiteTemplateId, StylePresetId } from "@nextpress/shared";
import type {
  PublicSearchQuerySchema,
  PublicSearchResultSchema,
} from "@nextpress/shared/api-contracts";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import type { z } from "zod";

import type { PostListVariant } from "@/components/public-content/PostList";
import type {
  PublicContent,
  PublicTagBatch,
  PublicPostSummary,
} from "@/lib/content/public-content.server";

import type { BlogShell } from "./blog/BlogShell";

export type { WebsiteTemplateId, StylePresetId } from "@nextpress/shared";
export type HomeProps = {
  tagBatch?: PublicTagBatch;
  siteName: string;
  siteDescription: string;
  posts: PublicPostSummary[];
  listVariant: PostListVariant;
};
export type ArchiveProps = {
  title?: string;
  basePath?: string;
  posts: PublicPostSummary[];
  page: number;
  hasMore: boolean;
  postsPerPage: number;
  listingMode: "PAGINATION" | "LOAD_MORE";
  listVariant: PostListVariant;
};
export type TagIndexProps = PublicTagBatch & {
  page: number;
  tagsPerPage: number;
};
export type DetailProps = { content: PublicContent; children?: ReactNode };
export type PostProps = DetailProps & { additionalPosts?: PublicPostSummary[] };
export type WebsiteTemplate = {
  id: WebsiteTemplateId;
  presets: readonly StylePresetId[];
  views: {
    Shell: ComponentType<ComponentProps<typeof BlogShell>>;
    Home: ComponentType<HomeProps>;
    Archive: ComponentType<ArchiveProps>;
    Search: ComponentType<SearchProps>;
    Tags: ComponentType<TagIndexProps>;
    Post: ComponentType<PostProps>;
    Page: ComponentType<DetailProps>;
  };
};

export type SearchProps = {
  query: z.infer<typeof PublicSearchQuerySchema>;
  data: z.infer<typeof PublicSearchResultSchema>;
};
