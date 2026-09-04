-- Heristiq storefront — shipments, courier webhooks, and risk notes.
--
-- What the storefront learns from a courier, and nothing about stock. A
-- delivered shipment is the trigger for an ERP sale (post_sale(), phase 6's
-- admin), not a stock movement in itself.

-- ---------------------------------------------------------------- status
--
-- The normalised vocabulary from src/lib/courier/status.ts, as an enum so the
-- database rejects a status no provider could have produced. It has to be kept
-- in step with that file by hand; there are eleven values and they change
-- roughly never, which is a better trade than a text column that accepts
-- "deliverd".
--
-- The brief's chain is pickup_scheduled → picked_up → in_transit →
-- out_for_delivery → delivered → cod_collected, with returned / lost off to
-- the side. Three more are here because couriers genuinely report them:
-- on_hold (the rider is holding the parcel — the moment a phone call saves the
-- sale), cancelled, and unknown (a string we did not recognise, which must
-- stay visible rather than be mapped to something plausible).
create type courier_status as enum (
  'pickup_scheduled',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'cod_collected',
  'on_hold',
  'returned',
  'lost',
  'cancelled',
  'unknown'
);

-- ---------------------------------------------------------------- shipments

-- A table rather than columns on storefront_orders, because an order can be
-- shipped more than once: a returned parcel gets re-sent, and that second
-- consignment has its own id, its own status and its own delivery charge. The
-- current shipment is the newest row.
create table storefront_shipments (
  id       uuid not null primary key default gen_random_uuid(),
  order_id uuid not null references storefront_orders(id) on delete cascade,

  courier storefront_courier not null,

  -- The courier's own identifiers. Nullable because not every provider
  -- returns both — RedX gives a tracking id and no separate consignment id.
  consignment_id text,
  tracking_code  text,

  status     courier_status not null default 'pickup_scheduled',
  -- The courier's own string, verbatim. When `status` is 'unknown' this is the
  -- only thing that says what actually arrived, and it is what a support
  -- conversation with the courier is conducted in.
  raw_status text,

  -- What we asked them to collect, so a mismatch with the order total is
  -- visible after the fact. 0 = 1 home delivery, 1 = hub pickup.
  cod_amount    numeric(12,2) not null default 0 check (cod_amount >= 0),
  delivery_type smallint not null default 0 check (delivery_type in (0, 1)),

  -- What the courier billed us, once known. Distinct from the order's
  -- delivery_fee, which is what the CUSTOMER paid — the difference is margin
  -- and it belongs in the ERP's reporting, not on a customer's page.
  courier_fee numeric(12,2),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Last time we asked the courier, as opposed to last time they told us.
  last_synced_at timestamptz,
  delivered_at   timestamptz,

  -- One row per consignment per courier. This is the constraint that makes the
  -- webhook idempotent at the table level: two deliveries of the same event
  -- cannot become two shipments.
  constraint storefront_shipments_courier_consignment_key
    unique nulls not distinct (courier, consignment_id)
);

create index storefront_shipments_order_idx    on storefront_shipments(order_id, created_at desc);
create index storefront_shipments_tracking_idx on storefront_shipments(tracking_code);
create index storefront_shipments_status_idx   on storefront_shipments(status);

create trigger storefront_shipments_touch
  before update on storefront_shipments
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------- webhooks

-- Every courier callback, stored before it is acted on.
--
-- Two reasons this is a table and not a log line. First, idempotency:
-- couriers retry, and `event_key` is unique, so a replayed event is a no-op
-- instead of a second status change. Second, a courier's webhook is the only
-- record of when they said what — when a customer insists nobody called and
-- the courier insists otherwise, this is the evidence.
create table storefront_courier_webhooks (
  id      uuid not null primary key default gen_random_uuid(),
  courier storefront_courier not null,

  -- Whatever makes this delivery unique: consignment id + status + their
  -- timestamp. Built by the caller, because only the caller knows the shape of
  -- the payload it received.
  event_key text not null,

  payload     jsonb not null,
  received_at timestamptz not null default now(),

  -- Whether it changed anything, and if not, why. A rejected webhook that
  -- vanished is the hardest kind of bug to find later.
  applied boolean not null default false,
  note    text,

  constraint storefront_courier_webhooks_event_key unique (courier, event_key)
);

