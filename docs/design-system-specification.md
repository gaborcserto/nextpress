# DS-01 design system specification

Status is proposed. [Audit](design-system-audit.md) records the evidence and [inventory](design-system-inventory.md) assigns owners and migration actions.

## Foundations and ownership

Design for reading and editing. Reserve the strongest visual emphasis for a primary task or editorial lead. Use stable alignment, readable labels, subtle dividers and limited elevation. Keep admin density practical and give article copy a readable measure.

Admin already combines Tailwind 4, daisyUI theme values, CSS custom properties and local modules. Its [tokens](../apps/admin/src/ui/theme/tokens.css) define 14/20 UI text, 8px control and 12px surface radii, 150ms motion, 60px topbar and 112/94/74/56rem workspace caps. Web already has [global roles](../apps/web/src/app/globals.css), [default skin](../apps/web/src/app/skins/default.css) and [Blog preset overrides](../apps/web/src/templates/blog/presets.css). Preserve the [template registry](../apps/web/src/templates/registry.ts) and [shared appearance contracts](../packages/shared/src/api-contracts.ts).

Map primitive values to semantic roles in each owning stylesheet, then alias them for named component needs such as control border or navigation selection. Map daisyUI utilities to Admin semantics progressively. Share naming, the spacing vocabulary and a contrast/interaction checklist across apps. Introduce a shared CSS artifact only after both apps demonstrate identical values and ownership needs. Keep theme values CSS-driven, with initial SSR preference attributes and isolated preview roots matching hydration. Check first paint for system, light and dark in both apps. Font choices favor existing system or self-hosted fonts with Latin Extended coverage and existing CSP.

## Typography

Values are proposed CSS px equivalents at a 16px root. Use rem and allow text wrapping.

| Role               | Admin size / line height      | Public size / line height                                 | Weight and tracking                                                             |
| ------------------ | ----------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Main heading       | 24/30 small, 32/40 large      | Classic 36–72/1.08, Modern 36–80/1.06, Minimal 32–56/1.12 | Admin 650, Classic 400, Modern 700, Minimal 650, approximately −0.025em display |
| Section heading    | 20/28                         | 24–36/1.2                                                 | 600 sans or 400 Classic, −0.015em                                               |
| Panel/card heading | 16/24                         | 20–28/1.25                                                | 600 sans or 400 Classic, −0.01em                                                |
| Body/form input    | 14/20 UI, 16/24 narrow inputs | 18/1.7 Classic and Minimal, 18/1.65 Modern                | 400, normal                                                                     |
| Button/field label | 14/20                         | 15/22                                                     | 600, normal                                                                     |
| Metadata/help      | 13/18                         | 14/20                                                     | 400, normal                                                                     |
| Caption            | 12/16                         | 13/18                                                     | 400, normal                                                                     |
| Code/ID            | 13/20                         | 14/22                                                     | 400, normal; tabular numbers for numeric columns                                |

Admin keeps the existing sans stack and uses system mono for IDs. Classic uses Georgia for headings and prose with existing sans for UI. Modern uses existing Geist Sans for headlines and prose. Minimal uses restrained sans headings and Georgia prose, with mono optional for short metadata. Keep code semantically marked, with horizontal overflow confined to code where needed. Clamp display type using rem bounds with a fluid middle. Align heading levels with document structure. Set body margins around 1em and add space before new subsections. Test 200% text and Hungarian long words.

## Semantic color

Proposed baseline values. Each pair is light / dark. Borders named “divider” can be low contrast when decorative. “Control border” must remain perceptible at functional boundaries.

