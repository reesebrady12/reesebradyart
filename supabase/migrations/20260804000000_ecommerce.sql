create extension if not exists pgcrypto;
create table if not exists products (id text primary key, slug text unique not null, name text not null, description text not null default '', type text not null check (type in ('original','print')), price_in_cents integer not null check (price_in_cents >= 0), stripe_price_id text, inventory integer, sold boolean not null default false, image text not null default '', dimensions text, medium text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists product_variants (id text not null, product_id text not null references products(id), name text not null, price_in_cents integer not null check (price_in_cents >= 0), stripe_price_id text, inventory integer, primary key (product_id,id));
create table if not exists orders (id uuid primary key default gen_random_uuid(), stripe_checkout_session_id text unique not null, stripe_payment_intent_id text, customer_name text, customer_email text, customer_phone text, shipping_address_line1 text, shipping_address_line2 text, shipping_city text, shipping_state text, shipping_postal_code text, shipping_country text, subtotal integer not null, shipping_amount integer not null, tax_amount integer not null, total integer not null, currency text not null, payment_status text not null, fulfillment_status text not null default 'unfulfilled', created_at timestamptz not null default now());
create table if not exists order_items (id uuid primary key default gen_random_uuid(), order_id uuid not null references orders(id), product_id text not null references products(id), variant_id text, product_name_snapshot text not null, variant_name_snapshot text, quantity integer not null check (quantity > 0), unit_price integer not null, total_price integer not null);
create table if not exists processed_webhook_events (stripe_event_id text primary key, event_type text not null, processed_at timestamptz not null default now());
alter table products enable row level security; alter table product_variants enable row level security; alter table orders enable row level security; alter table order_items enable row level security; alter table processed_webhook_events enable row level security;

create or replace function fulfill_paid_order(p_event_id text, p_event_type text, p_order jsonb, p_items jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare v_order_id uuid; v_item jsonb;
begin
  select id into v_order_id from orders where stripe_checkout_session_id = p_order->>'stripe_checkout_session_id';
  if v_order_id is not null then return v_order_id; end if;
  if exists(select 1 from processed_webhook_events where stripe_event_id = p_event_id) then raise exception 'Event already processed without order'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    if v_item->>'product_type' = 'original' then
      update products set sold = true, inventory = 0, updated_at = now() where id = v_item->>'product_id' and sold = false and inventory = 1;
      if not found then raise exception 'Original is no longer available'; end if;
    end if;
  end loop;
  insert into orders (stripe_checkout_session_id,stripe_payment_intent_id,customer_name,customer_email,customer_phone,shipping_address_line1,shipping_address_line2,shipping_city,shipping_state,shipping_postal_code,shipping_country,subtotal,shipping_amount,tax_amount,total,currency,payment_status)
  values (p_order->>'stripe_checkout_session_id',p_order->>'stripe_payment_intent_id',p_order->>'customer_name',p_order->>'customer_email',p_order->>'customer_phone',p_order->>'shipping_address_line1',p_order->>'shipping_address_line2',p_order->>'shipping_city',p_order->>'shipping_state',p_order->>'shipping_postal_code',p_order->>'shipping_country',(p_order->>'subtotal')::int,(p_order->>'shipping_amount')::int,(p_order->>'tax_amount')::int,(p_order->>'total')::int,p_order->>'currency',p_order->>'payment_status') returning id into v_order_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into order_items(order_id,product_id,variant_id,product_name_snapshot,variant_name_snapshot,quantity,unit_price,total_price) values(v_order_id,v_item->>'product_id',nullif(v_item->>'variant_id',''),v_item->>'product_name_snapshot',nullif(v_item->>'variant_name_snapshot',''),(v_item->>'quantity')::int,(v_item->>'unit_price')::int,(v_item->>'total_price')::int);
  end loop;
  insert into processed_webhook_events(stripe_event_id,event_type) values(p_event_id,p_event_type);
  return v_order_id;
end $$;

-- TODO: Replace sample catalog values and Stripe price IDs. Keep IDs synchronized with both catalogs.
insert into products(id,slug,name,description,type,price_in_cents,stripe_price_id,inventory,sold,image,dimensions,medium) values
('original-golden-hour','golden-hour-study','Golden Hour Study','A quiet study of late-afternoon light.','original',85000,null,1,false,'/art/golden-hour.svg','24 × 30 in','Oil on canvas'),
('original-still-water','still-water','Still Water','Soft color and reflected sky.','original',62000,null,1,false,'/art/still-water.svg','18 × 24 in','Oil on linen'),
('print-wild-flowers','wild-flowers-print','Wild Flowers','Archival fine-art print.','print',4500,null,null,false,'/art/wild-flowers.svg',null,'Archival pigment print'),
('print-blue-morning','blue-morning-print','Blue Morning','Museum-quality fine-art print.','print',4500,null,null,false,'/art/blue-morning.svg',null,'Archival pigment print') on conflict(id) do nothing;
