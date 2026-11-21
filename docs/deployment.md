# Deployment

This guide states requirements and gaps; it does not certify a production deployment. No production-readiness or high-traffic capacity claim is established.

## Verified behavior

- API, Admin, and Public Web are separate Next.js applications.
- PostgreSQL/Prisma migrations are committed; `npm run prisma:deploy` applies them.
- Better Auth requires a secret and trusted application origins.
- Public Web reads API projections; it does not need database credentials.
- API health/diagnostic routes and request logging exist, but do not constitute complete orchestration probes or monitoring.
- PDF uploads require patched qpdf 12.4.2 or a compatible later release on the API process PATH. Provision the reverse proxy for the documented body limit. See the [PDF delivery decision](decisions/003-pdf-document-assets.md).
- Media uses an API-owned local directory. Set `MEDIA_STORAGE_ROOT` to a private, writable location and keep its contents with PostgreSQL backups. Public delivery is qualified per published content reference. See the [storage and delivery decision](decisions/002-media-storage-and-delivery.md).

## Required production configuration

Provide a production PostgreSQL URL to the API using the supported environment configuration; unique strong authentication secrets; correct Admin/API trusted origins; production application URLs; and private writable media storage. Keep secrets server-side and out of browser bundles and logs. Build each app from the repository using its workspace scripts and deploy migrations as a controlled release step before dependent application code.

Do not enable private-draft rehearsal by setting an environment flag alone. Its current admission requires additional verified safeguards and is not a production feature. No unattended scheduled publishing service exists.

## Operational work to validate

- Define backup retention, restore drills, migration rollback/recovery, and database monitoring.
- Make media storage durable and shared for multi-instance deployment, with backup and lifecycle policy.
- Define deployment-specific health/readiness probes, log retention, alerting, and request-correlation handling.
- Review rate limits, origin/cookie configuration, secret rotation, and security headers in the actual hosting topology.
- Establish caching/invalidation for public content; current Web API requests use `no-store`.
- Measure load, database connection behavior, and resource needs before setting capacity targets.
- Validate the complete build/startup path and migrations in the intended hosting environment.

These are production-readiness gaps/recommendations, not descriptions of existing infrastructure. See [architecture](architecture.md) and [development](development.md).
