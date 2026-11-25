---
name: frontend-design
description: Use for public frontend UI implementation or refinement, visual consistency, responsive layouts, themes, interactive states, accessibility, screenshot reviews, and visual regression investigation. Do not use for backend, database, infrastructure, or business-logic-only work.
---

# Frontend design

Apply this skill to public frontend visual work. Repository-wide architecture and accessibility rules remain in `AGENTS.md`; use the React and readability skills for maintained UI source changes. This skill sets quality expectations without making Blog styling mandatory for other templates.

## Design boundaries

- **Global foundations:** use the semantic variables in `src/app/globals.css` for typography, spacing, content widths, borders, and motion. Prefer semantic colors and existing focus treatment over ad hoc values.
- **Shared public components:** inspect existing controls and shared components before adding another. Keep keyboard, focus, disabled, hover, and active states coherent.
- **Blog template:** preserve its editorial character and use its existing layout and styles as context.
- **Blog presets:** Classic, Modern, and Minimal intentionally have different type, palette, and density. Preserve each identity when changing preset-aware UI; do not apply those choices to other templates.
- **Future templates:** may establish distinct visual identities while meeting the shared responsive, accessible, theme, and localization standards.

Avoid arbitrary values when a token fits, unnecessary decoration, and generic generated-looking layouts. Do not hardcode translated UI text; retain English and Hungarian compatibility and the current localization architecture.

## Workflow

1. Inspect the affected rendered UI and nearby patterns, including shared navigation, search, language/theme controls, footer, article, and taxonomy elements where relevant.
2. Identify reusable components, tokens, template boundaries, and preset behavior.
3. Consider desktop, tablet, mobile, themes, and localized text in proportion to the affected surface and risk.
4. Make the smallest coherent implementation. Use semantic HTML, named controls, visible keyboard focus, practical target sizes, and reduced-motion support. Keep animation subtle and avoid layout shifts.
5. Review interactions: keyboard traversal, Escape and outside-click dismissal, focus restoration, and hydration consistency when applicable.
6. For browser verification, check actual rendering, alignment, and interactions; CSS declarations or passing tests alone do not establish a visual fix. Use a targeted check when needed; reserve browser regression testing for complex responsive changes, major design changes, audits, or explicit requests. For alignment defects, compare rendered element bounding rectangles.
7. Check accessibility and run focused automated checks for the affected surface.
8. Report what was checked and any limits.

Scale verification to risk. For routine or minor UI changes, use focused checks and do not automatically run browser automation or a broad viewport/theme/locale matrix. For complex responsive changes, major design changes, audits, or explicit requests, cover the relevant sizes, themes, locales, keyboard/focus behavior, reduced motion, long strings, and text resizing. Exercise affected Blog presets individually. Use browser inspection or screenshots when available; confirm actual rendered alignment and no overflow, clipping, or accidental wrapping.

## Activation examples

Use for: "Refine the public navigation on mobile"; "Review this screenshot for spacing and contrast"; "Investigate why the Blog header shifts between presets"; "Make the search dialog keyboard accessible."

Do not use for: "Add an API endpoint"; "Change a Prisma index"; "Update a backend billing rule."
