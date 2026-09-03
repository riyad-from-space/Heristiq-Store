-- Heristiq storefront — orders, order events and phone OTP.
--
-- Numbered from 1001 on purpose. The ERP owns 0001-0999 in this same database
-- and applies them from a different repo; interleaving the two numberings would
-- make the applied order depend on which repo ran `db push` last.
--
-- What these tables are NOT: a second inventory. Nothing here writes
-- stock_movements. A storefront order is a customer's request. It becomes an
-- ERP `sale` — and therefore a stock movement, via post_sale() — only once it
-- is delivered and the cash is collected. Until then the ERP's `reserved`
-- count is what stops the drawer being sold twice.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums
--
-- Declared with every state phases 4 and 5 will need, not only the two phase 3
-- uses. Adding a value to an enum cannot share a transaction with the DDL that
-- depends on it, so a later migration would be an awkward two-step for no gain.

create type storefront_order_status as enum (
  'placed',              -- customer pressed the button; nothing has moved
  'confirmed',           -- owner accepted it (phone verified, risk checked)
  'packed',
  'handed_to_courier',
  'delivered',
  'cancelled',
  'returned'
);

create type storefront_payment_method as enum (
  'cod',
  'manual_bkash',        -- phase 5: customer sends money, enters a trxID
  'manual_nagad',
  'gateway'              -- phase 6+: SSLCommerz / ShurjoPay / aamarPay
);

create type storefront_payment_state as enum (
  'due_on_delivery',
  'advance_pending_verification',
  'advance_verified',
  'paid',
  'refunded'
);

-- A courier the customer asked for. The column is nullable, and null means
-- "no preference" — which is most orders, and is not a courier.
create type storefront_courier as enum ('steadfast', 'pathao', 'redx', 'self');

-- ---------------------------------------------------------------- orders

-- Sequential and human. This number gets read out over the phone and written on
-- a parcel, so it is short and has no random characters to mishear.
create sequence storefront_order_ref_seq as bigint start 1001;