create index storefront_courier_webhooks_received_idx
  on storefront_courier_webhooks(received_at desc);

-- ---------------------------------------------------------------- risk notes

-- The recipient's delivery history, as a courier sees it, cached against the
-- phone number rather than the order — it is a fact about the number, and the
-- same number ordering twice should not cost two lookups.
--
-- Advisory. Nothing in this schema or the application refuses an order because
-- of it; it annotates one for the owner. A customer with two cancelled parcels
-- two years ago is not a fraudster, and a storefront that silently rejects
-- them never finds out why it lost them.
create table storefront_phone_risk (
  phone         text not null check (phone ~ '^01[3-9][0-9]{8}$'),
  courier       storefront_courier not null,
  total_parcels integer not null default 0 check (total_parcels >= 0),
  delivered     integer not null default 0 check (delivered     >= 0),
  cancelled     integer not null default 0 check (cancelled     >= 0),
  success_ratio numeric(5,2),
  checked_at    timestamptz not null default now(),

  primary key (phone, courier)
);

-- ================================================================
-- Progress order, for rejecting stale updates
--
-- Couriers retry webhooks, and retries arrive out of order. Without this, a
-- redelivered `in_transit` landing after `delivered` would tell a customer
-- holding the parcel that it is still on its way.
--
-- Only the happy path is ranked. The exception states deliberately rank 0 and
-- are always applied: on_hold, returned, lost and cancelled can genuinely
-- happen at any point, they are what the owner most needs to see, and refusing
-- one because it looked out of order would hide the only events worth acting
-- on.
-- ================================================================

create or replace function courier_status_rank(s courier_status)
returns integer
language sql
immutable
as $$
  select case s
    when 'pickup_scheduled' then 1
    when 'picked_up'        then 2
    when 'in_transit'       then 3
    when 'out_for_delivery' then 4
    when 'delivered'        then 5
    when 'cod_collected'    then 6
    else 0
  end;
$$;

-- ================================================================
-- Applying a courier status
--
-- One function, for the same reason placing an order is one function: a status
-- change touches three tables and half of it landing is worse than none of it.
-- It is also the only place that decides an order's lifecycle status from a
-- courier's, which keeps that mapping in one readable list instead of spread
-- across a route handler and a cron job.
--
-- Idempotent on (courier, event_key): a courier retrying a webhook, or two
-- Workers handling the same delivery, changes nothing the second time.
-- ================================================================

