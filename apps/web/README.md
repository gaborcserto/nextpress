# Public web application

The web workspace serves published CMS content, including the home page, post archive and details, and standard pages. It reads content through server-only database access and exposes only public fields.

Run from the repository root with `npm run dev:web`; the app listens at [http://localhost:49100](http://localhost:49100). Configure `apps/web/.env` from [`.env.example`](.env.example). Set its `DATABASE_URL` to the local PostgreSQL database; see the [root README](../../README.md) for setup.

Workspace checks:

```bash
npm --workspace web run lint
npm --workspace web run typecheck
npm --workspace web test
```
