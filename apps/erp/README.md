# Heristiq ERP

Inventory and sales for [Heristiq](https://heristiq.com) — a women's lifestyle
and fashion brand in Bangladesh.

One of two apps in this repo, alongside the [storefront](../store). Install and
run from the repo root — see the [root README](../../README.md). The schema for
both lives in [`supabase/migrations`](../../supabase/migrations); this app owns
`0001`-`0015`.

**Phase 1: inventory and profit calculation. No AI.**

- Products, categories and suppliers
- Purchases with **landed cost** — freight, import and other costs are allocated
  across lines by value, so unit cost reflects what stock actually cost
- An append-only **stock ledger** with moving weighted-average costing; stock
  levels are derived, never typed in
- Sales entry that snapshots cost at the moment of sale, so profit stays correct
  when purchase prices change
- Reports: best sellers, low stock, slow-moving stock, daily sales and profit

## Getting started

See [`docs/SETUP.md`](docs/SETUP.md).

## Where this is going

See [`docs/ROADMAP.md`](docs/ROADMAP.md) — the platform decision, cost, schema
principles, and the phased plan through customers, the order pipeline, expenses
and marketing, and eventually an AI analyst layer.

## Stack

Next.js (App Router) · TypeScript · Tailwind · Supabase (Postgres, Auth, RLS)

## Layout

```
../../supabase/migrations/  schema, costing triggers, posting functions, views,
                       RLS — shared with the storefront, this app owns 0001-0015
src/app/(app)/         authenticated pages
src/lib/supabase/      server, browser and proxy clients
docs/                  setup and roadmap
```
