-- Heristiq storefront — courier location mapping.
--
-- Pathao does not take an address. It takes a city id, a zone id and an area
-- id from its own taxonomy, and the storefront collects a Bangladeshi
-- division/district/area (see src/lib/bd-geo.ts) because that is what a
-- customer knows and what every courier can be mapped from.
--
-- Something has to bridge those, and name matching alone is not good enough to
-- trust silently: districts were officially renamed (Jashore/Jessore,
-- Bogura/Bogra, Chattogram/Chittagong, Cumilla/Comilla) and couriers adopted
-- the new spellings at their own pace, while zone names are local usage that
-- nobody standardised at all.
--
-- So a match is CACHED here, with where it came from. 'matched' is a name
-- match this codebase made; 'manual' is one a human corrected. A manual row
-- always wins and is never overwritten by matching — which means a wrong zone
-- is fixed with one UPDATE, by the owner, without a deploy.

create table storefront_courier_zones (
  courier storefront_courier not null,

  -- Our side of the mapping, as slugs from lib/bd-geo.ts. The area is free
  -- text a customer typed, lowercased; '' means "the district's default zone",
  -- used when they left the area blank.
  district text not null,
  area     text not null default '',

  -- The courier's side.
  city_id integer not null,
  zone_id integer not null,
  area_id integer,

  -- What the courier calls them, kept so a human reviewing a mapping can see
  -- what was matched without calling the courier's API.
  city_name text,
  zone_name text,
  area_name text,

  source     text not null default 'matched' check (source in ('matched', 'manual')),
  updated_at timestamptz not null default now(),

  primary key (courier, district, area)
);

create index storefront_courier_zones_source_idx
  on storefront_courier_zones(courier, source);

create trigger storefront_courier_zones_touch
  before update on storefront_courier_zones
  for each row execute function touch_updated_at();

-- What was actually sent to the courier for this parcel: the ids, the names
-- they resolved to, and whether a human or a name match chose them.
--
-- On the shipment rather than looked up through the mapping table, because the
-- mapping can be corrected later and this has to stay the record of what the
-- courier was told at the time. When a parcel goes to the wrong thana, this is
-- the column that says why.
alter table storefront_shipments
  add column courier_location jsonb;

-- ================================================================
-- Grants — same posture as 1001 and 1002.
-- ================================================================

alter table storefront_courier_zones enable row level security;

-- The owner needs to read and correct these from the ERP app, so unlike the
-- webhook log this one is readable by a signed-in user.
create policy storefront_courier_zones_authenticated_all on storefront_courier_zones
  for all to authenticated using (true) with check (true);

revoke all on storefront_courier_zones from anon;
grant select, insert, update, delete on storefront_courier_zones to authenticated;
grant select, insert, update, delete on storefront_courier_zones to service_role;
