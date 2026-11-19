# Product vision

NextPress is intended to become a modern, extensible, secure, professionally engineered content management system. Today it is a PostgreSQL-backed CMS with separate API, Admin, and Public Web applications; the longer-term direction is broader than the currently delivered feature set.

## Confirmed direction

- Manage structured posts and pages through a professional editorial interface.
- Deliver published content to a separately deployable public website.
- Support reusable media, flexible taxonomy, configurable navigation, page hierarchy, and customizable public templates.
- Treat security boundaries, accessibility, responsive behavior, maintainable modules, and performance-conscious content delivery as product requirements.
- Evolve capabilities incrementally while keeping APIs and data ownership explicit.

These are goals, not claims that each workflow is complete. See [current state](current-state.md) and [feature inventory](features.md).

## Principles and constraints

- Published public projections must not expose private editorial data.
- Authentication and authorization are server responsibilities.
- Keep Admin, API, and public rendering separate while sharing only genuinely cross-workspace contracts.
- Prefer understandable, testable behavior over speculative platform infrastructure.
- Measure performance before making capacity claims. No representative benchmark currently establishes high-traffic capacity.
- Avoid coupling public templates to administrative UI conventions.

## Exploratory ideas

Optional AI-assisted article creation, summaries, SEO and metadata suggestions, semantic search, recommendations, and website building are proposed possibilities. They are not confirmed requirements or implemented capabilities. High-traffic publishing is an aspiration requiring representative performance and operational validation.

## Non-goals for the current foundation

The repository does not establish a microservices, Redis, or message-queue architecture. Those are not implied by the product direction and would require a concrete need and decision record.