create table storefront_orders (
  id      uuid not null primary key default gen_random_uuid(),
  org_id  uuid not null default '00000000-0000-0000-0000-000000000001',

  -- Gaps are expected and fine. A rolled-back insert still consumes the
  -- sequence, so a rejected order burns a number. This is a reference someone
  -- reads over the phone, not a tax invoice, and making it gapless would mean
  -- serialising every order behind a lock.
  reference text not null unique
    default 'HQ-' || lpad(nextval('storefront_order_ref_seq')::text, 5, '0'),

  -- What goes in the confirmation URL, and nothing else.
  --
  -- The reference above is sequential, so a URL built from it would let anyone
  -- walk HQ-01001..HQ-01100 and read every customer's name, phone and home
  -- address. This token is unguessable and carries no meaning.
  public_token text not null unique default encode(gen_random_bytes(16), 'hex'),

  status storefront_order_status not null default 'placed',

  customer_name  text not null check (length(trim(customer_name)) > 0),
  -- Normalised to 01XXXXXXXXX before it gets here, because the ERP stores
  -- phones that way and a number saved two ways never matches on search.
  customer_phone text not null check (customer_phone ~ '^01[3-9][0-9]{8}$'),
  -- Null means the OTP was never completed, which for a COD order is a
  -- deliberate signal to the owner, not a missing field.
  phone_verified_at timestamptz,

  -- The courier reads address_line. division/district/area are what produce a
  -- delivery fee now and a courier zone id in phase 4.
  division     text not null,
  district     text not null,
  area         text,
  address_line text not null check (length(trim(address_line)) > 0),
  landmark     text,

  courier_preference storefront_courier,
  payment_method     storefront_payment_method not null default 'cod',
  payment_state      storefront_payment_state  not null default 'due_on_delivery',

  subtotal     numeric(12,2) not null check (subtotal     >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  discount     numeric(12,2) not null default 0 check (discount     >= 0),
  total        numeric(12,2) not null check (total        >= 0),
  amount_paid  numeric(12,2) not null default 0 check (amount_paid  >= 0),

  has_pre_order boolean not null default false,
  customer_note text,
  -- Written by phase 4's courier history check. Never by the customer.
  risk_note     text,

  -- Set when this order has been posted as an ERP sale. Nothing in this schema
  -- moves stock; this column is how we know post_sale() already ran, so it
  -- cannot run twice.
  erp_sale_id uuid references sales(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The arithmetic is checked in the database as well as the server, because
  -- the server is where a refactor can quietly stop adding the delivery fee.
  constraint storefront_orders_total_adds_up
    check (total = subtotal + delivery_fee - discount),
  constraint storefront_orders_paid_within_total
    check (amount_paid <= total)
);

create index storefront_orders_phone_idx   on storefront_orders(customer_phone);
create index storefront_orders_created_idx on storefront_orders(created_at desc);
create index storefront_orders_status_idx  on storefront_orders(status);

create trigger storefront_orders_touch
  before update on storefront_orders
  for each row execute function touch_updated_at();

create table storefront_order_items (
  id       uuid not null primary key default gen_random_uuid(),
  order_id uuid not null references storefront_orders(id) on delete cascade,
  -- restrict, not cascade: a product that has been ordered cannot be deleted
  -- out from under the order history.
  product_id uuid not null references products(id) on delete restrict,

  -- Snapshots, not joins. A piece renamed or re-priced next month must not
  -- rewrite what this customer ordered and agreed to pay for it.
  sku        text not null,
  name       text not null,
  qty        integer not null check (qty > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),

  is_pre_order boolean not null default false
);

create index storefront_order_items_order_idx   on storefront_order_items(order_id);
create index storefront_order_items_product_idx on storefront_order_items(product_id);

-- Append-only audit trail: placed, otp verified, pushed to courier, status
-- changed, advance verified. When a customer says "I never got a call", this is
-- the only thing that can answer.
create table storefront_order_events (
  id       uuid not null primary key default gen_random_uuid(),
  order_id uuid not null references storefront_orders(id) on delete cascade,
  at       timestamptz not null default now(),
  kind     text not null,
  detail   jsonb not null default '{}'::jsonb
);

create index storefront_order_events_order_idx
  on storefront_order_events(order_id, at desc);

-- ---------------------------------------------------------------- phone OTP

create table storefront_phone_otp (
  id    uuid not null primary key default gen_random_uuid(),
  phone text not null check (phone ~ '^01[3-9][0-9]{8}$'),

  -- HMAC-SHA256(code, server secret) — never the code itself.
  --
  -- A bare sha256 of six digits is a million-row rainbow table anyone can
  -- build in a second. The secret lives only in the server's environment, so a
  -- leaked copy of this table verifies nothing.
  code_hash text not null,

  purpose text not null default 'order',
  channel text not null default 'sms',

  expires_at timestamptz not null,
  attempts   integer not null default 0 check (attempts >= 0),
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

-- Both hot paths are "the newest code for this phone" and "how many have I
-- sent this phone lately", which is the same index.
create index storefront_phone_otp_lookup_idx
  on storefront_phone_otp(phone, created_at desc);

-- ================================================================
-- Row Level Security
--
-- The storefront reaches these tables with the service-role key, which bypasses
-- RLS entirely, so these policies exist for the OTHER reader: the owner signed
-- into the ERP app as `authenticated`, who needs to see storefront orders next
-- to the sales they become.
--
-- `anon` gets nothing anywhere, and the OTP table gets no policy at all — a
-- signed-in user has no business reading code hashes either.
-- ================================================================

alter table storefront_orders       enable row level security;
alter table storefront_order_items  enable row level security;
alter table storefront_order_events enable row level security;
alter table storefront_phone_otp    enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'storefront_orders', 'storefront_order_items', 'storefront_order_events'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
  end loop;
end $$;

-- Supabase's default privileges hand `anon` table grants in the public schema,
-- so a new table is reachable by the anon key unless this says otherwise. RLS
-- above already denies it; this makes the denial two locks instead of one.
revoke all on storefront_orders       from anon;
revoke all on storefront_order_items  from anon;
revoke all on storefront_order_events from anon;
revoke all on storefront_phone_otp    from anon;
revoke all on storefront_phone_otp    from authenticated;
revoke all on sequence storefront_order_ref_seq from anon;

-- And granted explicitly rather than inherited from those same project-level
-- default privileges. The policies above are useless without the grant, and a
-- migration that only works because of how one Supabase project happens to be
-- configured is a migration that breaks on the next one.
grant select, insert, update, delete on storefront_orders       to authenticated;
grant select, insert, update, delete on storefront_order_items  to authenticated;
grant select, insert, update, delete on storefront_order_events to authenticated;

-- The storefront itself. Spelled out for the same reason: this is the role the
-- site actually connects as, and "it worked because the project had the right
-- default privileges" is not something to discover in production.
grant select, insert, update, delete on storefront_orders       to service_role;
grant select, insert, update, delete on storefront_order_items  to service_role;
grant select, insert, update, delete on storefront_order_events to service_role;
grant select, insert, update, delete on storefront_phone_otp    to service_role;
grant usage on sequence storefront_order_ref_seq to service_role;

-- ================================================================
-- Placing an order
--
-- One function rather than three inserts from the application, because an
-- order row with no items is a real failure mode — the second call fails, or
-- the Worker is evicted between them — and it is unrecoverable: the customer
-- has a confirmation page and the owner has a row with nothing to pack.
-- supabase-js cannot open a transaction, so the transaction lives here.
--
-- The payload is trusted: this is only reachable by the service role, and the
-- server has already re-priced every line against the ERP. What this function
-- adds is atomicity and the audit event, not validation — the table's own
-- CHECK constraints do that, including that the total actually adds up.
-- ================================================================

create or replace function place_storefront_order(p jsonb)
returns table (id uuid, reference text, public_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order storefront_orders;
  v_line  jsonb;
begin
  insert into storefront_orders (
    customer_name, customer_phone, phone_verified_at,
    division, district, area, address_line, landmark,
    courier_preference, payment_method, payment_state,
    subtotal, delivery_fee, discount, total, amount_paid,
    has_pre_order, customer_note
  ) values (
    p->>'customer_name',
    p->>'customer_phone',
    (p->>'phone_verified_at')::timestamptz,
    p->>'division',
    p->>'district',
    nullif(p->>'area', ''),
    p->>'address_line',
    nullif(p->>'landmark', ''),
    nullif(p->>'courier_preference', '')::storefront_courier,
    coalesce(nullif(p->>'payment_method', ''), 'cod')::storefront_payment_method,
    coalesce(nullif(p->>'payment_state', ''), 'due_on_delivery')::storefront_payment_state,
    (p->>'subtotal')::numeric,
    (p->>'delivery_fee')::numeric,
    coalesce((p->>'discount')::numeric, 0),
    (p->>'total')::numeric,
    coalesce((p->>'amount_paid')::numeric, 0),
    coalesce((p->>'has_pre_order')::boolean, false),
    nullif(p->>'customer_note', '')
  )
  returning * into v_order;

  for v_line in select value from jsonb_array_elements(p->'lines') loop
    insert into storefront_order_items (
      order_id, product_id, sku, name, qty, unit_price, is_pre_order
    ) values (
      v_order.id,
      (v_line->>'product_id')::uuid,
      v_line->>'sku',
      v_line->>'name',
      (v_line->>'qty')::integer,
      (v_line->>'unit_price')::numeric,
      coalesce((v_line->>'is_pre_order')::boolean, false)
    );
  end loop;

  -- An empty `lines` array would otherwise produce exactly the orphan row this
  -- function exists to prevent.
  if not exists (select 1 from storefront_order_items where order_id = v_order.id) then
    raise exception 'order % has no lines', v_order.reference;
  end if;

  insert into storefront_order_events (order_id, kind, detail)
  values (
    v_order.id,
    'placed',
    jsonb_build_object(
      'lines', jsonb_array_length(p->'lines'),
      'payment_method', v_order.payment_method,
      'phone_verified', v_order.phone_verified_at is not null,
      'courier_preference', v_order.courier_preference
    )
  );

  return query select v_order.id, v_order.reference, v_order.public_token;
end;
$$;

-- Only the service role. A signed-in ERP user places orders through the ERP's
-- own sale form, not through the storefront's.
--
-- Note the order: Postgres grants EXECUTE on a new function to PUBLIC, so the
-- revoke has to come first and the grant after it, or the grant is what gets
-- revoked. This is also why service_role is named explicitly — once PUBLIC is
-- gone, it holds nothing unless something says so.
revoke all on function place_storefront_order(jsonb) from public;
revoke all on function place_storefront_order(jsonb) from anon;
revoke all on function place_storefront_order(jsonb) from authenticated;
grant execute on function place_storefront_order(jsonb) to service_role;
