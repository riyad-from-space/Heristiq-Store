# Setup

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New project. Pick the **Singapore**
   region (closest to Bangladesh).
2. Save the database password somewhere safe.

## 2. Create the schema

Open the Supabase dashboard → **SQL Editor** → New query. Run the files in
[`supabase/migrations/`](../supabase/migrations/) **in filename order**, one at a
time:

1. [`0001_init.sql`](../supabase/migrations/0001_init.sql) — tables, costing
   triggers, posting functions, reporting views, row-level security policies.
2. [`0002_exclude_unposted_sales.sql`](../supabase/migrations/0002_exclude_unposted_sales.sql)
   — keeps sales that were never posted out of revenue and profit.

Order matters: later files amend what earlier ones create.

## 3. Create your login

Supabase dashboard → **Authentication → Users → Add user**. Use your email and a
password, and tick *Auto Confirm User*.

There is no public sign-up — the app is internal, so accounts are created by
hand. Anyone with an account has full access.

## 4. Connect the app

Supabase dashboard → **Project Settings → API**. Copy the Project URL and the
`anon` public key into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

The `anon` key is safe in the browser — row-level security is what protects the
data. Never put the `service_role` key in this file.

## 5. Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in.

---

## Using it

The order things happen in matters, because stock and cost are derived:

1. **Suppliers** — add who you buy from.
2. **Products** — add what you sell. Set the SKU, selling price, and a reorder
   level (you get warned when stock drops to it).
3. **Purchases** — record what you bought and what it cost. Put freight, import
   and other costs in the *Extra costs* box; they are spread across the lines by
   value, so the cost per unit is the **real** cost, not just the supplier price.
   Saving a purchase is what puts stock in.
4. **Sales** — record an order. Cost is captured at the moment of sale, so profit
   stays correct even when you later buy the same product at a different price.
5. **Stock** — adjust when the shelf count disagrees with the system.
6. **Reports** — best sellers, what needs restocking, what is sitting unsold.

### How profit is calculated

```
product revenue = items total − discount
gross profit    = product revenue − cost of goods
                  + (delivery charged to customer − delivery paid to courier)
```

Free delivery shows up as a negative delivery line, which is the honest way to
see what a free-delivery promotion actually costs.

### Things that are deliberately not editable

**Stock levels.** They are derived from purchases, sales and adjustments — every
change is a permanent record. To correct a count, record an adjustment on the
Stock page. This is why the numbers stay trustworthy.

If a sale is cancelled or returned, use the buttons on the Sales page. That puts
the stock back at the cost it left at, and removes the sale from revenue and
profit totals.

---

## Deploying

Cloudflare Pages, not Vercel — Vercel's free tier is non-commercial only, and
this is a business. See [`ROADMAP.md`](ROADMAP.md) §3 for cost.

Set the same two environment variables in the Cloudflare Pages project settings.

## Before this holds real data

Move the Supabase project to the **Pro plan ($25/month)**. The free tier has no
automated backups and pauses after about a week of inactivity. Losing this
database means losing the business's inventory and sales records.
