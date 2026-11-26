import { AdminButton } from "@/ui/primitives/Buttons";

import type { ContentPagination } from "@/hooks/useContentList";

type DataListPaginationProps = {
  heading: string;
  pagination: ContentPagination;
};

export default function DataListPagination({
  heading,
  pagination,
}: DataListPaginationProps) {
  const { page, metadata, busy, hasNextPage, onPageAction } = pagination;
  let summary = `Page ${page}`;

  if (metadata) {
    if (metadata.pages === 0) {
      summary = "0 results";
    } else {
      const first = Math.min(
        (metadata.page - 1) * metadata.limit + 1,
        metadata.total,
      );
      const last = Math.min(metadata.page * metadata.limit, metadata.total);
      summary = `Page ${metadata.page} of ${metadata.pages}. ${first} to ${last} of ${metadata.total} results`;
    }
  }

  return (
    <nav
      aria-label={`${heading} pagination`}
      className="flex min-w-0 flex-wrap items-center justify-between gap-3"
    >
      <p
        role={metadata ? "status" : undefined}
        className="min-w-0 break-words text-sm"
      >
        {summary}
      </p>
      <div className="flex flex-wrap gap-2">
        <AdminButton
          variant="outline"
          className="min-h-11"
          disabled={busy || page <= 1}
          onClick={() => onPageAction(page - 1)}
        >
          Previous
        </AdminButton>
        <AdminButton
          variant="outline"
          className="min-h-11"
          disabled={busy || !hasNextPage}
          onClick={() => onPageAction(page + 1)}
        >
          Next
        </AdminButton>
      </div>
    </nav>
  );
}
