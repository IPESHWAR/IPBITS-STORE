-- Optional AI Hub subscription table used by /api/ai/hub-access.
-- Safe to re-run.

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  phone text,
  access_key text,
  package_type text not null default 'ai_hub',
  status text not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_phone_idx on subscriptions (phone);
create index if not exists subscriptions_key_idx on subscriptions (access_key);
create index if not exists subscriptions_active_idx on subscriptions (package_type, status, expires_at);

alter table if exists orders
  add column if not exists package_type text;

alter table if exists orders
  add column if not exists expires_at timestamptz;