| Role                  | Admin             | Classic           | Modern            | Minimal           |
| --------------------- | ----------------- | ----------------- | ----------------- | ----------------- |
| Background            | #F4F6F8 / #171C24 | #FCFAF5 / #1F1E1B | #F4F0E9 / #1D1C26 | #FAFAF9 / #191919 |
| Surface               | #FFFFFF / #202731 | #FCFAF5 / #1F1E1B | #FFFCF6 / #272532 | #FFFFFF / #212121 |
| Elevated or alternate | #FFFFFF / #293342 | #F0ECE2 / #302E28 | #ECE3D9 / #35303A | #F1F1EF / #2A2A2A |
| Divider               | #D8DEE6 / #455162 | #D9D2C4 / #504C43 | #D4CBC0 / #615B69 | #D6D6D2 / #555555 |
| Control border        | #687487 / #8795A8 | #726955 / #A2998A | #766B61 / #A69BAA | #71716D / #949494 |
| Primary text          | #182230 / #F0F4F8 | #29261F / #ECE9E1 | #1D1C32 / #F4F0E9 | #222222 / #F2F2EF |
| Secondary text        | #39475B / #D1DAE6 | #474038 / #D7D0C4 | #3D3947 / #DED8E1 | #393939 / #DDDDDA |
| Muted text            | #526073 / #B4C0CF | #615B50 / #C0B9AC | #54515C / #C7C0C9 | #555552 / #B5B5B0 |
| Accent or link        | #1E56A0 / #9BC6FF | #754227 / #E1BDA2 | #743D2C / #EDBB9C | #333333 / #E6E6E3 |
| Accent hover          | #194784 / #BAD9FF | #492C1D / #F7D9C2 | #542C20 / #FFE0CC | #111111 / #FFFFFF |
| Accent active         | #153769 / #D2E7FF | #392116 / #FFF0E4 | #422116 / #FFF0E4 | #000000 / #FFFFFF |
| Focus                 | #2359B4 / #A9CEFF | #754227 / #E1BDA2 | #2859B0 / #AAC8FF | #333333 / #EEEEEE |
| Selection fill        | #DFEBFF / #35475F | #EDE2D0 / #453A31 | #E7DFED / #3D374A | #E4E4E0 / #424242 |

Selection uses primary text, a visible mark and semantic state. Admin solid accent uses white light and #172230 dark foreground. Common status ink pairs, applied over the app's surface and verified there, are success #20543A / #ACE1B8, warning #684600 / #F5D88E and error #9C2228 / #FFA9A4. Disabled control ink #596676 / #ADB8C6 uses subdued fill #E8ECF0 / #303A49 in Admin, with equivalent alternate surfaces in Web; communicate disabled through native semantics. Use cool blue or burnt-orange ink sparingly in Modern and keep optional decorative accent blue #C5D8E2 or peach #E7BB96 separate from content contrast roles. Classic stays warm and Minimal stays near monochrome.

