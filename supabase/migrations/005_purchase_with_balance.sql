-- Instant catalog purchase: allocate one inventory row + deduct profiles.balance_iqd.

create table if not exists product_inventory (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null,
  payload text not null,
  item_type text not null default 'gift_code' check (item_type in ('gift_code', 'credentials')),
  is_used boolean not null default false,
  used_by text,
  used_at timestamptz,
  order_id text,
  created_at timestamptz not null default now()
);

create index if not exists product_inventory_available_idx
  on product_inventory (product_slug, created_at)
  where is_used = false;

create index if not exists product_inventory_slug_idx
  on product_inventory (product_slug, created_at desc);

alter table product_inventory enable row level security;

create or replace function purchase_with_balance(
  p_phone text,
  p_slug text,
  p_price integer
) returns table (
  balance_iqd integer,
  balance_usd numeric,
  payload text,
  item_type text,
  product_slug text,
  inventory_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  p profiles;
  item product_inventory;
  wallet_row profiles;
  usd_debit numeric;
begin
  if p_phone is null or length(trim(p_phone)) < 3 then
    raise exception 'invalid_phone';
  end if;
  if p_slug is null or length(trim(p_slug)) < 1 then
    raise exception 'invalid_slug';
  end if;
  if p_price is null or p_price <= 0 then
    raise exception 'invalid_price';
  end if;

  p := ensure_wallet_profile(trim(p_phone));

  if p.balance_iqd < p_price then
    raise exception 'insufficient_balance';
  end if;

  select *
    into item
    from product_inventory
    where product_slug = trim(p_slug)
      and is_used = false
    order by created_at
    for update skip locked
    limit 1;

  if not found then
    raise exception 'out_of_stock';
  end if;

  update product_inventory
    set is_used = true, used_by = trim(p_phone), used_at = now()
    where id = item.id
      and is_used = false;

  if not found then
    raise exception 'out_of_stock';
  end if;

  usd_debit := round((p_price::numeric / 5000.0) * 3.5, 2);

  wallet_row := wallet_apply(
    trim(p_phone),
    'purchase',
    -p_price,
    -usd_debit,
    trim(p_slug)
  );

  return query
    select
      wallet_row.balance_iqd,
      wallet_row.balance_usd,
      item.payload,
      item.item_type,
      item.product_slug,
      item.id;
end;
$$;

revoke all on function purchase_with_balance(text, text, integer) from public;
grant execute on function purchase_with_balance(text, text, integer) to service_role;
