-- License keys
create table if not exists public.license_keys (
  id uuid primary key default gen_random_uuid(),
  key_code text unique not null,
  plan_type text not null,
  duration_days int not null,
  customer_phone text,
  customer_name text,
  order_id text,
  is_active boolean default true,
  expires_at timestamptz,
  created_at timestamptz default now()
);

alter table public.license_keys add column if not exists order_id text;

create index if not exists idx_license_keys_code on public.license_keys(key_code);
create index if not exists idx_license_keys_phone on public.license_keys(customer_phone);
create index if not exists idx_license_keys_active on public.license_keys(is_active, expires_at);
create index if not exists idx_license_keys_order on public.license_keys(order_id);

-- Store orders (manual FIB/FastPay approval flow)
create table if not exists public.orders (
  id text primary key,
  customer_name text not null,
  customer_phone text not null,
  items jsonb default '[]'::jsonb,
  items_label text,
  total_iqd numeric default 0,
  total_usd numeric default 0,
  payment_method text,
  transaction_id text,
  plan_type text,
  duration_days int,
  status text not null default 'pending',
  license_key text,
  license_key_id uuid,
  telegram_chat_id text,
  telegram_message_id bigint,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_phone on public.orders(customer_phone);

alter table public.orders add column if not exists license_key_id uuid;

-- Allow public read of a single order by id (for checkout Realtime / polling)
alter table public.orders enable row level security;

drop policy if exists "Public can read orders by id" on public.orders;
create policy "Public can read orders by id"
  on public.orders for select
  using (true);

-- Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception when duplicate_object then
    null;
  end;
end $$;
