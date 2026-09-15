-- Run after SETUP_INVENTORY.sql so checkout can ILIKE-match slugs
-- and treat is_sold / is_used / status = available as in-stock.
-- Same contents as supabase/migrations/006_inventory_availability.sql

alter table if exists product_inventory
  add column if not exists is_sold boolean not null default false;

alter table if exists product_inventory
  add column if not exists status text not null default 'available';

create or replace function inventory_slug_matches(stored text, wanted text)
returns boolean
language sql
immutable
as $$
  select
    stored is not null
    and wanted is not null
    and length(trim(wanted)) > 0
    and (
      stored ilike trim(wanted)
      or stored ilike trim(wanted) || '-%'
      or stored ilike trim(wanted) || '_%'
      or trim(wanted) ilike stored
      or trim(wanted) ilike stored || '-%'
      or trim(wanted) ilike stored || '_%'
      or replace(lower(stored), '_', '-') = replace(lower(trim(wanted)), '_', '-')
      or replace(lower(stored), '_', '-') ilike replace(lower(trim(wanted)), '_', '-') || '-%'
      or replace(lower(trim(wanted)), '_', '-') ilike replace(lower(stored), '_', '-') || '-%'
      or replace(replace(lower(stored), '-', ''), '_', '')
         = replace(replace(lower(trim(wanted)), '-', ''), '_', '')
    );
$$;

create or replace function inventory_row_is_available(
  p_is_used boolean,
  p_is_sold boolean,
  p_status text
) returns boolean
language sql
immutable
as $$
  select
    coalesce(p_is_used, false) = false
    and coalesce(p_is_sold, false) = false
    and (p_status is null or lower(trim(p_status)) = 'available');
$$;

create or replace function inventory_is_available(p_slug text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from product_inventory
    where inventory_slug_matches(product_slug, p_slug)
      and inventory_row_is_available(is_used, is_sold, status)
  );
$$;

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
    where inventory_slug_matches(product_slug, trim(p_slug))
      and inventory_row_is_available(is_used, is_sold, status)
    order by created_at
    for update skip locked
    limit 1;

  if not found then
    raise exception 'out_of_stock';
  end if;

  update product_inventory
    set
      is_used = true,
      is_sold = true,
      status = 'sold',
      used_by = trim(p_phone),
      used_at = now()
    where id = item.id
      and inventory_row_is_available(is_used, is_sold, status);

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

revoke all on function inventory_is_available(text) from public;
revoke all on function purchase_with_balance(text, text, integer) from public;
grant execute on function inventory_is_available(text) to service_role;
grant execute on function purchase_with_balance(text, text, integer) to service_role;
