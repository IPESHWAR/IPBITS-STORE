-- Unified wallet: phone is the unique account identifier.

create table if not exists wallets (
  phone text primary key,
  balance_iqd integer not null default 0 check (balance_iqd >= 0),
  balance_usd numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  phone text not null references wallets(phone) on delete cascade,
  type text not null check (type in ('top_up', 'purchase', 'ai_usage', 'voucher')),
  amount_iqd integer not null,
  amount_usd numeric(12, 2) not null default 0,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_phone_created_idx
  on wallet_transactions (phone, created_at desc);

create table if not exists wallet_vouchers (
  code text primary key,
  amount_iqd integer not null,
  amount_usd numeric(12, 2) not null default 0,
  is_used boolean not null default false,
  used_by_phone text,
  used_at timestamptz
);

create table if not exists wallet_topups (
  id text primary key,
  phone text not null,
  amount_iqd integer not null,
  amount_usd numeric(12, 2) not null default 0,
  payment_method text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table wallet_vouchers enable row level security;
alter table wallet_topups enable row level security;

-- Service role (API) bypasses RLS. Anon has no policies = no public access.

create or replace function wallet_apply(
  p_phone text,
  p_type text,
  p_amount_iqd integer,
  p_amount_usd numeric,
  p_description text
) returns wallets
language plpgsql
as $$
declare
  w wallets;
begin
  insert into wallets (phone) values (p_phone)
  on conflict (phone) do nothing;

  select * into w from wallets where phone = p_phone for update;

  if p_amount_iqd < 0 and (w.balance_iqd + p_amount_iqd) < 0 then
    raise exception 'insufficient_balance';
  end if;

  update wallets
    set
      balance_iqd = balance_iqd + p_amount_iqd,
      balance_usd = greatest(0, balance_usd + coalesce(p_amount_usd, 0)),
      updated_at = now()
    where phone = p_phone
    returning * into w;

  insert into wallet_transactions (phone, type, amount_iqd, amount_usd, description)
  values (p_phone, p_type, p_amount_iqd, coalesce(p_amount_usd, 0), p_description);

  return w;
end;
$$;

insert into wallet_vouchers (code, amount_iqd, amount_usd)
values
  ('IPBITS-5K', 5000, 3.50),
  ('IPBITS-10K', 10000, 7.00),
  ('IPBITS-25K', 25000, 17.00),
  ('GIFT-5000', 5000, 3.50)
on conflict (code) do nothing;
