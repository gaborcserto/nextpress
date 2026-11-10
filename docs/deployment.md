# Independent deployment

Install with the pinned Node 24/npm 12.2.2 and `npm ci`. Build each application with `npm --workspace <api|admin|web> run build`. Before API builds, run `npm run prisma:generate`. Web and admin builds require neither database credentials nor a reachable API. Root `npm run build` builds all three through Turbo.

All apps emit `.next/standalone`. Prefer `node scripts/package-app.mjs <app> <new-output-directory>` to copy traced files and assets while excluding all `.env*` files. For manual packaging, copy the **entire contents** of `apps/<app>/.next/standalone` into its own clean deployment directory, preserving the monorepo layout. Copy `apps/<app>/.next/static` into `<artifact>/apps/<app>/.next/static` and, if present, `apps/<app>/public` into `<artifact>/apps/<app>/public`. Do not copy `.env` files. Start from the artifact root with `node apps/<app>/server.js`; set `HOSTNAME=0.0.0.0` and `PORT` explicitly. Build for the target OS/architecture; do not transfer Windows dependency artifacts to Linux. Serve static assets from the same origin or configure an equivalent asset service.

API alone owns `DATABASE_URL`, Better Auth secrets and optional OAuth credentials. Follow [API requirements](../apps/api/README.md). Prisma artifacts are traced from packages/db; validate the resulting artifact against the target platform and database before release. Migrations are a separate trusted backend release operation (`npm run prisma:deploy`), never a frontend startup operation.

Admin requires `API_INTERNAL_ORIGIN` and trusted browser/auth origins configured on API. Web requires `API_INTERNAL_ORIGIN` and `SITE_URL`. Internal origins must be operator-controlled HTTP(S) origins, never NEXT_PUBLIC variables. Public web requests send no browser cookies. Frontend deployments need no PostgreSQL access. Health: API `/api/health` checks liveness only; admin `/health` reports API availability; check web `/` and `/posts` for delivery readiness.

| Development command | Services |
| --- | --- |
| `npm run dev` | API, admin, web |
| `npm run dev:admin` | API, admin |
| `npm run dev:web` | API, web |
| `npm run dev:api` | API |

Run one composition at a time. To connect either UI to an existing API, run its workspace `dev` command directly. Root compositions invoke workspace commands directly through Turbo, avoiding nested API startup.

Independent artifact generation does not certify a production topology. Validate TLS ingress, OAuth callback/cookie behavior, proxy headers, database pool sizing and artifact operation on the target host. Multi-instance/serverless deployment requires distributed rate limits and connection-pool validation. Existing counters remain process-local. No cloud provider, distributed limiter or production deployment is supplied.

Composition requires migration `20261110220000_page_working_revisions` before the
new API starts. Configure `MEDIA_STORAGE_ROOT` as a private persistent volume,
outside every public/static directory. Back up metadata and files together.
API alone needs that filesystem access; web serves images through the API's
publication-filtered interface. See [CMS foundations](cms-foundations.md) for
permissions and operational assumptions.

After packaging, run `node scripts/scan-artifacts.mjs <artifact-directory>` from
the source repository. It checks for environment files, configured secret values
and PEM private-key blocks without printing matched values. Run it for each
independent artifact; raw `.next/standalone` remains unsuitable for deployment.
The packager preserves Next's relative external-package links. Artifact checks
reject absolute links or links escaping the artifact. Mutable media is excluded
from build tracing; deploy its runtime volume separately.

API media traces explicitly include installed Sharp native helpers, including
Windows DLLs. Verify uploads and image delivery from the packaged artifact on the
target platform. Auth origin compatibility aliases are read at runtime; configure
all supplied aliases consistently with the production HTTPS admin origin.

For an existing development database, check pending migrations with
`npm exec --workspace @nextpress/db -- prisma migrate status`, then apply reviewed
migrations with `npm run prisma:deploy` before starting the updated API. Client
generation, `db:up`, `dev` and `bootstrap` do not apply database migrations. A
healthy liveness endpoint or public post summary does not establish schema
readiness: those queries may not access the new columns. A Prisma P2022 on full
page/post reads requires correcting the API/database migration mismatch, not
bypassing version checks or defaulting missing schema fields.
