import type { PublicationState } from "@/lib/content/publication-status";
import type {
  ContentListQuery,
  ContentPagination,
} from "@/lib/content/useContentList";

export type ContentListItem = {
  id: string;
  title: string;
  authorName?: string | null;
  typeLabel?: string;
  slug: string;
  publicPath?: string;
  systemPage?: boolean;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  publicationState: PublicationState;
  createdAt?: string;
  scheduledAt?: string | null;
  updatedAt?: string | null;
  canDelete?: boolean;
};

export type ContentListProps = {
  /** Section heading, e.g. "Pages" or "Posts" */
  heading: string;
  /** Link to the "create new" screen */
  createHref: string;
  /** Label for the "create new" button */
  createLabel: string;
  /** Function that returns the edit URL for a given item id */
  editHrefAction: (id: string) => string;

  /** Items to render in the table */
  items: ContentListItem[];

  /** Loading flag while data is being fetched */
  isLoading?: boolean;
  error?: string;
  pagination?: ContentPagination;
  query?: ContentListQuery;
  pageTypes?: Record<string, string>;
  onRetryAction?: () => void;
  /** Id of the item currently being deleted (for loading spinner) */
  deletingId?: string | null;
  /** Optional delete handler. If omitted, the delete button is hidden. */
  onDeleteAction?: (id: string) => Promise<void>;
};