Require 4.5:1 for regular text, 3:1 for large text and functional non-text boundaries. Aim for at least 3:1 focus against adjacent colors. Test accent foreground/fill and all status, hover, selected and inverse footer pairs on real backgrounds. Use a two-layer focus indicator if a single color blends into a filled control. Preserve affordances in forced colors. [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## Spacing and responsive layout

| Role                          | Proposed value                                                                                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spacing                       | 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px                                                                                                                                                        |
| Control inline padding        | 12px compact, 16px regular                                                                                                                                                                            |
| Control height                | 32px dense desktop secondary, 40px regular, 44px touch; use minimum heights                                                                                                                           |
| Form gap and panel padding    | 16px between fields, 4–8px label/help associations, 16px compact panel and 24px regular                                                                                                               |
| Page gutters                  | Admin 14–40px fluid from existing role. Web 16–32px.                                                                                                                                                  |
| Widths                        | Preserve Admin's four workspace caps. Public container Classic 64rem, Modern 72rem, Minimal 48rem. Reading measure Classic 65–68ch, Modern 60–68ch, Minimal 60–65ch, capped by viewport.              |
| Admin shell                   | 12px rail inset, 240px expanded rail starting target and 60px collapsed, 40px nav row with 44px touch target; confirm against current computed widths before adjustments. Retain 60px nominal header. |
| Public sections/header/footer | 32–80px sections. Header 64–72px minimum, footer padding 32px Minimal, 48px Classic, 64–96px Modern.                                                                                                  |
| Border/radius                 | 1px borders, 2px focus ring plus 2px offset. 4px tight, 8px controls, 12px panels and 999px for status indicators and avatar only.                                                                    |
| Elevation                     | Surface flat, raised picker 0 4px 14px rgb(10 16 30 / 14%), overlay 0 10px 30px rgb(10 16 30 / 16%). In dark themes emphasize a defined border.                                                       |

Exceptions are limited to safe areas, optical alignment, measured overflow and content/aspect constraints. Document enduring exceptions near their roles.

| Width | Admin                                                                                                                                                  | Public                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 320   | Single-column form and data cards; wrap sticky actions or unstick for short heights; scroll dialog body with actions reachable; wrap toolbar by group. | Accessible navigation toggle, full-width usable menu, one-column editorial and gallery layouts, wrapped taxonomy/footer links. |
| 390   | Keep full-width account contents with safe-area gutters; action groups may fit side by side.                                                           | Allow image/caption pair within gutter; keep the article prose measure fluid.                                                  |
| 768   | Fit grouped table metadata based on content or keep cards. Use two-column forms only where labels/errors fit.                                          | Two-up grids where real titles fit; optional sidebar below main when measure would shrink.                                     |
| 1024  | Float desktop rail, retain collapsed state, verify sticky action collision at transition.                                                              | Allow sidebar beside content when both measures hold; preserve measured nav overflow.                                          |
| 1440  | Apply workspace caps; keep aligned table columns and panel edges.                                                                                      | Editorial grid and stable article measure; footer columns where justified.                                                     |
| 1920  | Center capped workspace; preserve readable form widths and bounded line lengths.                                                                       | Center outer content; avoid stretching lead image beyond its intended composition.                                             |

Validate one pixel either side of actual native CSS breakpoints. At 200% text and at 400% browser zoom on a 1280px desktop viewport, keep focus and actions available without page-level horizontal scrolling. Local overflow is reserved for intrinsically two-dimensional content or code. Use dynamic viewport height and safe-area offsets for overlays. Test coarse pointer, keyboard-only, forced colors, high contrast, reduced motion and short landscape.

## Interaction contract

| State                    | Behavior                                                                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default and hover        | Visible affordance at rest. Fine-pointer hover may change shade, underline or border. Touch reveals the same actions without hover.                                                                                                                       |
| Focus-visible and active | 2px visible ring with offset and sticky scroll padding. Enter/Space use native behavior. Pressed styling is brief and distinct from selection.                                                                                                            |
| Disabled and read-only   | Native disabled for unavailable actions, with an adjacent reason where needed. Read-only text stays legible, selectable and distinguishable.                                                                                                              |
| Loading                  | Keep geometry and semantic button name, add progress text, block duplicate submission, mark region busy where appropriate and announce completion once.                                                                                                   |
| Selected                 | Use check, underline or text plus semantic current/selected/pressed state appropriate to the control.                                                                                                                                                     |
| Error and success        | Associate inline error with the field and set invalid state. Move focus to first invalid field or linked error summary after submission. Use polite success announcements, urgent failures selectively and persistent recovery information when required. |
| Empty                    | Explain what was empty and offer one relevant next action if authorized. Filtered emptiness offers a reset; initial loading has distinct copy/layout.                                                                                                     |

Use a practical 44px touch target and respect WCAG 2.2 AA's 24px minimum or applicable spacing exceptions. Keep DOM reading order aligned with visual order. Non-modal disclosures have natural Tab order, return focus on keyboard dismissal, and allow the outside click to keep its natural focus destination. Menus and tabs use their respective arrow-key patterns only when implementing those widgets. Modal dialogs trap focus while open, support Escape unless an operation genuinely prevents dismissal, and return to the invoker or a logical surviving target. Announce error changes once. Decorative icons are hidden, functional icon buttons have descriptive names, and tooltips supplement visible or programmatic labels.

Admin icon sizes are 16px inline/control, 18px navigation, 20px major actions and 24px empty-state/supporting graphics; Public uses 16–20px control symbols. Retain react-icons, align icons visually, use about a 2px stroke where supported, and converge families only when touching a surface. Use 120–180ms state transitions for feedback; under reduced motion remove translation and rotation and retain immediate status feedback.

## Editor, forms and dense data

Use persistent labels, plain-language required cues, optional help with described-by, fieldsets/legends for grouped choices, and native autocomplete where appropriate. Group settings by task and keep bounded text fields, inline validation and section-specific save feedback. Preserve values after rejected saves and honor existing draft and revision behavior. Unsaved navigation should warn at the established guard and distinguish acknowledged saves from pending edits.

The publication picker retains typed date/time, local zone, configured formatting, explicit overlap choice with offsets and gap validation. Preserve modal commit/cancel behavior. Calendar navigation uses arrow keys, Home/End for week boundaries and Page Up/Down for month navigation where supported by the chosen grid pattern. Keep month announcements polite, focus on selected or current day, and use touch-friendly date cells where space permits. At 320px seven columns can use at least 36px cells with clear spacing; time controls should aim for 44px when they fit. Verify the format hint, day ordering, validation messages, numeric keyboard and native dialog scroll.

Content lists keep literal Created/Modified labels in cards, site-formatted dates and separate publication labels. At tablet group identity and dates if needed. On desktop use semantic table headers, aligned left identity, aligned row actions and aria-sort for the active column. Apply sticky headers only when focus remains visible. Keep filter/search/pagination scope visible, preserve existing bulk behavior where present, and give mobile sort the same choices as desktop. Repeat understandable field labels for card browse order. No icon or color should be the sole cue for publication state.

## Public preset composition

| Surface                        | Classic                                                                                             | Modern                                                                                                                                                          | Minimal                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Home                           | A serif lead and sequenced recent entries. Optional lead image follows a readable headline.         | One high-contrast editorial lead with an optional 16:9 cover, followed by a two-up recent grid where titles fit. Use natural document order at narrow sizes.    | Latest and Recent sections use the existing semantic hierarchy. Text and whitespace carry emphasis. |
| Archive                        | Divided list with aligned title, date and summary; optional modest covers.                          | Consistent 3:2 crop in repeat cards, naturally shorter text-only cards or a consistent grid fallback. Keep title and summary independent of image availability. | Single narrow list with quiet separators, no decorative card fill, and restrained taxonomy links.   |
| Article and standard Page      | Serif prose, comfortably spaced quotations and conventional supporting links.                       | Strong sans headline, clear byline/metadata, natural figure proportions and one concise next-read group.                                                        | Measured prose, thin section underlines only where they improve orientation, no redundant masthead. |
| Navigation and footer          | Familiar top links, subdued warm surfaces and readable footer groups.                               | Confident wordmark and an inverse footer with clear focus and link contrast.                                                                                    | Low-chrome links, subtle active underline and compact footer.                                       |
| Sidebar and supporting content | Optional sidebar follows content when narrow. Gallery, PDF and taxonomy inherit preset readability. | Optional sidebar may sit beside the main content when measure holds. Use consistent caption rhythm.                                                             | Keep sidebar conditional and quiet. Small square markers are decorative and used sparingly.         |

Across presets, keep meaningful alt text, intrinsic image dimensions, contextual PDF names and type/size where available. Home, Posts, Gallery and standard Page are content layouts independent of appearance. Preserve the canonical nested route, the optional Sidebar and both real pagination links and load-more behavior. No headline hierarchy should depend on a cover image, and disabled or absent features should leave no empty shell panel.
