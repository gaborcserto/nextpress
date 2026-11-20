# ADR-001 Page type designations

- Status: Accepted

## Decision

Use the existing `PageLayout` field across the editor, private working snapshots and published page records. Preserve legacy layout values, including `HOMEPAGE` and `LISTING`, as ordinary public page content. An editor can explicitly convert a legacy page to one of the new behaviors. Existing Standard pages and `/pages/{slug}` URLs continue to work.

PostgreSQL gives published `PAGE` records with layout `HOME` a single shared slot. Drafts can carry the designation without reserving the slot. Legacy scheduled publication uses a published row with a future date and reserves the slot. A private scheduled release stays private until execution and acquires the slot when it publishes. A published record needs a due, non-null publication date to appear at the root. Withdraw the current Home page or change its type to free the slot. `GET /api/public/home` returns 404 when no eligible homepage exists, and Web uses the existing localized homepage.

A Posts page can use `listingTaxonomyId` to reference an existing tag. Clearing the editor filter removes the reference. The public API projects the taxonomy type and slug, and Web reuses the published taxonomy or all-posts archive queries and the configured listing mode. The page's own URL carries `?page=N`; `/posts` and `/search` keep their current meanings. Changing the page type preserves its body and dormant listing configuration.

Gallery pages render their content with a localized empty state. The existing ordered page-media relation can support future gallery delivery. Media attachment, gallery presentation, and editable navigation stay in their own phases.

The upgrade is additive and requires no record rewrite. Deploy both Prisma migrations before deploying the updated API. If using the guarded private publication role, grant it column-level `UPDATE` on `Page.listingTaxonomyId` alongside the existing publication mapper columns.
