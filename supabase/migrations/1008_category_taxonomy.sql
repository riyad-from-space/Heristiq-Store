-- ============================================================================
-- 1008 — categories become a real storefront taxonomy
--
-- Heristiq sells more than waist chains. The pieces of this that already
-- existed: a `categories` table, `products.category_id`, a category dropdown
-- on the ERP's product form, and `v_product_stock` already joining the
-- category NAME. What was missing is everything the storefront needs to browse
-- by category — a URL, an order to show them in, and words for the page.
--
-- So this adds columns rather than a table, and deliberately does NOT change
-- how the ERP writes categories. The ERP's "add category" box posts a name and
-- nothing else; a trigger derives the slug, so that box keeps working untouched
-- and the owner never has to think about URLs.
-- ============================================================================

alter table categories
  add column if not exists slug      text,
  add column if not exists blurb     text,
  add column if not exists position  integer not null default 100,
  add column if not exists is_active boolean not null default true;

comment on column categories.slug is
  'URL segment, e.g. "waist-chains". Derived from name by categories_slugify() '
  'when not given, so the ERP can keep creating categories by name alone.';
comment on column categories.blurb is
  'One line under the category heading on its page. Optional.';
comment on column categories.position is
  'Display order, low first. Ties break alphabetically.';
comment on column categories.is_active is
  'Hidden from the storefront when false. Products keep their category.';

-- ─────────────────────────────────────────────────────────────── slugify ──
--
-- `unaccent` lives in an extension that may not be installed, and installing
-- one for five category names is not a trade worth making. This covers the
-- characters a Bangladeshi jewellery catalogue would realistically contain and
-- leaves everything else alone.
--
-- DEFINED FIRST, and the order is not cosmetic: a `language sql` function body
-- is parsed and resolved when the function is created, not when it is called,
-- so slugify() below fails with "function unaccent_fallback(text) does not
-- exist" if this comes after it. (plpgsql would defer the lookup to runtime
-- and hide the mistake until something called it.)
create or replace function unaccent_fallback(p text)
returns text
language sql
immutable
strict
as $$
  select translate(p,
    'àáâãäåèéêëìíîïòóôõöùúûüñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇ',
    'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC');
$$;

-- Unaccented, lowercase, non-alphanumerics collapsed to a single dash. Kept
-- deliberately simple: these are English category names typed by one person,
-- not arbitrary user input, and a clever implementation here would be a
-- second thing to debug.
--
-- IMMUTABLE and no table access, so it is safe in an index or a check.
create or replace function slugify(p text)
returns text
language sql
immutable
strict
as $$
  select trim(both '-' from
    regexp_replace(lower(unaccent_fallback(p)), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function categories_set_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := slugify(new.name);
  else
    new.slug := slugify(new.slug);
  end if;
  return new;
end $$;

drop trigger if exists categories_slug on categories;
create trigger categories_slug
  before insert or update of name, slug on categories
  for each row execute function categories_set_slug();

-- Backfill anything that predates the trigger, then make it required.
update categories set slug = slugify(name) where slug is null or trim(slug) = '';

alter table categories alter column slug set not null;

-- ──────────────────────────────────────────────────── slugs must be unique ──
--
-- Per org, matching the existing unique(org_id, name). Two categories that
-- slugify the same — "Finger rings" and "Finger Rings" — would otherwise both
-- resolve to /shop/finger-rings and the storefront would pick one at random.
create unique index if not exists categories_org_slug_key
  on categories (org_id, slug);

-- ──────────────────────────────────────── a category cannot shadow a product ──
--
-- The storefront resolves /shop/<slug> as a category first and a product
-- second (see apps/store/src/app/shop/[slug]/page.tsx). If a category slug
-- ever equalled a product slug, the product page would become unreachable
-- and nobody would find out from an error — the category page would just
-- render instead.
--
-- Product slugs are not in this database yet; they live in the storefront's
-- merchandising layer, keyed by SKU. So this guards the half that IS here:
-- the reserved words the storefront routes on. Adding a category called
-- "cart" would otherwise take /shop/cart.
alter table categories drop constraint if exists categories_slug_not_reserved;
alter table categories add constraint categories_slug_not_reserved
  check (slug not in (
    'cart', 'checkout', 'track', 'wishlist', 'contact', 'shipping',
    'about', 'policies', 'size-guide', 'order', 'api', 'search'
  ));

-- ─────────────────────────────────────────── the view the storefront reads ──
--
-- Re-emitted from the 0014 definition with two columns added: category_slug
-- (so the storefront can build a URL without slugifying in TypeScript and
-- risking a different answer from the database) and category_position (so one
-- query can order categories correctly).
--
-- security_invoker stays on: this view must keep obeying the caller's RLS, or
-- it becomes a hole straight through the policies that protect cost and margin.
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
  /*
   * APPENDED, not slotted in beside `category` where they belong logically.
   *
   * `create or replace view` may only ADD columns at the end of the select
   * list — it matches the existing columns positionally, so inserting these
   * after `supplier` made Postgres think on_hand was being renamed to
   * category_slug and refused: "cannot change name of view column".
   *
   * Putting them in their natural place would need a DROP and CREATE, which
   * would cascade to v_low_stock and every other view built on this one. Two
   * columns in an odd position is the cheaper price.
   */
  c.slug     as category_slug,
  c.position as category_position
from products p
left join product_stock   ps on ps.product_id = p.id
left join categories      c  on c.id = p.category_id
left join suppliers       s  on s.id = p.supplier_id
left join v_reserved_stock r  on r.product_id = p.id;

-- ────────────────────────────────────────── what the storefront may read ──
--
-- The storefront holds the service-role key and bypasses RLS, so this grant
-- is not what protects the table — but `anon` must never read the taxonomy
-- directly, and `authenticated` (the ERP) already can via its policies.
--
-- A storefront_categories VIEW rather than a grant on `categories`: it exposes
-- only the four columns a shop page needs and hides org_id, matching how
-- v_product_stock is the storefront's window onto products.
create or replace view storefront_categories with (security_invoker = on) as
select slug, name, blurb, position
from categories
where is_active
order by position, name;

comment on view storefront_categories is
  'The public taxonomy: active categories in display order. The storefront '
  'reads this; it never selects from `categories` directly.';

-- ───────────────────────────────────────────────────────────────── seed ──
--
-- The five Heristiq sells today. `on conflict (org_id, name) do update` rather
-- than `do nothing` so re-running this migration corrects an order or a blurb
-- that was edited by hand — but it deliberately does not touch `is_active`,
-- so hiding a category in the ERP is not undone by a redeploy.
insert into categories (name, blurb, position) values
  ('Waist chains',
   'The pieces Heristiq started with. Worn low, made to move.',
   10),
  ('Bracelets',
   'For the wrist, and for stacking with everything else.',
   20),
  ('Finger rings',
   'Single bands and stacked sets, in both finishes.',
   30),
  ('Earrings',
   'From everyday studs to something with more weight.',
   40),
  ('Pendants',
   'A chain and one thing worth looking at.',
   50)
on conflict (org_id, name) do update
  set blurb    = excluded.blurb,
      position = excluded.position;

-- ────────────────────────────────────── put the existing pieces somewhere ──
--
-- All seven current products are waist chains and every one has
-- category_id = null, so they would be invisible to category browsing on the
-- day it ships. Guarded on `is null` — this never overwrites a category the
-- owner has since chosen in the ERP.
update products p
   set category_id = c.id
  from categories c
 where c.name = 'Waist chains'
   and c.org_id = p.org_id
   and p.category_id is null
   and p.sku like 'WC-%';
