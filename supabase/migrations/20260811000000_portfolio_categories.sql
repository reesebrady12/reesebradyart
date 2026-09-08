-- Add portfolio organization without changing artwork IDs, slugs, images, or orders.
alter table products add column if not exists category text;
alter table products add column if not exists purchasable boolean;
alter table products add column if not exists completion_date date;
alter table products add column if not exists completion_year smallint;
alter table products add column if not exists commissioned boolean not null default false;
alter table products add column if not exists collection_label text;
alter table products add column if not exists needs_category_review boolean not null default false;
alter table products add column if not exists legacy_medium text;

-- Preserve unfamiliar legacy medium text for review; normalize only confident matches.
update products set medium = 'oil' where lower(medium) like '%oil%';
update products set medium = 'colored_pencil'
  where lower(medium) like '%colored%pencil%' or lower(medium) like '%colour%pencil%';
update products set medium = 'graphite_pencil'
  where lower(medium) like '%graphite%' or lower(medium) = 'pencil';
update products set legacy_medium = medium, medium = null, needs_category_review = true
  where medium is not null and medium not in ('oil', 'colored_pencil', 'graphite_pencil');

update products set completion_year = year
  where completion_year is null and year between 1000 and 9999;
update products set completion_year = extract(year from completion_date)::smallint
  where completion_date is not null;

-- Explicit sold flags are safe to migrate. Published inventory is available only
-- where availability can be inferred; uncertain zero-inventory rows need review.
update products set category = 'sold', sold = true, inventory = 0
  where category is null and (sold = true or status = 'sold');
update products set category = 'available'
  where category is null and status = 'published' and sold = false
    and (inventory is null or inventory > 0);
update products set category = 'available', needs_category_review = true,
  status = case when status = 'published' then 'archived' else status end
  where category is null;

update products set purchasable =
  category = 'available' and status = 'published' and sold = false
  and (inventory is null or inventory > 0)
where purchasable is null;

alter table products alter column category set default 'available';
alter table products alter column category set not null;
alter table products alter column purchasable set default false;
alter table products alter column purchasable set not null;
alter table products alter column price_in_cents drop not null;

alter table products drop constraint if exists artwork_category_values;
alter table products add constraint artwork_category_values
  check (category in ('available', 'sold', 'project'));
alter table products drop constraint if exists completion_year_range;
alter table products add constraint completion_year_range
  check (completion_year is null or completion_year between 1000 and 9999);
alter table products drop constraint if exists category_business_rules;
alter table products add constraint category_business_rules check (
  (category = 'sold' and purchasable = false and sold = true and inventory = 0)
  or (category = 'project' and purchasable = false and sold = false)
  or (category = 'available' and sold = false)
);

create index if not exists products_portfolio_category_idx
  on products(category, status);
create index if not exists products_medium_idx on products(medium);
create index if not exists products_completion_idx
  on products(completion_year desc, completion_date desc, id);
create index if not exists products_public_portfolio_idx
  on products(status, category, completion_year desc, completion_date desc);

-- Checkout reservations enforce the portfolio rules in the database as well.
create or replace function reserve_originals(p_product_ids text[], p_token uuid, p_minutes integer default 1440)
returns void language plpgsql security definer set search_path = public as $$
declare v_product products%rowtype;
begin
  if array_length(p_product_ids, 1) is null then return; end if;
  for v_product in select * from products where id = any(p_product_ids) order by id for update loop
    if v_product.type <> 'original' or v_product.status <> 'published'
      or v_product.category <> 'available' or not v_product.purchasable
      or v_product.sold or v_product.inventory <> 1
      or (v_product.reserved_until is not null and v_product.reserved_until > now()) then
      raise exception 'Original is no longer available';
    end if;
  end loop;
  if (select count(*) from products where id = any(p_product_ids)) <> cardinality(p_product_ids) then
    raise exception 'Original is no longer available';
  end if;
  update products set reservation_token = p_token,
    reserved_until = now() + make_interval(mins => p_minutes)
  where id = any(p_product_ids);
end $$;
revoke all on function reserve_originals(text[], uuid, integer) from public, anon, authenticated;
grant execute on function reserve_originals(text[], uuid, integer) to service_role;

drop function if exists fulfill_paid_order(text, text, jsonb, jsonb, uuid);
create or replace function fulfill_paid_order(p_event_id text, p_event_type text, p_order jsonb, p_items jsonb, p_reservation_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_order_id uuid; v_item jsonb;
begin
  select id into v_order_id from orders where stripe_checkout_session_id = p_order->>'stripe_checkout_session_id';
  if v_order_id is not null then return v_order_id; end if;
  if exists(select 1 from processed_webhook_events where stripe_event_id = p_event_id) then raise exception 'Event already processed without order'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    if v_item->>'product_type' = 'original' then
      update products set sold = true, status = 'sold', category = 'sold', purchasable = false,
        inventory = 0, reservation_token = null, reserved_until = null, updated_at = now()
      where id = v_item->>'product_id' and category = 'available' and purchasable = true
        and sold = false and inventory = 1
        and (reservation_token = p_reservation_token or (reservation_token is null and p_reservation_token is null));
      if not found then raise exception 'Original is no longer available or reservation does not match'; end if;
    elsif nullif(v_item->>'variant_id','') is not null then
      update product_variants set inventory = case when inventory is null then null else inventory - (v_item->>'quantity')::int end, updated_at = now()
      where id = v_item->>'variant_id' and product_id = v_item->>'product_id'
        and (inventory is null or inventory >= (v_item->>'quantity')::int);
      if not found then raise exception 'Print variant inventory is no longer available'; end if;
    else
      update products set inventory = case when inventory is null then null else inventory - (v_item->>'quantity')::int end, updated_at = now()
      where id = v_item->>'product_id' and category = 'available' and purchasable = true
        and (inventory is null or inventory >= (v_item->>'quantity')::int);
      if not found then raise exception 'Artwork is no longer available'; end if;
    end if;
  end loop;
  insert into orders (stripe_checkout_session_id,stripe_payment_intent_id,customer_name,customer_email,customer_phone,shipping_address_line1,shipping_address_line2,shipping_city,shipping_state,shipping_postal_code,shipping_country,subtotal,shipping_amount,tax_amount,total,currency,payment_status)
  values (p_order->>'stripe_checkout_session_id',p_order->>'stripe_payment_intent_id',p_order->>'customer_name',p_order->>'customer_email',p_order->>'customer_phone',p_order->>'shipping_address_line1',p_order->>'shipping_address_line2',p_order->>'shipping_city',p_order->>'shipping_state',p_order->>'shipping_postal_code',p_order->>'shipping_country',(p_order->>'subtotal')::int,(p_order->>'shipping_amount')::int,(p_order->>'tax_amount')::int,(p_order->>'total')::int,p_order->>'currency',p_order->>'payment_status') returning id into v_order_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into order_items(order_id,product_id,variant_id,product_name_snapshot,variant_name_snapshot,quantity,unit_price,total_price)
    values(v_order_id,v_item->>'product_id',nullif(v_item->>'variant_id',''),v_item->>'product_name_snapshot',nullif(v_item->>'variant_name_snapshot',''),(v_item->>'quantity')::int,(v_item->>'unit_price')::int,(v_item->>'total_price')::int);
  end loop;
  insert into processed_webhook_events(stripe_event_id,event_type) values(p_event_id,p_event_type);
  return v_order_id;
end $$;
revoke all on function fulfill_paid_order(text, text, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function fulfill_paid_order(text, text, jsonb, jsonb, uuid) to service_role;
