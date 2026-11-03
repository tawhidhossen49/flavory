-- Flavory schema. Money is whole Taka (integer). Every public table has RLS on.
-- Customer-facing writes go through secret-guarded SECURITY DEFINER functions (see 0002),
-- so the anon key alone can never create an order or read one.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table private.config (key text primary key, value text not null);
create table private.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);

create type public.staff_role as enum ('owner', 'staff');
create type public.order_status as enum ('new', 'confirmed', 'cooking', 'out_for_delivery', 'delivered', 'cancelled');

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  role public.staff_role not null default 'staff',
  name text not null default ''
);

create function private.my_role() returns public.staff_role
language sql stable security definer set search_path = '' as
$$ select role from public.profiles where user_id = auth.uid() $$;

create function private.is_owner() returns boolean
language sql stable set search_path = '' as $$ select private.my_role() is not distinct from 'owner'::public.staff_role $$;

create function private.is_staff() returns boolean
language sql stable set search_path = '' as $$ select private.my_role() is not null $$;

-- MENU ---------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories on delete restrict deferrable,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  ingredients text not null default '' check (char_length(ingredients) <= 500),
  allergens text not null default 'Contains wheat, egg, soy.' check (char_length(allergens) <= 200),
  badge text check (badge in ('Best seller', 'New', 'Spicy')),
  photos text[] not null default '{}',
  available boolean not null default true,
  sold_out_on date,                        -- "sold out today": resets itself the next day
  suggest boolean not null default false,  -- offered on the "Is that everything?" step
  is_sample boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.menu_items (category_id, sort_order);

create table public.item_options (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.menu_items on delete cascade deferrable,
  label text not null default '' check (char_length(label) <= 40), -- '' = single-price item
  price int not null check (price between 0 and 100000),
  sort_order int not null default 0
);
create index on public.item_options (item_id, sort_order);

-- separate table because RLS works per row, and costs must never reach visitors
create table public.option_costs (
  option_id uuid primary key references public.item_options on delete cascade deferrable,
  cost int not null default 0 check (cost between 0 and 100000)
);

-- CONTENT ------------------------------------------------------------
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.pages (
  slug text primary key,
  content jsonb not null,
  updated_at timestamptz not null default now()
);

-- ORDERS -------------------------------------------------------------
create sequence public.order_no_seq start 1001;

create table public.customers (
  phone text primary key,
  referral_code text not null unique,
  referral_credit int not null default 0,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no int not null unique default nextval('public.order_no_seq'),
  receipt_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  status public.order_status not null default 'new',
  name text not null,
  phone text,                -- nulled when a customer's data is erased
  area text not null,
  address text,
  scheduled_for timestamptz, -- null = ASAP
  payment text not null check (payment in ('cod', 'bkash')),
  note text not null default '',
  subtotal int not null,
  discount int not null default 0,
  delivery_fee int not null default 0,
  total int not null,
  cost_total int not null default 0,
  coupon_code text,
  bounce_code text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cooking_at timestamptz,
  out_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);
create index on public.orders (created_at desc);
create index on public.orders (phone);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  option_id uuid references public.item_options on delete set null,
  name text not null,
  option_label text not null default '',
  qty int not null check (qty between 1 and 50),
  unit_price int not null,
  unit_cost int not null default 0
);
create index on public.order_items (order_id);
create index on public.order_items (option_id);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  kind text not null check (kind in ('late', 'soggy', 'wrong_item', 'other')),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index on public.complaints (order_id);

create table public.coupons (
  code text primary key check (code = upper(code) and char_length(code) between 3 and 30),
  kind text not null default 'amount' check (kind in ('amount', 'percent')),
  value int not null check (value > 0),
  min_order int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  max_uses int,
  used int not null default 0,
  phone text,                 -- bounce-back coupons work only for the customer they were issued to
  source text not null default 'manual' check (source in ('manual', 'bounce')),
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique references public.orders on delete cascade, -- tied to a real delivered order
  name text not null,
  rating int not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 3 and 600),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- AUDIT + UNDO -------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  txid bigint not null default txid_current(), -- rows from one save undo together
  table_name text not null,
  action text not null,
  before jsonb,
  after jsonb,
  undone boolean not null default false
);
create index on public.audit_log (at desc);
create index on public.audit_log (txid);

create function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor, table_name, action, before, after)
  values (auth.uid(), tg_table_name, tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['categories','menu_items','item_options','option_costs','settings','pages','coupons','reviews'] loop
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function private.audit()', t);
  end loop;
end $$;

-- RLS ----------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.item_options enable row level security;
alter table public.option_costs enable row level security;
alter table public.settings enable row level security;
alter table public.pages enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.complaints enable row level security;
alter table public.coupons enable row level security;
alter table public.reviews enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.customers, public.orders, public.order_items, public.complaints,
              public.coupons, public.option_costs, public.audit_log, public.profiles from anon;

create policy "own or owner reads" on public.profiles for select to authenticated
  using (user_id = auth.uid() or private.is_owner());
create policy "owner adds" on public.profiles for insert to authenticated with check (private.is_owner());
create policy "owner edits" on public.profiles for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy "owner removes" on public.profiles for delete to authenticated using (private.is_owner() and user_id <> auth.uid());

create policy "public reads" on public.categories for select to anon, authenticated using (true);
create policy "public reads available" on public.menu_items for select to anon, authenticated using (available or private.is_owner());
create policy "public reads" on public.item_options for select to anon, authenticated using (true);
create policy "public reads" on public.settings for select to anon, authenticated using (true);
create policy "public reads" on public.pages for select to anon, authenticated using (true);
create policy "public reads approved" on public.reviews for select to anon, authenticated using (approved or private.is_owner());

do $$
declare t text;
begin
  foreach t in array array['categories','menu_items','item_options','settings','pages','reviews'] loop
    execute format('create policy "owner inserts" on public.%I for insert to authenticated with check (private.is_owner())', t);
    execute format('create policy "owner updates" on public.%I for update to authenticated using (private.is_owner()) with check (private.is_owner())', t);
    execute format('create policy "owner deletes" on public.%I for delete to authenticated using (private.is_owner())', t);
  end loop;
  foreach t in array array['option_costs','coupons','customers'] loop
    execute format('create policy "owner only" on public.%I for all to authenticated using (private.is_owner()) with check (private.is_owner())', t);
  end loop;
end $$;

create policy "staff reads" on public.orders for select to authenticated using (private.is_staff());
create policy "staff reads" on public.order_items for select to authenticated using (private.is_staff());
create policy "staff reads" on public.complaints for select to authenticated using (private.is_staff());
create policy "staff files" on public.complaints for insert to authenticated with check (private.is_staff());
create policy "owner reads" on public.audit_log for select to authenticated using (private.is_owner());

-- STORAGE ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/webp']);

create policy "owner lists media" on storage.objects for select to authenticated
  using (bucket_id = 'media' and private.is_owner());
create policy "owner uploads media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and private.is_owner());
create policy "owner removes media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and private.is_owner());
