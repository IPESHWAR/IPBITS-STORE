-- Track which gift/voucher cards have already been batch-printed.

alter table if exists vouchers
  add column if not exists id uuid default gen_random_uuid();

alter table if exists vouchers
  add column if not exists status text not null default 'available';

alter table if exists vouchers
  add column if not exists is_printed boolean not null default false;

alter table if exists vouchers
  add column if not exists printed_at timestamptz;

create unique index if not exists vouchers_id_unique
  on vouchers (id)
  where id is not null;

create index if not exists vouchers_print_ready_idx
  on vouchers (amount_iqd, is_printed, is_used)
  where is_used = false;

alter table if exists gift_cards
  add column if not exists id uuid default gen_random_uuid();

alter table if exists gift_cards
  add column if not exists status text not null default 'available';

alter table if exists gift_cards
  add column if not exists is_printed boolean not null default false;

alter table if exists gift_cards
  add column if not exists printed_at timestamptz;
