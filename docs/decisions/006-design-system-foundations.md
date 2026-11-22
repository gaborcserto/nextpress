# ADR-006: Design system foundations and application ownership

- Status: Proposed
- Date: 2026-11-22

## Context

Admin has a working editorial shell, Tailwind and daisyUI themes, native modal dialogs and specialized editor controls. Public Web has a template registry and three preset identities with server-rendered preference attributes. [DS-01 evidence](../design-system-audit.md) shows both divergence worth retaining and common interaction needs.

## Decision

Use app-owned CSS custom properties with primitive values, semantic roles and scoped component aliases. Align naming, spacing, focus and state standards across apps. Keep the existing theme and appearance contracts. Preserve Admin's neutral, blue-gray-compatible identity and each preset's separate editorial voice. Refine owned components incrementally. Use the account disclosure as the sole native Popover trial, with the existing Dropdown as a fallback and an independent rollback.

## Alternatives

- A universal UI package would share markup but couple release and visual priorities across separate applications. Revisit after repeated identical consumers justify a shared artifact.
- Swapping out daisyUI or adopting a full third-party kit would expand migration and interaction parity work. Keep its existing CSS integration and narrow new roles to local needs.
- Migrating all overlays at once would combine disclosure, menu and modal semantics in one change. Existing modal dialogs already provide the appropriate browser behavior.
- Applying one preset palette and typography to every public view would erase intended editorial differences.

## Consequences

Some CSS values remain independently owned. The [implementation plan](../design-system-plan.md) coordinates them through behavior and verification criteria. No new dependency, API contract, schema change or runtime design-token engine is required by this proposal.
