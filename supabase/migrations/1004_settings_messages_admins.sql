-- Storefront settings, customer messages, subscribers — and ERP admin control.
--
-- Four things that were each "phase 6" and are each the difference between a
-- site that works and one that only demos.

-- ================================================================
-- 1. Settings the owner can change without a deploy
--
-- The delivery fee, the free-delivery threshold and the promo banner change
-- with every promotion. They were env vars, which means a deploy to change a
-- number, which means they do not get changed.
--
-- Key/value with a jsonb payload rather than a column per setting: adding a
-- setting should not be a migration, and the application validates the shape
-- it reads anyway (see apps/store/src/lib/settings.ts).
-- ================================================================

create table storefront_settings (
  key        text not null primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger storefront_settings_touch
  before update on storefront_settings
  for each row execute function touch_updated_at();

-- Seeded with the values the code used as env defaults, so applying this
-- migration changes nothing a customer sees.
insert into storefront_settings (key, value) values
  ('delivery', jsonb_build_object(
     'inside_dhaka_fee', 70,
     'outside_dhaka_fee', 130,
     'free_threshold', 1500,
     'inside_days_min', 1, 'inside_days_max', 2,
     'outside_days_min', 2, 'outside_days_max', 4
   )),
  ('promo', jsonb_build_object(
     'enabled', false,
     'message', '',
     'href', ''
   )),
  ('payment', jsonb_build_object(
     -- Phase 5: a small advance on COD reduces fake orders. Off by default,
     -- because it also reduces real ones and the owner should choose.
     'cod_deposit_enabled', false,
     'cod_deposit_amount', 100,
     'bkash_number', '',
     'nagad_number', ''
   ))
on conflict (key) do nothing;

-- ================================================================
-- 2. Messages from the contact form
--
-- A contact form that discards what someone typed is worse than no form. This
-- is where they land, and phase 6's admin lists them.
-- ================================================================

create table storefront_messages (
  id      uuid not null primary key default gen_random_uuid(),
  name    text not null check (length(trim(name)) > 0),
  -- One of the two is required; the check below enforces it.
  email   text,
  phone   text,
  subject text,
  message text not null check (length(trim(message)) > 0),

  -- Which order they are writing about, if they said. Free text: they may
  -- mistype it, and refusing the message over that would be absurd.
  order_reference text,

  handled_at timestamptz,
  created_at timestamptz not null default now(),

  constraint storefront_messages_reachable
    check (nullif(trim(coalesce(email, '')), '') is not null
        or nullif(trim(coalesce(phone, '')), '') is not null)
);

create index storefront_messages_created_idx
  on storefront_messages(created_at desc);
create index storefront_messages_unhandled_idx
  on storefront_messages(created_at desc) where handled_at is null;

-- ================================================================
-- 3. Newsletter subscribers
--
-- Same reasoning: the footer form validated an address and then told the
-- customer it had been noted, which was not true.
-- ================================================================

create table storefront_subscribers (
  email        text not null primary key,
  source       text not null default 'footer',
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ================================================================
-- 4. Who may use the ERP
--
-- THE SECURITY FIX IN THIS MIGRATION. Until now every ERP table was readable
-- and writable by any `authenticated` user:
--
--   create policy ... on public.<table> for all to authenticated using (true)
--
-- If Supabase sign-ups are open — they are by default — then anyone who
-- registered got the `authenticated` role and, with it, the anon key plus
-- their own JWT would read products, costs, suppliers, sales and margins.
-- The ERP's login screen was never the boundary; the policies were, and they
-- were open.
--
-- Now membership of this table is the boundary.
--
-- Keyed on email rather than auth.users(id) deliberately: no foreign key into
-- the auth schema, so this migration applies to a plain Postgres for testing,
-- and an admin can be authorised before their first sign-in.
-- ================================================================

create table erp_admins (
  email    text not null primary key,
  note     text,
  added_at timestamptz not null default now()
);

/*
 * Is the caller an ERP admin?
 *
 * Reads the email out of the request's JWT claims, which is what PostgREST
 * sets per request — plain Postgres, no dependency on the auth schema.
 *
 * BOOTSTRAP: an EMPTY erp_admins table allows any authenticated user, exactly
 * as before this migration. That is deliberate and it is the lesser evil —
 * failing closed on an empty table would lock the owner out of their own ERP
 * the moment they applied this, with no way back in through the UI. The ERP
 * shows an unmissable warning while the table is empty and offers a one-click
 * "claim admin access" that fills it, after which this function is strict.
 * Nothing here is a substitute for turning off public sign-ups.
 */
create or replace function is_erp_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_count integer;
begin
  select count(*) into v_count from erp_admins;
  if v_count = 0 then
    return true;
  end if;

  begin
    v_email := lower(nullif(
      current_setting('request.jwt.claims', true)::json->>'email', ''));
  exception when others then
    v_email := null;
  end;

  if v_email is null then return false; end if;
  return exists (select 1 from erp_admins where lower(email) = v_email);
end;
$$;

-- Replace every ERP table policy with one that requires admin membership.
-- Same table list as 0001, plus what later migrations added.
do $$
declare t text;
begin
  foreach t in array array[
    'categories', 'suppliers', 'products', 'product_stock',
    'purchases', 'purchase_items', 'sales', 'sale_items', 'stock_movements',
    'pre_orders', 'pre_order_items', 'cost_revaluations'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;

    execute format('drop policy if exists %I on public.%I', t || '_authenticated_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (is_erp_admin()) with check (is_erp_admin())',
      t || '_admin_all', t
    );
  end loop;
end $$;

-- The storefront's own tables, for the same reason: an ERP-side reader of
-- orders and shipments must be an admin, not merely signed in.
do $$
declare t text;
begin
  foreach t in array array[
    'storefront_orders', 'storefront_order_items', 'storefront_order_events',
    'storefront_shipments', 'storefront_courier_zones'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (is_erp_admin()) with check (is_erp_admin())',
      t || '_admin_all', t
    );
  end loop;
end $$;

-- New tables: settings readable by an admin, messages and subscribers too.
alter table storefront_settings    enable row level security;
alter table storefront_messages    enable row level security;
alter table storefront_subscribers enable row level security;
alter table erp_admins             enable row level security;

create policy storefront_settings_admin_all on storefront_settings
  for all to authenticated using (is_erp_admin()) with check (is_erp_admin());
create policy storefront_messages_admin_all on storefront_messages
  for all to authenticated using (is_erp_admin()) with check (is_erp_admin());
create policy storefront_subscribers_admin_all on storefront_subscribers
  for all to authenticated using (is_erp_admin()) with check (is_erp_admin());

/*
 * erp_admins itself: an admin may read and add admins, and while the table is
 * empty any authenticated user may — which is what makes the one-click
 * bootstrap possible. Once it has a row, only a listed admin can change it, so
 * the bootstrap cannot be used twice by someone else.
 */
create policy erp_admins_admin_all on erp_admins
  for all to authenticated using (is_erp_admin()) with check (is_erp_admin());

revoke all on storefront_settings    from anon;
revoke all on storefront_messages    from anon;
revoke all on storefront_subscribers from anon;
revoke all on erp_admins             from anon;

grant select, insert, update, delete on storefront_settings    to authenticated;
grant select, insert, update, delete on storefront_messages    to authenticated;
grant select, insert, update, delete on storefront_subscribers to authenticated;
grant select, insert, update, delete on erp_admins             to authenticated;

grant select, insert, update, delete on storefront_settings    to service_role;
grant select, insert, update, delete on storefront_messages    to service_role;
grant select, insert, update, delete on storefront_subscribers to service_role;
grant select, insert, update, delete on erp_admins             to service_role;

revoke all on function is_erp_admin() from public;
grant execute on function is_erp_admin() to authenticated;
grant execute on function is_erp_admin() to service_role;
