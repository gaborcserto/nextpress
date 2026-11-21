# ADR-005 — Site timezone and publication instants

- Status: Accepted

## Context

Editorial scheduling requires site-local input. Public eligibility and existing scheduled releases already compare absolute instants. Prisma uses both legacy UTC-valued `TIMESTAMP(3)` fields and `TIMESTAMPTZ(3)` for newer editorial data.

## Decision

Add timezone and format presets to `SiteSettings`. The migration adds three Settings fields with defaults and leaves existing content timestamp columns and values intact. The application database adapter establishes a UTC session for database-generated timestamp defaults.

The admin and public Settings endpoints expose the date/time preferences. Existing Settings update clients can omit the preferences and retain the stored values. The authorized Post and Page write endpoints continue to accept ISO 8601 instants with `Z` or an explicit offset. The editor resolves wall time before submission. Read responses serialize persisted instants in UTC and HTML `<time>` retains the machine-readable instant. Sorting and eligibility continue to use canonical time.

## Native capabilities and limitations

Use runtime `Intl.DateTimeFormat` for display and timezone validation and `Intl.supportedValuesOf` for suggestions. Node 24 and supported browsers do not universally provide native Temporal. The Admin picker uses the lightweight `temporal-polyfill` dependency to resolve local times with the runtime's IANA rules, including skipped and repeated times. API and Web display require no time conversion dependency. Runtime timezone data can differ across environments.

NATIVE-01 can revisit native Temporal when deployment and browser support align. DS-01 can evaluate the shared picker dialogs, date/time display hierarchy, and mobile and localized input patterns.
