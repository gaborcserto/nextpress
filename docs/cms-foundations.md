# CMS foundations and compatibility

## Publication permissions

The existing publication policy is retained. Editorial HTTP reads allow
`PUBLISHED` content whose publication time is null or has passed. Authors can also
read their own drafts; editors and administrators can read all content. Public
delivery requires `PUBLISHED` and a non-null publication time that has passed.
Public website consumers must use delivery endpoints, not editorial endpoints.
Removing anonymous editorial reads or changing null-date compatibility requires
a separate explicit compatibility decision.

| Operation | Anonymous | Subscriber | Author | Editor | Administrator |
| --- | --- | --- | --- | --- | --- |
| Public delivery read | Published, dated | Published, dated | Published, dated | Published, dated | Published, dated |
| Editorial read | Published, null/past date | Published, null/past date | Published plus owned drafts | All | All |
| Create pages/posts | No | No | Yes, owned | Yes | Yes |
| Edit | No | No | Owned | All | All |
| Delete | No | No | No | All | All |
| Publish/unpublish | No | No | Owned | All | All |
| Dedicated draft preview | No | No | Owned content | All | All |
| Restore revisions | No | No | Owned content | All | All |
| Manage uploaded media | No | No | Owned uploads | All | All |

Author publishing rights are intentional compatibility behavior in this change.
Preview, revision restoration and media permissions are enforced in backend
services. Anonymous editorial compatibility does not grant preview access.

Administrator demotion/deletion now runs under a PostgreSQL transaction advisory
lock shared by both operations. Removing the last administrator returns 409.
These services reject non-administrator actors. Role grants remain explicit
administrator operations. This guard does not cover direct database writes or
operator scripts. Successful HTTP changes emit structured events containing only
event name, actor ID, target ID and the new role when applicable. Operators must
provide protected durable log collection and retention; stdout is not a durable
audit store.

## Portable page document

`@nextpress/shared/page-document` defines the first NextPress page document
version. This is an additive contract, separate from persisted rich content;
existing Slate content is unchanged. Composition is optional and additive to rich
content. Save it through working revisions; publishing copies the exact revision
snapshot to the live Page record. Existing editorial create/update contracts
continue to edit rich content, not composition.

Version 1 supports rich-text, hero, image, call-to-action, columns and
content-listing blocks. Every block has a stable unique ID, a version and strict
validated props. Columns have two to four regions with at most 20 leaf blocks
each; nested columns are unsupported. Documents contain at most 100 top-level
blocks. Serialized reads/writes are limited to one million UTF-16 code units.
Media and taxonomy IDs are references, not storage paths. Media existence and
author ownership are checked before revision persistence. Content listings always
resolve against published, dated content and honor their kind/taxonomy filter.

Rich-text props use the existing RichDocument version 1 schema. Links accept
site-relative paths or credential-free HTTPS URLs. Props cannot contain
component functions, import paths, HTML blocks or scripts. Text still requires
normal safe text rendering by consumers.

Writes reject unknown document versions, block versions, block types and extra
properties. `migratePageDocument` validates the initial version; there is no
historical page version to migrate yet. Future migrations must be explicit and
retain fixture compatibility. Never reinterpret legacy Slate content as a page
document automatically.

`readPageDocument` preserves unsupported stored documents verbatim for repair or
export and returns no renderable document. Consumers must show a safe fallback;
they must not execute unsupported data. The compiled public renderer supports all
six version-1 blocks and declares those capabilities. Publishing rejects invalid
stored composition. Any future renderer/profile must prove capability support
before it can be enabled; this phase does not introduce runtime plugins.

## Revisions, concurrency and preview

Use Working revisions on existing page/post editors for history, exact revision
preview, restore and publication operations. Content editing remains in the
Slate editor. Live Preview opens a split view without saving or publishing.
There are no JSON document or block insertion controls in the admin.

Revision saves require `expectedVersion` and create immutable snapshots. A
transaction advances the owning Page's working version only if it still matches;
stale saves/transitions return 409. Working saves and restores preserve the live
content and its modification time. Restore creates a new DRAFT revision and does
not change live publication status. Publish explicitly copies the selected
revision and sets publication time; unpublish hides delivery immediately. Slug
conflicts fail atomically. Revision lists return the latest 100 snapshots; older
snapshots remain stored and can be addressed by exact ID.

Preview requires a current Better Auth session plus an exact revision ID and
ownership/editor authorization. It is private and no-store. Invalid/expired
sessions cannot preview; no bearer preview tokens or public filter overrides
exist. Live Preview opens the public frontend in a restricted iframe. Configure
`NEXT_PUBLIC_PREVIEW_ORIGIN` in admin and `PREVIEW_ADMIN_ORIGIN` in web.
Content travels through origin/source-checked messages and expires after 15 minutes.
Saved preview uses authenticated revisions; unsaved title and Slate content remain
in memory. Legacy composition blocks and post metadata are not yet rendered in
Live Preview; their published rendering remains supported.

