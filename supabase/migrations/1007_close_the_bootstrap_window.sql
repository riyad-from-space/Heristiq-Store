-- Heristiq — close the admin bootstrap window.
--
-- THE HOLE
--
-- is_erp_admin() returned TRUE for every authenticated user while the
-- erp_admins table was empty. That was deliberate (1004 documents it) and the
-- reasoning was sound at the time: failing closed on an empty table would lock
-- the owner out of their own ERP with no way back through the UI.
--
-- The security audit re-weighed it and the trade no longer holds. Supabase
-- sign-ups are open by default, so during that window ANY stranger who
-- registered an account was a full administrator of the business's books:
-- they could read cost, margin and supplier data, post and void sales, adjust
-- stock, and — because RLS is what gates product writes — rename a product to
-- an XSS payload that then runs on the public shop.
--
-- The window is not a moment. It lasts from "migrations applied" until the
-- owner happens to sign in and press a button, which in practice can be days,
-- and the shop may already be live and indexed by then.
--
-- THE FIX, AND ITS ONE COST
--
-- Fail closed. is_erp_admin() is now strictly "is this email in erp_admins".
--
-- The lockout worry was overstated: the owner of a Supabase project always has
-- the SQL editor in their own dashboard. So the recovery path was never "no
-- way back" — it was "one query". That is a fair price for closing a window in
-- which a stranger owns your accounts.
--
-- The first admin is now created with:
--
--   insert into erp_admins (email, note)
--   values ('you@example.com', 'Owner');
--
-- run once in the Supabase SQL editor. The ERP's no-access screen shows this
-- exact query, so nobody has to remember it. Adding FURTHER admins is still
-- one click from the ERP's settings page, which is where that convenience
-- actually belongs — by then there is someone authorised to do the adding.
--
-- Nothing else changes: every policy and every RPC guard already calls this
-- function, so tightening it here tightens all of them at once.

create or replace function is_erp_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  /*
   * No empty-table special case. An ERP with no administrators is closed to
   * everyone, which is the correct state for a system whose administrator
   * list has not been decided yet.
   */
  begin
    v_email := lower(nullif(
      current_setting('request.jwt.claims', true)::json->>'email', ''));
  exception when others then
    -- No claims at all: not a PostgREST request, or an unauthenticated one.
    v_email := null;
  end;

  if v_email is null then
    return false;
  end if;

  return exists (select 1 from erp_admins where lower(email) = v_email);
end;
$$;

comment on function is_erp_admin() is
  'True only for an email listed in erp_admins. Fails CLOSED on an empty '
  'table — create the first admin with an INSERT from the Supabase SQL '
  'editor. See migration 1007 for why the previous bootstrap was removed.';
