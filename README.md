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
- **The storefront owns orders.** `storefront_orders` and friends live in the
  same Postgres but are this repo's tables ([`supabase/migrations/1001`](supabase/migrations/1001_storefront_orders.sql)).
  An order is a customer's *request*; it becomes an ERP `sale` — and therefore a
  stock movement, via `post_sale()` — only once it is delivered and the cash is
  collected. Nothing in this repo writes `stock_movements`.

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
- **The cart is in `localStorage`, not a database.** The brief listed carts
  under persistence, but a server cart costs a round trip per quantity change
  and needs a cookie and a reaper for abandoned rows — and buys nothing here:
  there is no login, so it cannot follow anyone to another device. Orders, OTPs
  and (in phase 5) manual-payment records are persisted properly; those are the
  rows that matter. What makes it safe is that the cart decides nothing — see
  **What the browser is not allowed to decide** below.
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

## What the browser is not allowed to decide

Checkout is the only part of this site where being wrong costs money, so the
trust boundary is worth stating plainly. The cart lives in `localStorage`, and
**every number in it is a display snapshot**. When an order is placed
([`src/lib/orders/place.ts`](src/lib/orders/place.ts)) the server:

1. takes only `productId` and `qty` from the payload — the schema has no field
   for a price, a subtotal or a total, so there is none to tamper with;
2. re-reads every product from the ERP and uses *those* prices, which is also
   what catches a cart that sat in a phone for a week across a price change;
3. re-checks free stock and turns a sold-out line into a pre-order rather than
   overselling it;
4. recomputes the delivery fee from the district;
5. checks that the phone on the order is the phone that actually answered an
   SMS — not merely that *some* number was verified in this browser;
6. writes it in one transaction ([`place_storefront_order`](supabase/migrations/1001_storefront_orders.sql)),
   where a CHECK constraint verifies the total adds up a second time.

Two smaller ones that are easy to get wrong:

- **Order URLs use a random token, not the reference.** References are
  sequential (`HQ-01001`), so `/order/HQ-01002` would let anyone walk the
  numbers and read every customer's name, phone and home address.
- **OTP codes are stored as `HMAC-SHA256(code, secret)`.** A bare hash of six
  digits is a rainbow table anyone can build in a second.

### Phone verification, and why it earns its friction

Return-to-origin — a courier carrying a ৳300 parcel across the country to a
number that never answers — is the single biggest cost in Bangladeshi
f-commerce, and most of it is orders placed with a phone nobody can reach.
Making the number answer once, before the parcel moves, removes most of that.
Three limits close three different holes: attempts per code (guessing), sends
per hour (using this site as a free SMS bomber), and a resend cooldown
(the same, faster, and double-taps costing two SMS).

The gateway is behind an interface ([`src/lib/otp/sender.ts`](src/lib/otp/sender.ts))
because which Bangladeshi bulk-SMS provider this business ends up on depends on
trade-licence paperwork nobody has finished. WhatsApp Cloud API drops in as a
third implementation with no change anywhere else.

## Couriers

Three providers behind one interface ([`src/lib/courier/provider.ts`](src/lib/courier/provider.ts)),
because this business picks a courier by area and by who is answering the phone
that week, and the storefront must not have an opinion:

| Provider | State | Notes |
|---|---|---|
| **Pathao** | Implemented fully — the default | The courier this business uses. OAuth, and an address that has to be resolved to city/zone/area ids |
| **Steadfast** | Implemented fully | `COURIER_DEFAULT=steadfast` switches to it. Two auth headers, no OAuth, takes a written address |
| **RedX** | Stub behind the interface | Needs an approved merchant account before any of it can be tested |

The load-bearing part is the **normalised status**
([`src/lib/courier/status.ts`](src/lib/courier/status.ts)). Steadfast says
`delivered_approval_pending`, Pathao says `Pickup_Requested`; neither belongs on
a customer's screen. Providers map their own vocabulary onto one enum, and
[the tracking rail](src/components/track/status-rail.tsx) genuinely cannot tell
which courier carried the parcel.

### Pathao does not accept an address

It accepts a **city id, a zone id and an area id** from its own taxonomy. The
checkout collects a division/district/area ([`bd-geo.ts`](src/lib/bd-geo.ts))
because that is what a customer knows and what any courier can be mapped *from*
— so something has to bridge them, and that bridge is the most delicate part of
this integration:

- **Districts were renamed** between 2018 and 2019 and couriers adopted the new
  spellings at their own pace. We say Jashore, Bogura, Chattogram, Cumilla;
  Pathao may still say Jessore, Bogra, Chittagong, Comilla. Normalising away
  punctuation and case handles a surprising amount (`Cox's Bazar` →
  `coxsbazar`); an alias table handles the rest.