Editorial page/post PUT requests require `expectedVersion`, obtained from the
editorial GET response's `workingVersion`. The repository compares and increments
that version atomically in the content/tag transaction. Missing versions return
400; stale versions return 409 without writing. This explicitly approved write
contract change requires older API clients to update. The existing Slate forms
send the loaded version and retain local edits on a conflict. Their existing
direct publication behavior and author publishing permissions remain unchanged.
Working revisions provide independent drafts; editorial PUT continues to update
the live record deliberately.

## Minimum media

Uploads accept JSON base64 PNG/JPEG, up to 2 MiB decoded and 16 million pixels.
MIME claims must match file signatures; Sharp fully decodes and normalizes images
to PNG, dropping source metadata and executable trailing content. Normalized
output is bounded to 8 MiB. Filenames and client paths are never storage keys.
Metadata is database-owned; private filesystem keys are random UUIDs.

`MEDIA_STORAGE_ROOT` selects the API's private persistent directory. An empty or
unset value uses `.media` under the API working directory. Paths with a `public`
directory component are rejected. Unix directories/files use 0700/0600; configure
equivalent Windows ACLs. Mount persistent storage and back it up with PostgreSQL;
multiple API instances must share a coherent storage implementation. This is one
local-filesystem implementation, not an S3/CDN abstraction layer.

Authorized editors/admins can serve private media; authors can serve owned
uploads. Anonymous image serving requires an exact reference from published,
dated content. Web proxies only that public interface and forwards no cookies.
Image responses are PNG, nosniff and no-store; unpublishing removes anonymous
access. Deletion is blocked by references in pages, galleries or revision history.
Revision writes and media deletion share a transaction lock. A storage/DB failure
may require operator cleanup of an unreachable orphan; no public directory serves
files independently of authorization.

## SEO and routing

Web `SITE_URL` is the canonical origin, required in production. It accepts an
HTTP(S) origin without credentials, path, query or fragment. Keep the existing
editorial site URL setting aligned with it. Canonical routes remain `/`, `/posts`,
`/posts/{slug}` and `/pages/{slug}`. Detail titles/descriptions and Open Graph URLs
come from public delivery. Public robots allow indexing; admin robots disallow
crawling (authorization remains mandatory).

The dynamic sitemap includes only published, dated content via the API's bounded
public index. Its current window is 10,100 content records; exceeding it fails
explicitly rather than silently returning a truncated sitemap. Slug updates keep
the database identity and revision history, change the canonical route on publish,
and leave the old route at 404, preserving existing behavior. No redirect alias
table, SSG, ISR or persistent content caching was introduced.

## Verification and production gates

Install Playwright Chromium with `npx playwright install chromium`, then run
`npm run test:e2e`. Docker and available loopback ports 55441, 49200-49202 and
49303 are required. The runner creates a fresh PostgreSQL 18 container, applies
migrations (including an upgrade of seeded pre-composition content), runs opt-in
database tests, provisions disposable users, starts the three applications using separate `.next-e2e` output, executes real browser
tests, verifies unavailable/stalled upstream behavior and removes its container.
It refuses occupied app ports and never reuses existing application servers.
Test upload artifacts are retained under ignored `.notes/e2e-media`.

Public layout/resource regression tests cover 320, 393, 768 and 1440 pixels,
including route navigation, overflow, skip links and reduced motion. Run
`npm run test:e2e -- e2e/public-layout.spec.ts` for development. After
`npm --workspace web run build`, set `NEXTPRESS_E2E_WEB_PRODUCTION=1` and run the
same test command to package and test the actual standalone production web app
against the disposable backend. Clear the variable afterwards. Resource JSON and
screenshots are written under ignored `test-results/`; the production package is
retained under ignored `.notes/e2e-builds`. Framework development preload warnings
are observed without suppression; static-resource failures and runtime errors fail
the tests.

Use `node scripts/scan-artifacts.mjs <packaged-directory>` after the approved
packager. It rejects environment files, configured secret values of at least 12
characters and PEM private-key blocks without printing matched values. It is a
bounded leak check, not a universal secret detector.

Production gates remain privileged MFA/recovery design, idle session policy,
HTTPS ingress and trusted forwarding verification, shared rate limiting for
multiple processes, protected audit retention, and backup/restore automation
including media. Full template previews, distributed storage and production TLS
topology verification remain separate gates. No security certification is asserted.

Migration `20261110220000_page_working_revisions` adds nullable composition fields
and working versions with zero defaults; it does not rewrite existing content.
Deploy through the database-owned Prisma workflow before starting the new API.
Existing deployment/environment guidance remains in `deployment.md`,
`backend-boundaries.md` and application environment templates.
