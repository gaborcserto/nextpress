# Feature inventory

Statuses describe the current evidence: **Implemented**, **Partial**, **Planned**, **Proposed**, **Deferred**, or **Unverified**. Roadmap items are accepted future work; ideas without prioritization remain proposed. See [current state](current-state.md) for evidence and limitations.

## Content and editorial

| Capability                                                | Status      | Notes                                                                                                                                                                   |
| --------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Posts and standard pages, metadata, taxonomy, cover media | Implemented | Admin/API/public flows exist.                                                                                                                                           |
| Draft persistence and explicit save                       | Partial     | Legacy page persistence exists; newer private working aggregates are guarded rehearsal only.                                                                            |
| Autosave, restore/recovery, conflict handling             | Partial     | Existing Posts and Pages support debounced autosave and version-checked recovery in the guarded rehearsal. Production activation remains open.                          |
| Publishing and unpublishing                               | Implemented | Page and Post edits preserve existing publication unless the editor changes the status or date.                                                                         |
| Publication date picker                                   | Implemented | Server-rendered fields initialize in the browser's locale and time zone after hydration.                                                                                |
| Scheduled publishing                                      | Partial     | Dated Page and Post publication becomes visible when due. Private release rehearsal requires an explicit execution step.                                                |
| Editorial dashboard                                       | Implemented | Shows scoped Post and Page totals, publication states, recent updates, upcoming publications, and editor shortcuts. Guarded rehearsal data stays in the private editor. |
| Revision history                                          | Partial     | Legacy revision history exists; complete user-facing revision/recovery lifecycle is not established.                                                                    |
| Preview                                                   | Implemented | Live or saved preview uses Web's detail, archive, and structured-block rendering for Standard, Home, Posts, and Gallery with the configured Blog preset.                |
| Content relationships                                     | Partial     | Page hierarchy and taxonomy/media associations exist; broader relationships need audit.                                                                                 |

