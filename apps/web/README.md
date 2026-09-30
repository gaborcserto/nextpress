# Public web application

The web workspace is the public-facing Next.js application. Its current implementation is the default Next.js starter home page; CMS content is not yet rendered here.

Run it from the repository root with:

```bash
npm run dev:web
```

It listens on `http://127.0.0.1:49100`. Configure local values in `apps/web/.env` using [`.env.example`](.env.example). The root [README](../../README.md) documents repository setup, shared commands, and testing.

Useful workspace checks:

```bash
npm --workspace web run lint
npm --workspace web run typecheck
npm --workspace web test
```
