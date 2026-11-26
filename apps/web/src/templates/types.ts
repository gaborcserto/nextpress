import type { WebsiteTemplateId, StylePresetId } from "@nextpress/shared";
import type {
  PublicMenuItem,
  PublicSearchQuerySchema,
  PublicSearchResultSchema,
} from "@nextpress/shared/api-contracts";
import type { ComponentType, ReactNode } from "react";
import type { z } from "zod";

import type { PostListVariant } from "@/components/public-content/PostList";
import type {
  PublicContent,
  PublicTagBatch,
  PublicPostSummary,
} from "@/lib/content/public-content.server";

export type { WebsiteTemplateId, StylePresetId } from "@nextpress/shared";
export type ShellProps = {
  children: ReactNode;
  siteName: string;
  menus?: Record<"header" | "footer" | "sidebar", PublicMenuItem[]>;
  supportsSidebar?: boolean;
};

export type HomeProps = {
  tagBatch?: PublicTagBatch;
  siteName: string;
  siteDescription: string;
  posts: PublicPostSummary[];
  listVariant: PostListVariant;
};
export type PreviewArchiveNavigation = {
  changePage: (page: number) => void;
  loadPage: (
    page: number,
  ) => Promise<{ posts: PublicPostSummary[]; hasMore: boolean } | null>;
};
export type ArchiveProps = {
  title?: string;
  basePath?: string;
  pageSlug?: string;
  children?: ReactNode;
  posts: PublicPostSummary[];
  page: number;
  hasMore: boolean;
  postsPerPage: number;
  listingMode: "PAGINATION" | "LOAD_MORE";
  listVariant: PostListVariant;
  previewNavigation?: PreviewArchiveNavigation;
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
    Shell: ComponentType<ShellProps>;
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
