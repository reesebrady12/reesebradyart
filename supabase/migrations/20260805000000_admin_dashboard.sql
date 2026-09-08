-- Private admin dashboard, dynamic catalog, image metadata, and fulfillment fields.
create type product_status as enum ('draft', 'published', 'archived', 'sold');
create type image_kind as enum ('front', 'angle', 'detail', 'frame', 'room', 'other');

alter table products rename column name to title;
alter table products add column if not exists short_description text not null default '';
alter table products add column if not exists width numeric;
alter table products add column if not exists height numeric;
alter table products add column if not exists dimension_unit text not null default 'in';
alter table products add column if not exists year integer;
alter table products add column if not exists orientation text;
alter table products add column if not exists status product_status not null default 'draft';
alter table products add column if not exists featured boolean not null default false;
alter table products add column if not exists stripe_product_id text;
alter table products add column if not exists seo_title text;
alter table products add column if not exists seo_description text;
alter table products add column if not exists tags text[] not null default '{}';
alter table products add column if not exists published_at timestamptz;
alter table products add column if not exists archived_at timestamptz;
alter table products add column if not exists reservation_token uuid;
alter table products add column if not exists reserved_until timestamptz;
alter table products add constraint original_inventory_range check (type <> 'original' or inventory in (0, 1));
alter table products add constraint sold_original_has_no_inventory check (type <> 'original' or not sold or inventory = 0);
alter table products add constraint positive_product_price check (price_in_cents > 0);
alter table products add constraint nonnegative_product_inventory check (inventory is null or inventory >= 0);
create index if not exists products_status_idx on products(status);
create index if not exists products_type_status_idx on products(type, status);

alter table product_variants add column if not exists created_at timestamptz not null default now();
alter table product_variants add column if not exists updated_at timestamptz not null default now();
alter table product_variants add constraint positive_variant_price check (price_in_cents > 0);
alter table product_variants add constraint nonnegative_variant_inventory check (inventory is null or inventory >= 0);

create table admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table painting_images (
  id uuid primary key default gen_random_uuid(),
  painting_id text not null references products(id) on delete restrict,
  storage_path text unique not null,
  alt_text text not null default '',
  image_type image_kind not null default 'other',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  file_size integer not null check (file_size > 0),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/avif')),
  created_at timestamptz not null default now()
);
create unique index one_primary_image_per_painting on painting_images(painting_id) where is_primary;
create index painting_images_order_idx on painting_images(painting_id, sort_order);

alter table orders add column if not exists tracking_number text;
alter table orders add column if not exists shipping_carrier text;
alter table orders add column if not exists fulfillment_note text;
alter table orders add column if not exists updated_at timestamptz not null default now();
alter table orders add constraint fulfillment_status_values check (fulfillment_status in ('unfulfilled','packing','fulfilled','cancelled','refunded'));
create index if not exists orders_fulfillment_idx on orders(fulfillment_status, created_at desc);
create index if not exists orders_payment_idx on orders(payment_status, created_at desc);

create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from admin_users where id = auth.uid() and role = 'admin')
$$;
revoke all on function is_admin() from public;
grant execute on function is_admin() to anon, authenticated;

drop policy if exists "public products" on products;
create policy "published products are public" on products for select using (status in ('published', 'sold') or is_admin());
create policy "admins insert products" on products for insert to authenticated with check (is_admin());
create policy "admins update products" on products for update to authenticated using (is_admin()) with check (is_admin());
create policy "admins delete unused products" on products for delete to authenticated using (is_admin() and not exists(select 1 from order_items where product_id = products.id));

alter table admin_users enable row level security;
create policy "admins read own role" on admin_users for select to authenticated using (id = auth.uid());
alter table painting_images enable row level security;
create policy "published images are public" on painting_images for select using (exists(select 1 from products where products.id = painting_id and (products.status in ('published', 'sold') or is_admin())));
create policy "admins manage images" on painting_images for all to authenticated using (is_admin()) with check (is_admin());
create policy "admins manage variants" on product_variants for all to authenticated using (is_admin()) with check (is_admin());
create policy "published variants are public" on product_variants for select using (exists(select 1 from products where products.id = product_id and (products.status in ('published', 'sold') or is_admin())));
create policy "admins read orders" on orders for select to authenticated using (is_admin());
create policy "admins update fulfillment" on orders for update to authenticated using (is_admin()) with check (is_admin());
create policy "admins read order items" on order_items for select to authenticated using (is_admin());

