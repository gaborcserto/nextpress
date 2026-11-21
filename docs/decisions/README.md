# Architecture decision records

Use a short record for significant choices that affect boundaries, persistence, security, or operations. Suggested format:

```md
# ADR-NNN: Title

- Status: Accepted | Proposed | Superseded
- Date: YYYY-MM-DD (only when verified)

## Context

What problem or constraint is evidenced?

## Decision

What is the current choice?

## Alternatives

Options only when documented or verifiably considered.

## Consequences

Benefits, trade-offs, and follow-up constraints.
```

Do not invent historical rationale or dates. Existing architecture is summarized below as evidence-based decisions; these are descriptions of current choices, not claims of recovered deliberation.

| Topic                                                           | Current choice                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Workspace boundaries                                            | Separate API, Admin, and Public Web Next.js apps in an npm/Turborepo monorepo.                    |
| Persistence                                                     | PostgreSQL with Prisma owned by `packages/db`.                                                    |
| Public delivery                                                 | API-owned anonymous content projection consumed by Web over HTTP; no DB credentials in Web.       |
| Authentication                                                  | Better Auth session identity with server-side role/ownership authorization in API.                |
| Local DB configuration                                          | API workspace environment is normal `DATABASE_URL` source; explicit process values override it.   |
| [Page type designations](001-page-type-designations.md)         | Editorial layouts drive public display and PostgreSQL enforces a single published homepage.       |
| [Media storage and delivery](002-media-storage-and-delivery.md) | The API owns local file storage, metadata, published eligibility, and protected preview delivery. |
| Templates                                                       | Public template registry and presets in Web; appearance is separate from page/content structure.  |

Add a numbered ADR when a new choice needs durable context. A decision rationale or date belongs in a record only when verified from evidence.

- [ADR-003: PDF documents use the existing asset store](003-pdf-document-assets.md)
- [ADR-004: Page paths and navigation menus](004-navigation-and-page-hierarchy.md)
