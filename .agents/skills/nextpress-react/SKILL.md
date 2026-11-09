---
name: nextpress-react
description: Implement or review React UI in NextPress, including Next.js App Router pages, layouts, and Server/Client Component boundaries.
---

# React and Next.js development

Apply [NextPress readability](../nextpress-readability/SKILL.md) for source edits. Name nontrivial JSX handlers, group related hooks/state and review component ownership without unrelated folder migrations. Preserve effect timing; do not swap layout effects for style.

Inspect the owning application and nearby components before choosing a pattern. `apps/web` and `apps/admin` are separate products with their own UI primitives and conventions; keep code in its owning workspace.

- In the App Router, prefer Server Components and server-side data access by default. Add `"use client"` only for state, effects, event handlers, browser APIs, or client-only libraries, and keep the client boundary as narrow as practical.
- Never import Prisma, credentials, Better Auth server helpers, or other server-only code into a Client Component. Keep secrets and authorization checks on the server.
- Pass serializable, minimal props across the server/client boundary. Use route handlers and server actions according to established nearby patterns; validate untrusted values at the boundary.
- Reuse each app's existing UI primitives. Preserve semantic HTML, keyboard access, focus visibility, loading/error states, and accessible names.
- Follow Next.js metadata, caching, and revalidation patterns found in the owning app. Do not infer public-site behavior from admin behavior.
- Run the owning workspace lint, typecheck, and relevant tests for behavioral changes. See [NextPress verification](../nextpress-verification/SKILL.md).