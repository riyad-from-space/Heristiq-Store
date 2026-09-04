# Heristiq — one repo, two apps

Read [README.md](README.md) first for the layout. The short version:

- `apps/store` — public storefront. Runs with no credentials (mock catalogue,
  in-memory orders/OTPs, stand-in courier), so it is always browsable.
- `apps/erp` — authenticated admin over real data. Needs its Supabase values.
- `packages/shared` — phone/money/date rules both apps must agree on.
- `supabase/migrations` — the whole schema, both apps, one filename order.

## Working here

- `npm install` at the ROOT. It is one npm workspace with one lockfile.
- Commands are per app: `npm run dev` (store, port 3000), `npm run dev:erp`
  (ERP, port 3001 — they cannot share a port).
  `npm run build|typecheck|lint` run across both.
- **The apps must not import each other** — an ESLint rule enforces it in both
  directions. The storefront holds the service-role key and is public; the ERP
  is admin-only over cost and margin. Shared code goes in `packages/shared`.
- Money and phone formatting live in `packages/shared`, not in either app.
  Both apps' `src/lib/format.ts` and `src/lib/phone.ts` are re-exports.

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may
all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation
notices.

**Note the monorepo path.** Dependencies are hoisted to the workspace root, so
the docs are at `node_modules/next/dist/docs/` relative to the REPO ROOT — not
relative to `apps/store` or `apps/erp`, where `node_modules` may not exist.

Each app keeps its own `AGENTS.md`, which `next dev` writes and re-adds there
(see `node_modules/next/dist/server/lib/generate-agent-files.js`). This root
file is hand-maintained and is not regenerated.