-- Authenticated admins can directly read private records through RLS, but can only
-- update fulfillment columns. Payment totals and customer snapshots remain immutable.
revoke all on admin_users, orders, order_items, processed_webhook_events from anon;
revoke update on orders from authenticated;
grant select on admin_users, orders, order_items to authenticated;
grant update (fulfillment_status, tracking_number, shipping_carrier, fulfillment_note, updated_at) on orders to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('paintings','paintings',false,15728640,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict(id) do update set file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
create policy "published painting files are readable" on storage.objects for select using (bucket_id = 'paintings' and exists(select 1 from products where status in ('published', 'sold') and storage.objects.name like 'paintings/' || products.id || '/%'));
create policy "admins read painting files" on storage.objects for select to authenticated using (bucket_id = 'paintings' and is_admin());
create policy "admins upload painting files" on storage.objects for insert to authenticated with check (bucket_id = 'paintings' and is_admin());
create policy "admins update painting files" on storage.objects for update to authenticated using (bucket_id = 'paintings' and is_admin());
create policy "admins delete painting files" on storage.objects for delete to authenticated using (bucket_id = 'paintings' and is_admin());

-- Atomically reserve an original before opening Stripe Checkout. A second checkout
-- cannot reserve the same original until the first session expires.
create or replace function reserve_originals(p_product_ids text[], p_token uuid, p_minutes integer default 1440)
returns void language plpgsql security definer set search_path = public as $$
declare v_product products%rowtype;
begin
  if array_length(p_product_ids, 1) is null then return; end if;
  for v_product in select * from products where id = any(p_product_ids) order by id for update loop
    if v_product.type <> 'original' or v_product.status <> 'published' or v_product.sold or v_product.inventory <> 1
      or (v_product.reserved_until is not null and v_product.reserved_until > now()) then
      raise exception 'Original is no longer available';
    end if;
  end loop;
  if (select count(*) from products where id = any(p_product_ids)) <> cardinality(p_product_ids) then
    raise exception 'Original is no longer available';
  end if;
  update products set reservation_token = p_token, reserved_until = now() + make_interval(mins => p_minutes)
  where id = any(p_product_ids);
end $$;
revoke all on function reserve_originals(text[], uuid, integer) from public, anon, authenticated;
grant execute on function reserve_originals(text[], uuid, integer) to service_role;

create or replace function release_original_reservation(p_token uuid)
returns void language sql security definer set search_path = public as $$
  update products set reservation_token = null, reserved_until = null
  where reservation_token = p_token and sold = false
$$;
revoke all on function release_original_reservation(uuid) from public, anon, authenticated;
grant execute on function release_original_reservation(uuid) to service_role;

create or replace function reorder_painting_images(p_painting_id text, p_image_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_position integer := 0;
begin
  if (select count(*) from painting_images where painting_id = p_painting_id) <> cardinality(p_image_ids)
    or (select count(distinct value) from unnest(p_image_ids) value) <> cardinality(p_image_ids) then
    raise exception 'Image order does not match painting images';
  end if;
  foreach v_id in array p_image_ids loop
    update painting_images set sort_order = v_position where id = v_id and painting_id = p_painting_id;
    if not found then raise exception 'Image does not belong to painting'; end if;
    v_position := v_position + 1;
  end loop;
end $$;
revoke all on function reorder_painting_images(text, uuid[]) from public, anon, authenticated;
grant execute on function reorder_painting_images(text, uuid[]) to service_role;

create or replace function set_primary_painting_image(p_painting_id text, p_image_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_path text;
begin
  select storage_path into v_path from painting_images where id = p_image_id and painting_id = p_painting_id for update;
  if v_path is null then raise exception 'Image does not belong to painting'; end if;
  update painting_images set is_primary = false where painting_id = p_painting_id and is_primary;
  update painting_images set is_primary = true where id = p_image_id;
  update products set image = v_path, updated_at = now() where id = p_painting_id;
  return v_path;
end $$;
revoke all on function set_primary_painting_image(text, uuid) from public, anon, authenticated;
grant execute on function set_primary_painting_image(text, uuid) to service_role;

-- Replace the original fulfillment function so a reserved original can only be
-- fulfilled by its matching paid Checkout Session.
drop function if exists fulfill_paid_order(text, text, jsonb, jsonb);
create function fulfill_paid_order(p_event_id text, p_event_type text, p_order jsonb, p_items jsonb, p_reservation_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_order_id uuid; v_item jsonb;
begin
  select id into v_order_id from orders where stripe_checkout_session_id = p_order->>'stripe_checkout_session_id';
  if v_order_id is not null then return v_order_id; end if;
  if exists(select 1 from processed_webhook_events where stripe_event_id = p_event_id) then raise exception 'Event already processed without order'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    if v_item->>'product_type' = 'original' then
      update products set sold = true, status = 'sold', inventory = 0, reservation_token = null, reserved_until = null, updated_at = now()
      where id = v_item->>'product_id' and sold = false and inventory = 1
        and (reservation_token = p_reservation_token or (reservation_token is null and p_reservation_token is null));
      if not found then raise exception 'Original is no longer available or reservation does not match'; end if;
    elsif nullif(v_item->>'variant_id','') is not null then
      update product_variants set inventory = case when inventory is null then null else inventory - (v_item->>'quantity')::int end, updated_at = now()
      where id = v_item->>'variant_id' and product_id = v_item->>'product_id'
        and (inventory is null or inventory >= (v_item->>'quantity')::int);
      if not found then raise exception 'Print variant inventory is no longer available'; end if;
    else
      update products set inventory = case when inventory is null then null else inventory - (v_item->>'quantity')::int end, updated_at = now()
      where id = v_item->>'product_id' and (inventory is null or inventory >= (v_item->>'quantity')::int);
      if not found then raise exception 'Print inventory is no longer available'; end if;
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

-- Existing samples remain visible after this migration.
update products set status = case when sold then 'sold'::product_status else 'published'::product_status end,
  published_at = case when not sold then now() else published_at end;
