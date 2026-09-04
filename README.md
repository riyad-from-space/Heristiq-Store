# Heristiq

Two apps, one Postgres, one repo.

[Heristiq](https://heristiq.com) is a women's body jewellery brand in
Bangladesh. The ERP runs the business; the storefront sells to customers. They
were separate repositories until they weren't — see [why](#why-one-repo).

| | What it is | Runs at |
|---|---|---|
| **[apps/store](apps/store)** | The public storefront. Catalogue, cart, checkout, COD, phone OTP, courier tracking | `npm run dev` |
| **[apps/erp](apps/erp)** | The owner's admin. Inventory, landed-cost purchasing, the stock ledger, sales, profit, pre-orders | `npm run dev:erp` |
| **[packages/shared](packages/shared)** | Rules both must agree on: phone normalisation, money and date formatting | — |
| **[supabase/migrations](supabase/migrations)** | The whole schema, both apps, in one dependency order | — |

Each app has its own README with the detail. Start there:
**[storefront](apps/store/README.md)** · **[ERP](apps/erp/README.md)**

## Getting started

```bash
npm install            # one lockfile, both apps

npm run dev            # storefront  → http://localhost:3000
npm run dev:erp        # ERP         → http://localhost:3001/admin

npm run build          # both apps
npm run typecheck      # both apps
npm run lint           # both apps
```

The storefront **runs with no credentials at all** — mock catalogue, in-memory
orders and OTPs, a stand-in courier — so the whole flow including checkout and
tracking is browsable on a fresh clone. The ERP needs its two
`NEXT_PUBLIC_SUPABASE_*` values, as it always has: it is an authenticated admin
app over real data, and there is nothing sensible for it to show without them.

Copy the env template of whichever app you are running:

```bash
cp apps/store/.env.example apps/store/.env.local
cp apps/erp/.env.example   apps/erp/.env.local
```

## One domain, two apps

The ERP is reached **from the website** — `heristiq.com/admin` — rather than a
remembered `workers.dev` URL. The storefront's footer carries a quiet "Owner
sign-in" link to it.

That works in two halves, and both are required:

1. **`basePath: "/admin"`** in [`apps/erp/next.config.ts`](apps/erp/next.config.ts).
   Next prefixes every `next/link`, `redirect()` and `router.push()`
   automatically, so no ERP page or action changed. It is inlined at build
   time, so switching it needs a rebuild.
2. **A Cloudflare route** sending `heristiq.com/admin*` to the ERP Worker and
   everything else to the storefront. Cloudflare matches the more specific
   pattern first.

The routes are written out but **commented** in both `wrangler.jsonc` files,
because a route needs `heristiq.com` to exist as a zone in the Cloudflare
account and `wrangler deploy` fails if it does not. Uncomment both once the
zone is there. Until then each Worker deploys to its own `workers.dev` URL, and
`NEXT_PUBLIC_ERP_URL` points the footer link at the ERP's.

Locally the two apps are two servers, so the footer's `/admin` is a 404 on port
3000 — set `NEXT_PUBLIC_ERP_URL=http://localhost:3001/admin` in
`apps/store/.env.local` if you want the link to work while developing. The ERP
itself serves at `http://localhost:3001/admin`. Security is the ERP's Supabase login, not the
obscurity of the path — every ERP route redirects to `/admin/login` when signed
out.

## The database

Both apps read and write **one** Supabase Postgres, and the migrations are now
one folder applied in filename order:

```
supabase/migrations/
  0001…0015   the ERP's schema — products, stock ledger, purchases, sales,
              pre-orders, and the RPCs that move stock
  1001…1003   the storefront's — orders, OTPs, shipments, courier zones
```

```bash
supabase db push        # or paste them into the Supabase SQL editor in order
```

The numbering split is load-bearing: the ERP owns `0001`–`0999` and the
storefront `1001`+, so the two can grow without renumbering each other. What
changed by merging is that the *ordering* is now a fact about one directory
rather than a convention two repositories had to respect.

`supabase/RUN_ME_NEXT.sql` is not a migration — it is `0011`–`0015`
concatenated for a one-off paste into the SQL editor, kept for history. It sits
outside `migrations/` so it cannot be applied as if it were the next step.

**Neither set has been applied to the live project yet.** Until they are, the
storefront reads the catalogue and refuses to record an order, which is the
correct failure rather than a half-written one.

## Who owns what

- **The ERP owns stock.** `product_stock.on_hand` is a trigger-maintained cache
  over an append-only ledger. The storefront reads `v_product_stock` and never
  writes a movement. A delivered order becomes an ERP `sale`, and `post_sale()`
  is what moves stock.
- **The storefront owns orders.** `storefront_orders` and friends are its
  tables. An order is a customer's *request* until it is delivered and the cash
  is collected.
- **`packages/shared` owns the rules that must not drift.** Phone
  normalisation is the sharp example: the ERP searches on numbers the
  storefront wrote, and migration `0015` enforces the same rule in the database,
  so a number stored two ways never matches. There used to be two copies kept
  in step by hand and a comment asking nicely.

### The apps must not import each other

The storefront runs with the Supabase **service-role key** and is public. The
ERP is an authenticated admin app over cost, margin and supplier data. When
these were separate repositories that boundary was free; in one workspace it is
an ESLint rule (`no-restricted-imports`) in both apps. Anything genuinely
shared goes in `packages/shared`, which both may import.

## Why one repo

The deciding reason was the schema. One database, migrations in two
repositories, and an ordering guarantee that existed only as a numbering
convention written in a comment. `1001` only works if `0001`–`0015` ran first,
and nothing enforced that.

Everything else was already aligned and made it cheap: identical stacks (Next
16.3.3, React 19.2.8, Tailwind 4, OpenNext on Cloudflare Workers), the ERP's
dependencies a near-subset of the storefront's, and two distinct Worker names —
so **the deploys did not change**. They are still two independent
deployments:

```bash
npm run deploy:store
npm run deploy:erp
```

Both histories are intact. The ERP arrived by `git subtree`, so its commits are
in `git log` rather than flattened into one "add ERP" blob.
