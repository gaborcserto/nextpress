# ADR-001 — Editorial mapping and backfill dependencies

- Status: Accepted

The backfill and the private-draft writer both project legacy content into editorial snapshots and derive persisted reference edges. The backfill planner and persistence code previously imported each other, and working-aggregate code reached the mapping through the backfill entry point.

Editorial mapping lives in an API service module with no runtime database or backfill dependency. Backfill planning consumes the mapping, fenced persistence consumes the plan, and the backfill coordinator calls fenced persistence. The coordinator retains the backfill entry points. Live editorial writers consume the mapping directly.

Changes to snapshot serialization and reference ordering need coverage for both backfill reconciliation and live editorial writes because those values feed stored fingerprints and reference records.