create or replace function apply_courier_status(p jsonb)
returns table (
  shipment_id uuid,
  order_reference text,
  previous_status courier_status,
  new_status courier_status,
  duplicate boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_courier   storefront_courier := (p->>'courier')::storefront_courier;
  v_status    courier_status     := (p->>'status')::courier_status;
  v_event_key text               := p->>'event_key';
  v_shipment  storefront_shipments;
  v_order     storefront_orders;
  v_previous  courier_status;
  v_order_status storefront_order_status;
begin
  -- Log first, and let the unique constraint answer "have I seen this?".
  -- Checking then inserting would leave a race between two concurrent
  -- deliveries of the same event.
  if v_event_key is not null then
    begin
      insert into storefront_courier_webhooks (courier, event_key, payload)
      values (v_courier, v_event_key, p);
    exception when unique_violation then
      return query select null::uuid, null::text, null::courier_status, v_status, true;
      return;
    end;
  end if;

  select * into v_shipment
    from storefront_shipments
   where courier = v_courier
     and (
       (p->>'consignment_id' is not null and consignment_id = p->>'consignment_id')
       or (p->>'tracking_code' is not null and tracking_code = p->>'tracking_code')
     )
   order by created_at desc
   limit 1;

  -- No shipment for that consignment: fall back to our own reference, which
  -- couriers echo back as the invoice. This is how a webhook that arrives
  -- before our create_order response was persisted still lands.
  if not found and p->>'reference' is not null then
    select s.* into v_shipment
      from storefront_shipments s
      join storefront_orders o on o.id = s.order_id
     where s.courier = v_courier
       and o.reference = p->>'reference'
     order by s.created_at desc
     limit 1;
  end if;

  if not found then
    update storefront_courier_webhooks
       set note = 'no matching shipment'
     where courier = v_courier and event_key = v_event_key;
    return query select null::uuid, null::text, null::courier_status, v_status, false;
    return;
  end if;

  v_previous := v_shipment.status;

  -- A retry that arrived out of order, or a status this codebase does not
  -- recognise landing on top of one it does. Either way the shipment keeps
  -- what it has: the raw string is still worth recording, but the customer's
  -- status must not go backwards.
  if (
    courier_status_rank(v_status) > 0
    and courier_status_rank(v_previous) > courier_status_rank(v_status)
  ) or (
    v_status = 'unknown' and v_previous <> 'unknown'
  ) then
    update storefront_shipments
       set raw_status = coalesce(p->>'raw_status', raw_status),
           last_synced_at = now()
     where id = v_shipment.id;

    if v_event_key is not null then
      update storefront_courier_webhooks
         set note = format('stale: %s after %s, ignored', v_status, v_previous)
       where courier = v_courier and event_key = v_event_key;
    end if;

    return query
      select v_shipment.id,
             (select reference from storefront_orders where id = v_shipment.order_id),
             v_previous, v_previous, false;
    return;
  end if;

  update storefront_shipments
     set status       = v_status,
         raw_status   = coalesce(p->>'raw_status', raw_status),
         last_synced_at = now(),
         delivered_at = case
           when v_status in ('delivered', 'cod_collected')
             then coalesce(delivered_at, now())
           else delivered_at
         end
   where id = v_shipment.id;

  select * into v_order from storefront_orders where id = v_shipment.order_id;

  -- The courier's status decides the order's, for the states where it should.
  -- 'confirmed' and 'packed' are the owner's business and are never set from
  -- here; everything after the parcel leaves the house is the courier's.
  v_order_status := case v_status
    when 'pickup_scheduled'  then 'handed_to_courier'
    when 'picked_up'         then 'handed_to_courier'
    when 'in_transit'        then 'handed_to_courier'
    when 'out_for_delivery'  then 'handed_to_courier'
    when 'delivered'         then 'delivered'
    when 'cod_collected'     then 'delivered'
    when 'returned'          then 'returned'
    when 'lost'              then 'returned'
    when 'cancelled'         then 'cancelled'
    else v_order.status
  end;

  if v_order_status is distinct from v_order.status then
    update storefront_orders set status = v_order_status where id = v_order.id;
  end if;

  insert into storefront_order_events (order_id, kind, detail)
  values (
    v_order.id,
    'courier_status',
    jsonb_build_object(
      'courier', v_courier,
      'from', v_previous,
      'to', v_status,
      'raw_status', p->>'raw_status',
      'source', coalesce(p->>'source', 'webhook')
    )
  );

  if v_event_key is not null then
    update storefront_courier_webhooks
       set applied = true
     where courier = v_courier and event_key = v_event_key;
  end if;

  return query
    select v_shipment.id, v_order.reference, v_previous, v_status, false;
end;
$$;

-- ================================================================
-- Grants
--
-- Same posture as 1001: service_role does the work, the ERP's signed-in user
-- can read, anon gets nothing anywhere. Webhook payloads and risk notes are
-- not readable by `authenticated` either — a phone number's fraud history is
-- not something the ERP UI has any reason to show.
-- ================================================================

alter table storefront_shipments         enable row level security;
alter table storefront_courier_webhooks  enable row level security;
alter table storefront_phone_risk        enable row level security;

create policy storefront_shipments_authenticated_all on storefront_shipments
  for all to authenticated using (true) with check (true);

revoke all on storefront_shipments        from anon;
revoke all on storefront_courier_webhooks from anon;
revoke all on storefront_courier_webhooks from authenticated;
revoke all on storefront_phone_risk       from anon;
revoke all on storefront_phone_risk       from authenticated;

grant select, insert, update, delete on storefront_shipments to authenticated;

grant select, insert, update, delete on storefront_shipments        to service_role;
grant select, insert, update, delete on storefront_courier_webhooks to service_role;
grant select, insert, update, delete on storefront_phone_risk       to service_role;

-- Revoke before grant: Postgres grants EXECUTE on a new function to PUBLIC,
-- so the other order would revoke what was just granted.
revoke all on function apply_courier_status(jsonb) from public;
revoke all on function apply_courier_status(jsonb) from anon;
revoke all on function apply_courier_status(jsonb) from authenticated;
grant execute on function apply_courier_status(jsonb) to service_role;
