-- ============================================================================
-- 1009 — Photographs, owned by the ERP instead of by the codebase.
--
-- Until now a product's photographs lived in apps/store/src/lib/erp/
-- merchandising.ts as a hand-written array of Cloudinary ids. That meant
-- adding a second angle to a piece was: rename the file to a convention,
-- run a terminal script, edit TypeScript, rebuild, redeploy. The owner does
-- not have a terminal. In practice it meant photographs were added by me.
--
-- This moves the list into the database, where the ERP can write it — the
-- same move migration 1004 made for delivery fees and the promo banner, and
-- for the same reason: a thing that changes weekly must not require a deploy.
--
-- WHAT THIS DOES NOT CHANGE: the delivery URL. The storefront still builds
-- `f_auto,q_auto,w_N,...` itself (apps/store/src/lib/cloudinary.ts) and still
-- reads the same Cloudinary account. Only the question "which ids does this
-- product have?" moves from a TypeScript literal to a table. A photograph
-- uploaded through the ERP is delivered by byte-identical transformations to
-- one uploaded by the old script.
--
-- merchandising.ts stays as the FALLBACK. A product with no rows here keeps
-- rendering exactly what it renders today, so applying this migration changes
-- nothing a customer sees until someone uploads something.
--
-- ORDER OF OPERATIONS: THIS MIGRATION FIRST, THEN DEPLOY.
--
-- The storefront adds `images` to its catalogue column list, and a column list
-- is not a request for something optional — PostgREST answers "column
-- v_product_stock.images does not exist" and the read throws. Deploying the
-- code against a database without this migration takes the shop down.
--
-- That cannot happen by accident: the storefront prerenders its home page at
-- BUILD time, against the real database, so the build fails before it can
-- produce a bundle. The failure is the guard. Apply this, then build.
--
-- The reverse order is safe and needs no coordination: this migration only
-- ADDS, so the currently deployed code — which does not ask for `images` —
-- carries on unchanged the moment it is applied. Same hard dependency, and
-- the same ordering, as category_slug in 1008.
-- ============================================================================

create table if not exists product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,

  -- The Cloudinary public ID, RELATIVE to the account folder — "products/
  -- WC-008/k3f9x2", not "heristiq/products/WC-008/k3f9x2". cloudinary.ts's
  -- publicId() prefixes the folder at render time and tolerates either shape,
  -- but storing the relative form is what merchandising.ts already does and
  -- it keeps a staging folder possible (NEXT_PUBLIC_CLOUDINARY_FOLDER).
  public_id   text not null,

  -- What a customer on a slow connection reads, and most of how a search
  -- engine understands a jewellery photograph. NOT NULL with a default of ''
  -- rather than nullable: an empty string is a decorative image, which is a
  -- decision; NULL is an oversight, and the two should not look alike.
  alt         text not null default '',

  -- Display order, low first. The first row is the hero — the card thumbnail
  -- and the PDP's opening shot.
  position    integer not null default 0,

  -- Reported by Cloudinary at upload. Kept because it is the only way to
  -- answer "was the master downsized?" after the fact, and because a known
  -- aspect ratio lets a gallery reserve space before the image loads.
  width       integer,
  height      integer,
  format      text,
  bytes       integer,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- The same photograph twice on one product is always a mistake, and without
  -- this it is an easy one: a double-click on upload posts the row twice.
  unique (product_id, public_id)
);

-- The storefront reads every image for a product, ordered. The ERP reads the
-- same. One index serves both.
create index if not exists product_images_product_idx
  on product_images (product_id, position, created_at);

create trigger product_images_touch
  before update on product_images
  for each row execute function touch_updated_at();

comment on table product_images is
  'Product photographs, written by the ERP. Overrides the hard-coded list in '
  'apps/store/src/lib/erp/merchandising.ts when a product has any rows here.';
comment on column product_images.public_id is
  'Cloudinary public ID relative to the account folder, e.g. "products/WC-008/k3f9x2".';
comment on column product_images.alt is
  'Alt text. Empty means decorative — a decision, not an oversight.';
comment on column product_images.position is
  'Display order, low first. Position 0 is the hero shot.';

-- ───────────────────────────────────────────────────────────────── RLS ──
--
-- Same shape as storefront_settings in 1004: the ERP writes as an
-- authenticated admin, and nothing else may touch it. The storefront holds
-- the service-role key and bypasses RLS entirely, so this policy is not what
-- lets the shop read photographs — it is what stops `anon` from writing them.
alter table product_images enable row level security;

create policy product_images_admin_all on product_images
  for all to authenticated using (is_erp_admin()) with check (is_erp_admin());

-- ──────────────────────────────────── images on the storefront's window ──
--
-- APPENDED at the end of the select list, after category_position. This is
-- not stylistic: `create or replace view` matches columns POSITIONALLY, so
-- putting `images` anywhere else makes Postgres read it as renaming an
-- existing column and refuse with "cannot change name of view column".
-- Migration 1008 learned this the same way.
--
-- A scalar subquery rather than a join + group by, because every other column
-- here is one row per product and a join would change that. coalesce to an
-- empty array so the storefront never has to distinguish null from none.
create or replace view v_product_stock with (security_invoker = on) as
select
  p.id, p.sku, p.name, p.is_active, p.selling_price, p.reorder_level,
  c.name as category, s.name as supplier,
  coalesce(ps.on_hand, 0)  as on_hand,
  coalesce(ps.avg_cost, 0) as avg_cost,
  round(coalesce(ps.on_hand, 0) * coalesce(ps.avg_cost, 0), 2) as stock_value,
  round(p.selling_price - coalesce(ps.avg_cost, 0), 2)         as unit_margin,
  case when p.selling_price > 0
       then round(((p.selling_price - coalesce(ps.avg_cost, 0)) / p.selling_price) * 100, 1)
  end as margin_pct,
  ps.last_movement_at,
  coalesce(r.reserved, 0) as reserved,
  coalesce(ps.on_hand, 0) - coalesce(r.reserved, 0) as available,
  c.slug     as category_slug,
  c.position as category_position,
  (
    select coalesce(
             jsonb_agg(
               jsonb_build_object('id', pi.public_id, 'alt', pi.alt)
               order by pi.position, pi.created_at
             ),
             '[]'::jsonb
           )
    from product_images pi
    where pi.product_id = p.id
  ) as images
from products p
left join product_stock   ps on ps.product_id = p.id
left join categories      c  on c.id = p.category_id
left join suppliers       s  on s.id = p.supplier_id
left join v_reserved_stock r  on r.product_id = p.id;
