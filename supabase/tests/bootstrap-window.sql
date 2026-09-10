-- Proves migration 1007 closed the admin bootstrap window.
--
--   psql -d <db> -f supabase/tests/bootstrap-window.sql
--
-- IMPORTANT — this only means anything on a database that mimics Supabase's
-- default privileges. A bare Postgres grants `authenticated` nothing, so every
-- query fails on GRANTS and RLS is never exercised, which makes the system
-- look far stricter than it is. Set the scratch database up with:
--
--   grant usage on schema public to anon, authenticated, service_role;
--   alter default privileges in schema public
--     grant all on tables to anon, authenticated, service_role;
--
-- BEFORE running the migrations. In a real project Supabase has already done
-- this, and RLS is the only thing between a stranger and the books.
--
-- Expected: stranger_is_admin false, zero rows visible, rename blocked; then
-- the owner's single INSERT lets the owner in and nobody else.

\pset border 2
\set ON_ERROR_STOP on

insert into categories (name) select 'T'
where not exists (select 1 from categories where name = 'T');
insert into products (sku, name, category_id, selling_price, reorder_level)
select 'X-1', 'Victim', c.id, 100, 1 from categories c where c.name = 'T'
  and not exists (select 1 from products where sku = 'X-1');
delete from erp_admins where email = 'owner@heristiq.com';

\echo ''
\echo '=== erp_admins is EMPTY — a fresh project, before the owner acts ==='
select count(*) as admins from erp_admins;

\echo '=== a stranger who just registered a Supabase account ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"email":"stranger@gmail.com"}';
  select is_erp_admin() as stranger_is_admin,
         (select count(*) from products)  as products_visible,
         (select count(*) from suppliers) as suppliers_visible;
  do $$ begin
    update products set name = '</script><script>steal()</script>' where sku = 'X-1';
    if found then
      raise notice 'BAD — a stranger renamed a product; that is stored XSS on the public shop';
    else
      raise notice 'BLOCKED — RLS matched no rows';
    end if;
  exception when others then raise notice 'BLOCKED — %', sqlerrm; end $$;
rollback;

\echo '=== the owner runs the one documented INSERT ==='
insert into erp_admins (email, note) values ('owner@heristiq.com', 'Owner');
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"email":"owner@heristiq.com"}';
  select is_erp_admin() as owner_is_admin,
         (select count(*) from products) as products_visible;
rollback;

\echo '=== and the stranger is still out ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"email":"stranger@gmail.com"}';
  select is_erp_admin() as stranger_is_admin,
         (select count(*) from products) as products_visible;
rollback;
