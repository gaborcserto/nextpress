import { LocaleLink, UiText } from "@/lib/i18n/client";

import type { PreviewArchiveNavigation } from "@/templates/types";

export function ArchivePageLink({
  basePath,
  page,
  label,
  previewNavigation,
}: {
  basePath: string;
  page: number;
  label: "pagination.previous" | "pagination.next";
  previewNavigation?: PreviewArchiveNavigation;
}) {
  if (previewNavigation) {
    return (
      <button type="button" onClick={() => previewNavigation.changePage(page)}>
        <UiText id={label} />
      </button>
    );
  }

  return (
    <LocaleLink href={page === 1 ? basePath : `${basePath}?page=${page}`}>
      <UiText id={label} />
    </LocaleLink>
  );
}