Admin Posts, Pages, Tags, and Categories support server-side search, ordering,
and pagination. Posts and Pages also expose editorial state and record dates,
and Posts support tag and category filters. The Pages list filters by page type.
Taxonomy shows IDs and post usage counts. Tags retain creation and deletion
actions, and Categories provide read-only discovery. See
[Admin discovery](architecture.md#admin-discovery) for available metadata and
pagination behavior.

## Page concepts

The schema distinguishes `PageType` (content classification) and `PageLayout` (layout intent); public template/preset selection is a separate site appearance configuration. A content block is structured content inside a document, not a page type or appearance preset.

| Page type/direction | Status                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standard pages      | Implemented                                                                                                                                                                                 |
| Home Page           | Implemented. One published designation, subject to its publication date. The localized root uses the default homepage when unavailable.                                                     |
| Posts Page          | Implemented. Lists published posts at its own page URL with an optional existing tag filter, site listing mode, and bounded pagination. The existing archive and search URLs are supported. |
| Gallery Page        | Editors can attach and order up to 48 images. Public and preview views share the Gallery renderer and its localized empty state.                                                            |
| Other modeled types | Partial; model enums/forms exist, public behavior varies by type                                                                                                                            |

Pages support parent assignment, child listing, sibling order and nested public paths. The API rejects cycles and moves beyond eight levels. Hierarchy is managed independently of menu placement.

## Navigation

Use **Menus** under Administration to manage Header, Footer and Sidebar links. Each menu can use Pages, Posts, Categories, Tags, explicit site paths, HTTP(S) links, or group labels. Use the pointer or keyboard to edit menus through **Move up**, **Move down** and **Parent item**. Items can be hidden independently; hidden items stay editable, and hiding a parent hides its public subtree. Draft or unavailable Page destinations are labeled in Admin and excluded from public navigation. A menu save applies the complete change. Link destinations tied to content IDs follow the current public URL.

Administrators and editors can open **Page hierarchy** from the Pages list or an existing Page editor. Choose a parent and sibling order to move a Page. Child links and the proposed path appear in the same panel. Menu hierarchy is independent and does not change Page paths. Web omits links through unpublished ancestors. Sidebar navigation appears only when the active preset supports it and its assigned menu contains public links.

See [Page paths and navigation menus](decisions/004-navigation-and-page-hierarchy.md) for limits, canonical URLs and preview behavior.

## Media

The Admin Media Library supports filename and metadata search, bounded grid and list browsing, batch uploads, metadata editing, and reference-aware deletion. Administrators and editors can manage all assets. Authors manage their own uploads. Subscribers can view images eligible for public delivery.

Post and Page editors share the picker for cover images and existing structured image and hero blocks. Gallery pages store ordered references and use each asset's alternative text and caption. Structured image blocks can override alternative text in context. Media relationships are read-only in the guarded private editor, which preserves and previews its existing references.

JPEG, PNG, still WebP, still AVIF, and static or animated GIF are accepted. New uploads are stored and served in their verified input format. Existing PNG objects and their references are preserved. Older records may lack filenames, original format, size, or modification date. The library filters by original format and shows the stored MIME type and size in asset details.

GIF playback is opt-in in media details, public content, and protected previews, including for visitors who prefer reduced motion. The library and picker show a GIF label in collections. Captions and alternative text remain available in the editorial views. Editors remain responsible for reviewing GIFs for rapid flashes before publication. Animated WebP, APNG, and AVIF sequences are rejected with localized guidance to use GIF. See the [media decision record](decisions/002-media-storage-and-delivery.md) for limits and delivery policy.

## Public website

| Capability                                     | Status                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Managed pages, homepage, post archives/details | Implemented, with page-type limitations                                  |
| Category/tag filtering and search              | Implemented; lexical search only                                         |
| Public templates and appearance presets        | Partial; blog family and presets, not general site builder               |
| SEO metadata, sitemap, robots                  | Implemented                                                              |
| Accessibility and responsive behavior          | Partial; requires dedicated audit                                        |
| Caching and high-volume delivery               | Unverified; public requests use `no-store`, no representative benchmarks |

## Proposed optional AI

All items remain **Proposed**: article summaries, title suggestions, SEO recommendations, tag recommendations, related articles, semantic search, and AI-assisted website building. No AI feature is represented as implemented.

### Document Library

The Admin Document Library supports PDF browsing, per-file upload status, metadata editing and authorized attachment downloads. Post and Page editors can select a PDF and set the label and description for its structured download block. The public site requires a current published reference, while the Admin endpoint can serve protected documents to editors and owning authors. Referenced documents are protected from deletion. See the [PDF storage and delivery decision](decisions/003-pdf-document-assets.md) for limits, preview behavior and deployment requirements.

## Site date and time

In **Admin → Settings → General**, choose an IANA timezone such as `Europe/Budapest`, `Europe/London`, `America/New_York`, or `Asia/Tokyo`. The default is `UTC`. The searchable timezone field offers identifiers from the Admin runtime's internationalization data and also accepts a typed identifier. The API validates it against the server runtime's timezone data.

Choose a localized long date, dotted year-month-day, day-first or month-first slashes, or ISO date. Time can use a 12-hour or 24-hour clock with optional seconds. The preview uses a fixed example instant. Settings and picker labels use Hungarian when the browser prefers Hungarian and English otherwise. The public site uses the visitor's selected language for localized date components.

The Page and Post publication controls interpret wall-clock input in the displayed site timezone. A skipped time is rejected. If the clock repeats an hour, choose the first or second occurrence using the displayed UTC offsets. Editing a publication time uses minute precision. Reopening an unchanged time preserves its original occurrence, seconds, and milliseconds.

Changing the timezone changes how NextPress displays created, modified, and publication timestamps and interprets new editor input. It leaves all saved instants in place, including future releases. Reload a public page or reopen an active preview to pick up changed settings. Older historical revisions may lack a captured publication time.
