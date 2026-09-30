# Admin application

The admin workspace is the authenticated Next.js administration application. It contains the Better Auth integration, role-aware API routes, and the current CMS administration screens.

Implemented areas include:

- email/password sign-in, sign-up, password reset flows, and configured OAuth provider support;
- dashboard, pages, posts, taxonomy, users, settings, and profile/session screens;
- server-side authorization for protected API routes using the supported ADMIN, EDITOR, AUTHOR, and SUBSCRIBER roles;
- API routes for authentication, pages, posts, tags, users, settings, and health checking.

Run it from the repository root with:

```bash
npm run dev:admin
```

It listens on `http://127.0.0.1:49101`. Configure local values in `apps/admin/.env` using [`.env.example`](.env.example). The root [README](../../README.md) documents repository setup, shared commands, and testing.

Useful workspace checks:

```bash
npm --workspace admin run lint
npm --workspace admin run typecheck
npm --workspace admin test
```

The public web application is a separate workspace and is not rendered by this application.
