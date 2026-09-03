# Heristiq — storefront

The public shop for [Heristiq](https://heristiq.com), a women's body jewellery
brand in Bangladesh. Mobile-first, editorial, built to turn Instagram and TikTok
traffic into cash-on-delivery orders.

Companion to **[heristiq-erp](../heristiq-erp)**, which stays the source of
truth for inventory, cost and profit. This repo does not own stock.

## How the two fit together

```
                 ┌──────────────────────────────┐
  customer  ───▶ │  heristiq-store (this repo)  │
                 │  catalogue · cart · checkout │
                 └───────────┬──────────────────┘
                             │  ErpClient (read)
                             │  orders       (write)
                 ┌───────────▼──────────────────┐
                 │  Supabase Postgres           │
                 │  products · stock ledger     │◀── heristiq-erp (owner)
                 │  purchases · sales · pre-ord │
                 └──────────────────────────────┘
```

- **The ERP owns stock.** `product_stock.on_hand` is a cache over an append-only
  `stock_movements` ledger, maintained by a trigger. The storefront reads
  `v_product_stock` and never writes a movement. A delivered order becomes an
  ERP `sale`, and `post_sale()` is what moves the stock.
- **The storefront owns the story.** Slug, finish, motif, description and length
  are not inventory data. They live in [`src/lib/erp/merchandising.ts`](src/lib/erp/merchandising.ts),
  keyed by SKU, and join onto the ERP row at read time.
- **`available`, not `on_hand`.** A unit claimed by an open pre-order is still in
  the drawer, so the ERP leaves `on_hand` alone — but it is promised. The
  storefront sells `available` (`on_hand − reserved`) so nothing sells twice.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | Matches the ERP exactly |
| Styling | Tailwind CSS v4, tokens in `globals.css` | Same as the ERP |
| Motion | `motion` (Framer Motion) | Restrained; reduced-motion respected |
| Images | Cloudinary, hand-rolled `srcset` | Cloudinary *is* the optimiser — see below |
| Data | Supabase Postgres (the ERP's own project) | Makes `ErpClient` real on day one |
| Hosting | Cloudflare Workers via OpenNext | Same as the ERP; free tier allows commercial use |

Two deviations from the original brief, both deliberate:

- **Supabase, not D1 + Drizzle.** The brief allowed either. The ERP already *is*
  a Supabase Postgres, so using it means the storefront reads real prices and
  real stock immediately instead of shipping a mock and a second database that
  would have to be reconciled.
- **No `next/image`.** Cloudinary already resizes, re-encodes and serves from a
  CDN edge. Stacking Next's optimiser in front means two resizes and two caches
  for one picture, and on Workers it needs a runtime binding. See
  [`src/lib/cloudinary.ts`](src/lib/cloudinary.ts).

## Security posture

The storefront reads the ERP with the **service-role key**, entirely
server-side, because the ERP's RLS grants `authenticated` only and its migration
`0011_revoke_anon_execute.sql` deliberately revoked `anon` across the schema.

The consequences are load-bearing, so they are enforced rather than documented:

- `src/lib/env.ts` and every ERP module import `server-only`. Pulling one into
  a client component is a **compile error**, not a leak.
- There is **no browser Supabase client** in this codebase. Do not add one.
- Catalogue queries **list their columns explicitly**. `v_product_stock` also
  exposes `avg_cost`, `stock_value`, `unit_margin` and `supplier`; none may
  reach a customer. Never replace that list with `select("*")`.

## Getting started

```bash
npm install
cp .env.example .env.local     # optional — see below
npm run dev                    # http://localhost:3000
```

**The site runs with no credentials at all.** With `SUPABASE_*` unset it serves
a mock catalogue seeded from the ERP's own seed files — the real seven SKUs,
names and stock counts. Set the two `SUPABASE_*` variables to switch to live
ERP prices and stock; nothing else changes.

Note that the mock ships **demo prices**. The business has not set retail prices
yet, so the ERP has `selling_price = 0` for all seven, and the live site will
correctly show "Price on request" with add-to-cart disabled until prices are
entered on the ERP's Products page. `WC-007` is left unpriced in the mock too,
so that path stays visible in development.

### Environment

See [`.env.example`](.env.example). Every variable is optional in development;
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required in production.

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run preview` | Build + run the Cloudflare Worker locally |
| `npm run deploy` | Build + deploy to Cloudflare |
| `node scripts/shoot.mjs / --slices` | Screenshot a route at phone size and report horizontal overflow |

`scripts/shoot.mjs` drives the Chrome already on the machine — no browser
download. Add `--desktop` for 1440px, `--full` for one tall image. It fails loud
on horizontal overflow, which is the fastest way to break a mobile-first layout
and the hardest to notice in a screenshot.

## Layout

```
src/app/                 routes
src/components/ui/       primitives — button, layout, price, badge, image
src/components/site/     header, footer, newsletter
src/components/home/     home page sections
src/components/shop/     grid filters, sort, empty state
src/components/product/  card, gallery + zoom, buy box, size guide, share
src/lib/erp/             the ErpClient seam: types, mock, real, factory
src/lib/                 format (৳ / Asia/Dhaka), phone, cloudinary, delivery, env
src/config/              brand copy, nav, motifs, testimonials
```

## Build order

Each phase is runnable and committed on its own.

- [x] **1 — Scaffold, design system, home.** Tokens, type scale, header/footer,
  hero, trust strip, featured rail, motif story, social proof, Instagram row.
- [x] **2 — `ErpClient` → Shop + PDP.** Grid with finish/motif filters and sort;
  gallery with zoom; stock state; size guide; delivery estimate; share.
  Filters are links, so a filtered grid is a shareable URL and works before JS.
- [ ] **3 — Cart + checkout.** Division → District → Area cascade, COD, phone OTP.
- [ ] **4 — Steadfast.** One-tap order push, delivery-status webhook, tracking page.
- [ ] **5 — Manual bKash/Nagad,** COD deposit toggle, pre-order flow.
- [ ] **6 — Admin-lite,** promo/threshold config, SEO and performance polish.

## Before launch

Real content has to replace placeholders. Nothing below is a code change.

- [ ] **Set retail prices** on the ERP Products page. Until then every piece
  reads "Price on request" and cannot be bought.
- [ ] **Upload photography to Cloudinary** under the IDs in
  `src/lib/erp/merchandising.ts` (`wc-005/front`, `wc-005/worn`, …), plus
  `hero/home`, `story/celestial`, `story/nautical` and `social/1…6`.
- [ ] **Replace the testimonials** in `src/config/testimonials.ts` with real
  messages you have permission to quote — or empty the array, which renders the
  section away. The file ships sample text so the section is designable; see the
  warning at the top of it. **Do not publish invented reviews.**
- [ ] **Confirm the contact number and social handles** in `src/config/site.ts`.
  They are placeholders.
