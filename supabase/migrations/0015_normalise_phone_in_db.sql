-- Normalise and validate the phone in the database, not only in the app.
--
-- save_pre_order only trimmed. The TypeScript action normalises before calling,
-- so the app path was fine — but a direct RPC call stored whatever it was given,
-- which means the same number could be saved two ways and never match on search.
-- The rule now lives in one place that every path goes through.

create or replace function normalise_bd_phone(raw text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  if raw is null then return null; end if;
  digits := regexp_replace(raw, '[\s\-()]', '', 'g');
  digits := regexp_replace(digits, '^\+?880', '0');
  if digits ~ '^01[3-9][0-9]{8}$' then
    return digits;
  end if;
  return null;
end;
$$;

create or replace function save_pre_order(
  p_id               uuid,
  p_customer_name    text,
  p_customer_phone   text,
  p_customer_address text,
  p_amount_paid      numeric,
  p_order_date       date,
  p_expected_date    date,
  p_status           pre_order_status,
  p_note             text,
  p_lines            jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid := p_id;
  total  numeric(12,2);
  phone  text;
begin
  if nullif(trim(coalesce(p_customer_name,'')), '') is null then
    raise exception 'customer name is required';
  end if;

  phone := normalise_bd_phone(p_customer_phone);
  if phone is null then
    raise exception
      'enter a valid mobile number — 11 digits starting 01, e.g. 01712345678 (got %)',
      coalesce(p_customer_phone, '(blank)');
  end if;

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'add at least one item';
  end if;
  if coalesce(p_amount_paid, 0) < 0 then
    raise exception 'amount paid cannot be negative';
  end if;

  if target is null then
    insert into pre_orders (
      customer_name, customer_phone, customer_address,
      amount_paid, order_date, expected_date, status, note
    ) values (
      trim(p_customer_name), phone, nullif(trim(coalesce(p_customer_address,'')), ''),
      0, coalesce(p_order_date, current_date), p_expected_date,
      coalesce(p_status, 'pending'), nullif(trim(coalesce(p_note,'')), '')
    )
    returning id into target;
  else
    if exists (select 1 from pre_orders where id = target and converted_sale_id is not null) then
      raise exception 'this pre-order was already delivered, so it can no longer be changed';
    end if;

    update pre_orders set
      customer_name    = trim(p_customer_name),
      customer_phone   = phone,
      customer_address = nullif(trim(coalesce(p_customer_address,'')), ''),
      order_date       = coalesce(p_order_date, order_date),
      expected_date    = p_expected_date,
      status           = coalesce(p_status, status),
      note             = nullif(trim(coalesce(p_note,'')), '')
    where id = target;

    if not found then raise exception 'pre-order % not found', target; end if;
  end if;

  delete from pre_order_items where pre_order_id = target;

  insert into pre_order_items (pre_order_id, product_id, item_note, qty, unit_price)
  select target,
         nullif(l->>'product_id','')::uuid,
         nullif(trim(coalesce(l->>'item_note','')), ''),
         greatest(1, coalesce((l->>'qty')::int, 1)),
         greatest(0, coalesce((l->>'unit_price')::numeric, 0))
  from jsonb_array_elements(p_lines) l;

  select total_amount into total from pre_orders where id = target;
  update pre_orders
     set amount_paid = least(coalesce(p_amount_paid, 0), total)
   where id = target;

  return target;
end;
$$;

-- Tidy any number already stored in a non-canonical form.
update pre_orders
   set customer_phone = normalise_bd_phone(customer_phone)
 where normalise_bd_phone(customer_phone) is not null
   and normalise_bd_phone(customer_phone) <> customer_phone;

revoke execute on function normalise_bd_phone(text) from public, anon;
revoke execute on function save_pre_order(
  uuid, text, text, text, numeric, date, date, pre_order_status, text, jsonb) from public, anon;
grant  execute on function save_pre_order(
  uuid, text, text, text, numeric, date, date, pre_order_status, text, jsonb) to authenticated;
