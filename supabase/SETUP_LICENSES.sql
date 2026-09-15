-- Run in Supabase SQL Editor if migration 009 has not been applied.
-- Automated OpenRouter + customer license registry.

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  license_code text unique not null,
  openrouter_key text not null,
  openrouter_hash text,
  package_type text not null,
  duration_days int not null,
  credit_limit_usd numeric(12, 4),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists licenses_code_idx on public.licenses (license_code);
create index if not exists licenses_active_idx on public.licenses (is_active, expires_at);
create index if not exists licenses_package_idx on public.licenses (package_type);

alter table if exists public.licenses enable row level security;
