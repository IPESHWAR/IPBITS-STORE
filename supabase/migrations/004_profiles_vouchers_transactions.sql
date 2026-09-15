-- Wallet schema: profiles (balance) + vouchers + transactions
-- Safe to run on an existing profiles table (adds columns only).

alter table if exists profiles
  add column if not exists phone text;

alter table if exists profiles
  add column if not exists balance_iqd integer not null default 0;

alter table if exists profiles
  add column if not exists balance_usd numeric(12, 2) not null default 0;

alter table if exists profiles
  add column if not exists updated_at timestamptz default now();

create unique index if not exists profiles_phone_unique
  on profiles (phone)
  where phone is not null;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  phone text unique,
  balance_iqd integer not null default 0 check (balance_iqd >= 0),
  balance_usd numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists vouchers (
  code text primary key,
  amount_iqd integer not null check (amount_iqd > 0),
  is_used boolean not null default false,
  used_by text,
  used_at timestamptz
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  type text not null check (type in ('top_up', 'purchase', 'ai_usage')),
  amount_iqd integer not null,
  amount_usd numeric(12, 2) not null default 0,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists transactions_phone_created_idx
  on transactions (phone, created_at desc);

-- Pending gateway top-ups (admin Telegram approve) — not the ledger itself
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

alter table profiles enable row level security;
alter table vouchers enable row level security;
alter table transactions enable row level security;
alter table wallet_topups enable row level security;

create or replace function ensure_wallet_profile(p_phone text)
returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  p profiles;
  synthetic_email text;
begin
  select * into p from profiles where phone = p_phone for update;
  if found then
    return p;
  end if;

  synthetic_email := 'wallet+' || regexp_replace(p_phone, '[^\w]', '', 'g') || '@ipbits.local';

  begin
    insert into profiles (id, phone, balance_iqd, balance_usd)
    values (gen_random_uuid(), p_phone, 0, 0)
    returning * into p;
  exception
    when unique_violation then
      select * into p from profiles where phone = p_phone for update;
    when not_null_violation then
      insert into profiles (id, phone, balance_iqd, balance_usd, email)
      values (gen_random_uuid(), p_phone, 0, 0, synthetic_email)
      returning * into p;
  end;

  return p;
end;
$$;

-- Atomic balance change + ledger row
create or replace function wallet_apply(
  p_phone text,
  p_type text,
  p_amount_iqd integer,
  p_amount_usd numeric,
  p_description text
) returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  p profiles;
begin
  p := ensure_wallet_profile(p_phone);

  if p_amount_iqd < 0 and (p.balance_iqd + p_amount_iqd) < 0 then
    raise exception 'insufficient_balance';
  end if;

  update profiles
    set
      balance_iqd = balance_iqd + p_amount_iqd,
      balance_usd = greatest(0, balance_usd + coalesce(p_amount_usd, 0)),
      updated_at = now()
    where phone = p_phone
    returning * into p;

  insert into transactions (phone, type, amount_iqd, amount_usd, description)
  values (p_phone, p_type, p_amount_iqd, coalesce(p_amount_usd, 0), p_description);

  return p;
end;
$$;

-- Atomic voucher redeem: mark used + credit profile + write top_up transaction
create or replace function redeem_voucher(p_phone text, p_code text)
returns table (balance_iqd integer, balance_usd numeric, credited_iqd integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v vouchers;
  p profiles;
begin
  select * into v from vouchers where code = p_code for update;

  if not found then
    raise exception 'invalid_voucher';
  end if;

  if v.is_used then
    raise exception 'voucher_used';
  end if;

  update vouchers
    set is_used = true, used_by = p_phone, used_at = now()
    where code = p_code
      and is_used = false;

  if not found then
    raise exception 'voucher_used';
  end if;

  p := wallet_apply(
    p_phone,
    'top_up',
    v.amount_iqd,
    0,
    'پڕکرن ب کارتی'
  );

  return query
    select p.balance_iqd, p.balance_usd, v.amount_iqd;
end;
$$;

insert into vouchers (code, amount_iqd)
values
  ('IPBITS-5K', 5000),
  ('IPBITS-10K', 10000),
  ('IPBITS-25K', 25000),
  ('GIFT-5000', 5000)
on conflict (code) do nothing;

revoke all on function ensure_wallet_profile(text) from public;
revoke all on function wallet_apply(text, text, integer, numeric, text) from public;
revoke all on function redeem_voucher(text, text) from public;

grant execute on function ensure_wallet_profile(text) to service_role;
grant execute on function wallet_apply(text, text, integer, numeric, text) to service_role;
grant execute on function redeem_voucher(text, text) to service_role;
