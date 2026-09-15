-- Safe to re-run. Stores encrypted OpenRouter sub-keys per AI Hub purchase.
-- Server env required: OPENROUTER_MANAGEMENT_API_KEY (from OpenRouter → Management API Keys).
-- Optional: OPENROUTER_KEY_SECRET (AES wrap for key_ciphertext). Never expose sub-keys to the browser.

create table if not exists openrouter_keys (
  id uuid primary key default gen_random_uuid(),
  customer_phone text,
  license_key_code text,
  order_id text,
  plan_type text,
  or_hash text,
  or_label text,
  key_ciphertext text not null,
  credit_limit_usd numeric(12, 4),
  expires_at timestamptz,
  status text not null default 'active',
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists openrouter_keys_phone_idx on openrouter_keys (customer_phone);
create index if not exists openrouter_keys_license_idx on openrouter_keys (license_key_code);
create index if not exists openrouter_keys_active_idx on openrouter_keys (status, expires_at);

alter table if exists openrouter_keys enable row level security;
