-- IPBITS license key fulfillment table
create table if not exists public.license_keys (
  id uuid primary key default gen_random_uuid(),
  key_code text unique not null,
  plan_type text not null,
  duration_days int not null,
  customer_phone text,
  customer_name text,
  is_active boolean default true,
  expires_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_license_keys_code on public.license_keys(key_code);
create index if not exists idx_license_keys_phone on public.license_keys(customer_phone);
create index if not exists idx_license_keys_active on public.license_keys(is_active, expires_at);
