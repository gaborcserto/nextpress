export type ContentListItem = {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  author?: string | null;
  categories?: string[];
  tags?: string[];
  dateLabel?: string;
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
  /** Id of the item currently being deleted (for loading spinner) */
  deletingId?: string | null;
  /** Optional delete handler. If omitted, the delete button is hidden. */
  onDeleteAction?: (id: string) => void;

  /** Whether to render the Author column */
  showAuthor?: boolean;
  /** Whether to render the Categories column */
  showCategories?: boolean;
  /** Whether to render the Tags column */
  showTags?: boolean;
};
