# Feature inventory

Statuses describe the current evidence: **Implemented**, **Partial**, **Planned**, **Proposed**, **Deferred**, or **Unverified**. Roadmap items are accepted future work; ideas without prioritization remain proposed. See [current state](current-state.md) for evidence and limitations.

## Content and editorial

| Capability                                                | Status      | Notes                                                                                                                    |
| --------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Posts and standard pages, metadata, taxonomy, cover media | Implemented | Admin/API/public flows exist.                                                                                            |
| Draft persistence and explicit save                       | Partial     | Legacy page persistence exists; newer private working aggregates are guarded rehearsal only.                             |
| Autosave, restore/recovery, conflict handling             | Partial     | Working persistence foundations exist; general production workflow and conflict UX are not established.                  |
| Publishing and unpublishing                               | Implemented | Page and Post edits preserve existing publication unless the editor changes the status or date.                          |
| Scheduled publishing                                      | Partial     | Dated Page and Post publication becomes visible when due. Private release rehearsal requires an explicit execution step. |
| Revision history                                          | Partial     | Legacy revision history exists; complete user-facing revision/recovery lifecycle is not established.                     |
| Preview                                                   | Partial     | Live preview route exists; complete workflow and access guarantees need audit.                                           |
| Content relationships                                     | Partial     | Page hierarchy and taxonomy/media associations exist; broader relationships need audit.                                  |

## Page concepts

The schema distinguishes `PageType` (content classification) and `PageLayout` (layout intent); public template/preset selection is a separate site appearance configuration. A content block is structured content inside a document, not a page type or appearance preset.

| Page type/direction         | Status                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| Standard pages              | Implemented                                                                                    |
| Homepage role/configuration | Partial; homepage route and page types/settings exist, complete selection semantics need audit |
| Posts archive/listing       | Partial; listing settings and public archive exist                                             |
| Gallery pages               | Unverified; no complete gallery page workflow established                                      |
| Other modeled types         | Partial; model enums/forms exist, public behavior varies by type                               |

Intended hierarchy includes parent/child pages, nested structure, ordering, hierarchical navigation, cycle prevention, and keyboard-accessible organization. Current parent relationship and hierarchy controls are partial; audit required for the complete set.

## Navigation

Intended capabilities: database-driven menus; header, footer, and optional sidebar locations; nested menus/dropdowns; destinations for pages, posts, taxonomy, and external URLs; ordering; template-specific locations; defined empty-menu behavior; and mobile navigation. Current settings and menu UI/contracts exist, but end-to-end coverage of this set is **Partial**.

The Minimal public template is intended to support an optional Sidebar menu, disabled by default and integrated into its editorial layout rather than creating an unrelated dashboard-style column. This intended behavior is not claimed complete.

## Media

PNG/JPEG uploads, asset library, reusable media references, metadata, and cover images are **Partial to Implemented** by sub-capability: upload/library and reference-aware deletion exist; galleries, broader format support, remote durable storage, and complete lifecycle handling remain incomplete or unverified.

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
