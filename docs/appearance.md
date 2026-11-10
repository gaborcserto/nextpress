# Public appearance and extensibility

A **theme** is trusted compiled visual tokens. A **template** is trusted compiled rendering structure. A **frontend** is an independently deployed public HTTP API consumer. An **admin skin** belongs only to the administration UI. These selections do not grant permissions or change publication policy.

## Public configuration

Edit `apps/web/src/lib/appearance.ts` and rebuild web. `publicAppearance` selects `theme`, `template`, and `colorMode`. Defaults are `default`, `default`, `light`. `resolvePublicAppearance` validates with Zod: unknown identifiers fall back individually; malformed objects or extra keys fall back to all defaults. Supported modes are `light`, `dark`, `system`; system is resolved by CSS, without guessing the OS during SSR. No preference persistence or new database fields are introduced.

The only registered public theme is `default`, backed by the existing public skin registry in `src/lib/skin.ts`. Tokens remain centralized in `src/app/skins/default.css` (colors, fonts, radii) and `src/app/globals.css` (spacing, typography scale, dimensions, motion). Theme selection resolves through that registry; no strings become import paths, CSS or executable code. Public and admin share an existing skin identity contract but own their styles and capabilities independently.

To register another theme, add trusted stylesheet assets with explicit skin selectors, statically import them in web layout, extend the existing skin identity/registry and appearance allowlist, and test all supported palettes. Retain focus, reduced-motion and responsive rules. Validate text contrast and inspect actual rendered layouts. There is no runtime token editor or arbitrary CSS input.

## Rendering templates

`src/components/public-content/templates.ts` registers two post-list templates: `default` retains article previews; `compact` renders a numbered title/date index without excerpts or author metadata. Both support home, archive and Load More using the same portable public summary DTOs. Detail page/article layouts and SEO metadata are unchanged; this registry does not claim to implement arbitrary whole-site layouts.

Selection is separate from theme selection. Unsupported IDs resolve to default. Templates receive data from existing callers and never fetch content themselves. To register a template, add a compiled component, statically register it and extend the appearance schema's template enum. Test valid/invalid selection, DTO compatibility, empty state, pagination/Load More, keyboard links and responsive rendering. Components used by Load More must be client-compatible and must not import server implementations. React references stay in web; shared API DTOs contain data only.

The rich-document renderer consumes the shared versioned contract, not editor internals. Existing escaped legacy text, safe links, unsupported-node fallback and same-origin media policy remain. Content layout fields in editorial records do not imply a public template-selection capability: public delivery currently has no per-record template ID. No API or schema expansion is introduced.

## Admin appearance

Admin retains its own compiled default skin and DaisyUI light/dark palettes. With no appearance cookie, CSS follows the OS; the toggle now reads that effective mode before switching. Explicit light/dark preferences use the existing `theme` cookie, independent of Better Auth sessions. Invalid cookies normalize to light. There is no new admin skin chooser or system-reset control. Remove the appearance cookie to restore OS mode. Authentication, navigation and CRUD are unchanged.

## Custom frontends

Consume anonymous `GET /api/public/posts?limit=10&offset=0`, `/api/public/posts/{slug}`, `/api/public/pages/{slug}`, `/api/public/navigation` and `/api/public/settings`. Contracts and Zod response schemas live in `@nextpress/shared/api-contracts`; consumers need no Prisma, Better Auth server or admin implementation. Delivery details are direct objects; lists return `{posts, hasMore}`. Follow `hasMore` and advance offset by the requested limit, respecting the contract's bounds. Distinguish detail 404 from network/500 failures. Validate responses, bound request time and keep public reads cookie-free and uncached. Web's HTTP boundary and contract-based template tests provide a reference implementation/fixture.

Use a server-side consumer or your own controlled proxy. Browser cross-origin CORS is not enabled by this phase. Editorial endpoints are not a public delivery alternative. See backend boundaries and deployment documentation for origin, publication and runtime requirements.

## Future generation workflows

Future generators may target versioned rich documents, allowlisted template IDs and compiled theme tokens. Their output must pass existing content validation and authenticated editorial authorization. Preview/draft isolation, explicit human publishing approval, auditability and rollback need a separate design before automated publishing. No agents, model providers, prompt execution, generated-code execution, preview system or plugin loader are implemented. Appearance configuration cannot execute scripts, inject HTML or bypass publication rules. CSP and security headers stay unchanged.