- **Pathao splits busy thanas into numbered zones.** Someone typing "Mirpur"
  matches Mirpur 1, 10, 11, 12… Refusing an ambiguous match would refuse the
  commonest destination in Dhaka, and it is *not* the safer choice: every one of
  those zones is in Mirpur and the rider navigates by the written address
  anyway. So when every candidate begins with what the customer wrote they are
  treated as one locality and the least-qualified name wins.
- **Genuine ambiguity still refuses.** A bare "Sadar" matching four different
  districts' Sadar zones is a parcel on the wrong side of the country, so the
  push fails with a message naming the area that did not resolve.

Every resolution is cached in `storefront_courier_zones` with how it was
arrived at, and a row marked `source='manual'` is never overwritten by
matching — so a wrong zone is corrected **once**, by the owner, with one
`UPDATE` and no deploy. What was actually sent for a given parcel is recorded
on the shipment (`courier_location`), including whether the match was exact,
an alias, or fuzzy: when a parcel goes to the wrong thana, that column says why.

The matching is pure and has no imports, so it is tested against fixtures with
no Pathao account:

```bash
node scripts/pathao-match-test.mjs     # 41 cases, the renamed districts included
```

Three things in here are less obvious than they look:

- **A push is not idempotent and cannot be made so** — the courier assigns the
  id, so there is nothing to deduplicate on. Two pushes means two riders at one
  door and two delivery charges. So `pushOrderToCourier` checks for an existing
  shipment before it talks to anyone, and a network failure mid-POST is reported
  as `uncertain` with instructions to check the portal rather than a retry
  button.
- **Webhooks arrive out of order.** Couriers retry, and a redelivered
  `in_transit` landing after `delivered` would tell a customer holding the
  parcel that it is still on its way. `courier_status_rank()` in migration 1002
  rejects backwards moves along the happy path — while always applying
  `on_hold`, `returned`, `lost` and `cancelled`, which can genuinely happen at
  any point and are the events most worth seeing.
- **Every callback is stored before it is acted on**, keyed uniquely, so a
  replay is a no-op and a payload we could not use is still on record.
