# Heristiq ERP — Plan of record

Written 26 August 2026. This captures the architecture decisions and the phased
plan. Phase 1 is built; everything after it is deliberately deferred.

---

## 1. Platform decision: responsive web app, installable as a PWA

**Not a Windows desktop app. Not a native mobile app (yet).**

Reasoning:

- Orders arrive in Messenger/Instagram DMs and are confirmed on a phone. A
  desktop-only app means orders get logged late or not at all, which corrupts
  both inventory and every report built on it.
- Physical stalls and campus events are in the growth plan. A desktop app is
  dead weight there.
- A Windows app makes updates, backups and multi-user access our problem. If the
  laptop dies, the business records die with it.
- Supabase is hosted Postgres behind a REST/Realtime API — its client story is
  web and mobile.

One responsive codebase serves phone and desktop. Desktop is the same site in a
browser, with wider layouts for bulk work like purchase entry.

**Revisit native mobile** only when there is a concrete need a PWA cannot meet:
reliable offline order entry, or iOS push notifications. Not before — native
doubles the build and adds app-store review to every change.

## 2. Stack

| Layer | Choice | Note |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind | |
| Backend/DB | Supabase — Postgres, Auth, Storage, Realtime, Edge Functions, `pg_cron` | |
| Hosting | **Cloudflare Pages/Workers** | Not Vercel: the free Hobby plan is non-commercial only, and Heristiq is a business. Cloudflare's free tier permits commercial use. |
| AI (phase 5+) | Claude API from a server route | Not built yet. |

## 3. Running cost

| Stage | Monthly |
|---|---|
| Building / testing | **$0** — Supabase Free + Cloudflare Pages |
| Live with real business data | **~$25–40** — Supabase Pro $25 + AI $5–15 |

Two things to know:

- **Supabase Free pauses projects after ~1 week of inactivity and has no
  automated backups.** The free tier is fine for building. The moment real order
  and inventory data lives in there, move to Pro — losing the database means
  losing the business's records.
- **Vercel's free tier is non-commercial.** Hence Cloudflare above.
- Paying Supabase/Cloudflare/Anthropic from Bangladesh needs an international
  card. Sort this out before it becomes urgent. Fallback: self-host Supabase on a
  ~$6/month VPS — cheaper, but the ops (updates, monitoring, restores) become
  ours.

## 4. Schema principles (already applied in phase 1)

These are the decisions that are expensive to change later, so they are in from
the start:

1. **Stock is never a directly-editable number.** Every change is a row in
   `stock_movements`; `product_stock` is a trigger-maintained cache. The ledger
   is append-only — corrections are new movements, not edits. Every ERP that
   skips this ends up with stock numbers nobody trusts.
2. **Landed cost is a schema decision, not a report.** Freight/import/other sit
   on the purchase header and are allocated across lines by value at post time.
   COGS reads the landed cost, never the raw supplier price.
3. **Weighted average costing**, not FIFO. FIFO is real complexity that this
   volume does not justify.
4. **Money is `numeric`, never float.** Timestamps are `timestamptz`, rendered in
   `Asia/Dhaka`.
5. **`org_id` on every business table**, defaulted to a single org. Multi-tenancy
   becomes a policy change later instead of a migration.
6. **RLS on every table from day one.**
7. **Leads and orders will be separate tables** (phase 2). A message is not a
   sale — enforce that structurally, and the inquiry→order conversion rate falls
   out of the schema for free.
8. **Configurable, not hard-coded.** Delivery thresholds and courier charges
   belong in a `settings` table, not in code — they change with every promotion.

## 5. Phases

### Phase 1 — Inventory + simple calculation ✅ built

Products, categories, suppliers, purchases with landed-cost allocation, the
stock ledger, manual adjustments, basic sales entry, and per-sale profit.
No AI. See `docs/SETUP.md`.

Sales exist in phase 1 only because stock has to leave somehow, and because
profit cannot be calculated without a sale price to compare cost against.

### Phase 2 — Customers and the order pipeline

- `customers` table with purchase history, total spent, last purchase date
- `leads` table: channel, campaign, status — **separate from orders**
- Full order lifecycle: new inquiry → interested → pending → confirmed →
  preparing → shipped → delivered → completed, plus cancelled / returned /
  failed delivery
- `order_status_history` so time-in-stage is measurable
- `deliveries`: courier, tracking number, COD amount
- `settings` table for delivery thresholds and courier charges

### Phase 3 — Dashboard KPIs

Built on database views, no AI. Sales growth, AOV, margin, order completion
rate, cancellation rate, return rate, repeat purchase rate, inventory turnover.

### Phase 4 — Money out

Expense categories, marketing campaigns, manual ad-spend entry, net profit
(not just gross). Revenue and profit stay clearly distinct everywhere.

### Phase 5 — AI assistant

Design constraints, decided up front:

- **Never give the model raw SQL access to production tables.** Create a
  read-only Postgres role scoped to the `v_*` analytics views.
- Expose typed tools — `get_sales_summary(period)`,
  `get_product_performance(days)`, `get_campaign_funnel(id)` — plus at most one
  constrained query tool bound to that read-only role.
- Run it server-side. The API key never reaches the browser.
- **The rule that makes this trustworthy: the model reports only numbers that
  came back from a tool call.** Everything else is labelled an assumption.
- Cost control: prompt caching (the schema prompt is identical every call) and
  the Batch API for the nightly job.

**Proactive alerts belong in `pg_cron`, not the model.** A nightly job computes
alert conditions into an `alerts` table; the AI phrases them. Cheaper and far
more reliable than asking an LLM to notice things.

### Phase 6 — Integrations

Meta Marketing API for automatic ad spend. Courier APIs (Steadfast, Pathao,
RedX). TikTok later.

## 6. Sequencing rule

Ship phase 1–2 and use it for real orders before building anything else. A
dashboard over empty tables teaches nothing, and an AI over thin data invents
patterns that are not there.