- **Pathao's webhook has a contract that is easy to fail silently.** They send
  `X-PATHAO-Signature` carrying your secret verbatim, and they expect **HTTP
  202** with the header `X-Pathao-Merchant-Webhook-Integration-Secret` set to a
  constant *they* publish — not to your secret. They also fire a
  `webhook_integration` event when you save the URL, which must be accepted
  before any order event will follow. All of that is taken from
  [Pathao's own WooCommerce plugin](https://github.com/pathao-eng/courier-woocommerce-plugin),
  which is authoritative, rather than from a blog post.

Statuses come from webhooks first and a poll second — `/track` asks the courier
directly, but at most once a minute per shipment and never in a way that can
fail the page.

### One-tap push

`POST /api/admin/orders/HQ-01042/ship` with `Authorization: Bearer $ADMIN_TOKEN`.
Phase 6's admin screen is a button that calls this; today:

```bash
node scripts/ship.mjs HQ-01042            # or a phone shortcut
```

The token has **no fallback in any environment** — everything the endpoint does
is irreversible and hands a customer's address to a third party.

### Setting Pathao up

```bash
node scripts/courier-check.mjs                  # or: … Cumilla Laksam
```

This is the setup step, not just a health check. It issues a token, **lists your
stores** — the only way to discover `PATHAO_STORE_ID` — lists their cities, and
then resolves a sample address through the same matcher the push uses, telling
you whether the match was exact or fuzzy. It creates nothing.

For Steadfast it calls `get_balance`, the only endpoint that proves the base
URL, both auth headers and the credentials together without creating anything.
That check exists for an honest reason: Steadfast's two header names
(`Api-Key` / `Secret-Key`) come from their v1 documentation, not from a request
this codebase has made against a live account.

### Anti-fraud

The recipient's courier history is fetched **before** a push and **never blocks
it**. A customer with two cancelled parcels two years ago is not a fraudster,
and a storefront that silently refuses their order never finds out why it lost
them. Below `COURIER_RISK_SUCCESS_FLOOR` the push comes back with a note saying
so, and the profile is cached per phone number.

### Why tracking asks for two things

`/track` needs the order reference **and** the phone it was placed with. The
brief said "by phone or order id"; either alone is a disclosure — references are
sequential, so they can be counted, and a phone number alone would let anyone
who has yours read your home address. Together they are something only the
person who ordered has, and it is still one screen and no login. A wrong pair
and an unknown reference give the identical message, so the page cannot be used
to confirm that an order exists.

The frictionless path is unchanged: the confirmation page's own link carries an
unguessable token, and that page turns into the tracking page once the parcel
ships.

## Database

The ERP applies `0001`–`0999` from its own repo. This repo owns `1001` up, so
the two numberings cannot interleave and make the applied order depend on which
repo ran last.

```bash
# Supabase → SQL editor, or:
supabase db push        # from this directory, against the ERP's project
```

- **1001** — `storefront_orders`, `storefront_order_items`,
  `storefront_order_events`, `storefront_phone_otp`, and the
  `place_storefront_order()` transaction.
- **1002** — `storefront_shipments`, `storefront_courier_webhooks`,
  `storefront_phone_risk`, and `apply_courier_status()`, which moves a
  shipment, the order's own status, the audit trail and the webhook log in one
  transaction.
- **1003** — `storefront_courier_zones` (the district/area → courier-taxonomy
  mapping, with human corrections that matching never overwrites) and
  `storefront_shipments.courier_location`.

Until they are applied the storefront reads the catalogue fine and **cannot
record an order** — the correct failure, rather than a half-written one.

Both were verified by applying them to a throwaway Postgres on top of all
fifteen ERP migrations, then exercising the RPCs, the CHECK constraints and
every grant. Notably: `service_role` can place orders and apply courier
statuses, `authenticated` (the owner in the ERP app) can read orders and
shipments but not OTP hashes or fraud history, and `anon` can reach none of it.

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

That now covers **the whole checkout**, not just browsing: with no credentials
the OTP store falls back to memory and the code is printed to the server log and
shown on screen, and a placed order is kept in the server's memory so the
confirmation page renders. That page says so in an unmissable banner — a
confirmation that looks real for an order nobody will ever pack is the one
outcome this flow must not produce. `node scripts/checkout-e2e.mjs` walks all of
it.

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
| `node scripts/shoot.mjs /` | Screenshot a route at phone size and report horizontal overflow |
| `node scripts/checkout-e2e.mjs` | Walk a real order through the site: add to cart → OTP → address → place → confirm |
| `node scripts/courier-e2e.mjs` | Walk phase 4: push → webhook → replay → stale status → tracking rail |
| `node scripts/courier-check.mjs` | Set up and verify a courier: Pathao stores, cities, sample address; Steadfast balance |
| `node scripts/pathao-match-test.mjs` | 41 fixture cases for the address matcher, no account needed |
| `node scripts/ship.mjs HQ-01042` | Push one order to its courier (the one-tap push, from a terminal) |

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
src/components/cart/     cart store, cart page, add-to-cart, quick-add
src/components/checkout/ form, address cascade, phone verification, summary
src/components/track/    normalised status rail, tracking form
src/lib/erp/             the ErpClient seam: types, mock, real, factory
src/lib/orders/          order types, checkout schema, server-side placement
src/lib/otp/             sender + store seams, verification, signed cookie
src/lib/courier/         provider seam, Pathao, Steadfast, status model, dispatch
src/lib/                 format (৳ / Asia/Dhaka), phone, cloudinary, bd-geo,
                         delivery, crypto, env
src/config/              brand copy, nav, motifs, testimonials
supabase/migrations/     storefront-owned tables (1001+)
```

## Build order

Each phase is runnable and committed on its own.

- [x] **1 — Scaffold, design system, home.** Tokens, type scale, header/footer,
  hero, trust strip, featured rail, motif story, social proof, Instagram row.
- [x] **2 — `ErpClient` → Shop + PDP.** Grid with finish/motif filters and sort;
  gallery with zoom; stock state; size guide; delivery estimate; share.
  Filters are links, so a filtered grid is a shareable URL and works before JS.
- [x] **3 — Cart + checkout.** One-screen checkout; Division → District →
  Area/thana cascade (8 / 64 / ~500, the third level a suggestion not a
  constraint); COD; phone OTP with rate limits; server-side re-pricing; order
  confirmation on an unguessable URL.
- [x] **4 — Couriers.** Pathao (the courier in use) and Steadfast both
  implemented behind one interface, RedX stubbed; normalised status shared by
  all of them; Pathao address → city/zone/area resolution with a correctable
  mapping table; one-tap push with a double-send guard; delivery-status
  webhooks that are authenticated, idempotent and safe against out-of-order
  retries; advisory fraud check; tracking page.
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
- [ ] **Set the Pathao webhook** in their merchant dashboard: callback URL
  `https://heristiq.com/api/webhooks/pathao`, secret matching
  `PATHAO_WEBHOOK_SECRET`. Without it, statuses only update when someone opens
  the tracking page. (Steadfast's equivalent, if you use it, is
  `/api/webhooks/steadfast` with `STEADFAST_WEBHOOK_TOKEN`.)
- [ ] **Run `node scripts/courier-check.mjs`** once the Pathao credentials are
  in — it is how you get `PATHAO_STORE_ID` — and check that a couple of real
  customer addresses resolve before the first parcel.
