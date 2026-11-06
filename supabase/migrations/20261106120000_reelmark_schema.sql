-- ============================================================================
-- Reelmark storefront — Supabase schema
--
-- How to apply: Supabase Dashboard → SQL Editor → paste this file → Run.
-- It is safe to run again: every statement is idempotent.
--
-- Security model: the browser never writes to these tables. Every write goes
-- through the app's server functions, which verify the caller's Firebase or
-- Supabase sign-in token and then use the service-role key. Row Level Security
-- is enabled on every table; anonymous visitors may only read the public
-- storefront tables (products, site_content). Admin rights come from the
-- ADMIN_EMAILS server setting or `profiles.role = 'admin'`, which only the
-- service role (or this SQL editor) can change.
-- ============================================================================

-- Keeps updated_at current on every UPDATE.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 1. Profiles: one row per shopper or admin (Google/Firebase or email/Supabase) ──
create table if not exists public.profiles (
  id            text primary key,          -- "firebase:<uid>" or "supabase:<uuid>"
  provider      text not null check (provider in ('firebase', 'supabase')),
  email         text,
  display_name  text,
  avatar_url    text,
  role          text not null default 'user' check (role in ('user', 'admin')),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (lower(email));
alter table public.profiles enable row level security;
-- No policies on purpose: profiles are only reachable through the server.

-- ── 2. Products: the admin's layer over src/components/shop/products.ts ──
-- A row with a base bouquet's id overrides only its non-null columns.
-- Any other id is a bouquet the admin added.
create table if not exists public.products (
  id          text primary key
                check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 64),
  name        text check (name is null or char_length(name) between 2 and 80),
  maker       text,
  price       numeric(10, 2) check (price is null or price > 0),
  image_url   text,
  flowers     text[],
  palette     text,
  occasions   text[],
  blurb       text,
  is_active   boolean not null default true,
  is_featured boolean,
  sort_order  integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.products enable row level security;
drop policy if exists "Products are readable by everyone" on public.products;
create policy "Products are readable by everyone"
  on public.products for select to anon, authenticated using (true);
drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

-- ── 3. Site content: edited copy, pictures and billing settings ──
-- Only edits are stored; the app falls back to its built-in defaults.
create table if not exists public.site_content (
  section_key  text primary key check (char_length(section_key) <= 80),
  text_content text not null default '',
  updated_at   timestamptz not null default now()
);
alter table public.site_content enable row level security;
drop policy if exists "Site content is readable by everyone" on public.site_content;
create policy "Site content is readable by everyone"
  on public.site_content for select to anon, authenticated using (true);
drop trigger if exists site_content_touch_updated_at on public.site_content;
create trigger site_content_touch_updated_at
  before update on public.site_content
  for each row execute function public.touch_updated_at();

-- ── 4. Orders ──
create sequence if not exists public.order_number_seq start with 10001;

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique default ('RM-' || nextval('public.order_number_seq')),
  user_id          text references public.profiles (id) on delete set null,
  customer_name    text not null,
  customer_email   text not null,
  customer_phone   text not null,
  recipient_name   text not null,
  recipient_phone  text not null,
  delivery_address text not null,
  delivery_city    text not null,
  delivery_pincode text not null,
  delivery_date    date not null,
  delivery_slot    text not null check (delivery_slot in ('standard', 'express')),
  card_message     text not null default '',
  items            jsonb not null check (jsonb_typeof(items) = 'array'),
  subtotal         numeric(10, 2) not null check (subtotal >= 0),
  discount         numeric(10, 2) not null default 0 check (discount >= 0),
  promo_code       text,
  delivery_fee     numeric(10, 2) not null check (delivery_fee >= 0),
  tax              numeric(10, 2) not null check (tax >= 0),
  total_amount     numeric(10, 2) not null check (total_amount >= 0),
  payment_method   text not null default 'pay_on_delivery',
  payment_status   text not null default 'pending'
                     check (payment_status in ('pending', 'paid', 'refunded', 'failed')),
  status           text not null default 'placed'
                     check (status in ('placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
  admin_note       text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_customer_email_idx on public.orders (customer_email);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
alter table public.orders enable row level security;
-- No policies: shoppers see their orders through the server, never directly.
drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

-- ── 5. Reviews (published only after an admin approves them) ──
create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  product_id   text not null,
  user_id      text not null references public.profiles (id) on delete cascade,
  author_name  text not null,
  rating       smallint not null check (rating between 1 and 5),
  body         text not null check (char_length(body) between 3 and 1000),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at   timestamptz not null default now(),
  moderated_at timestamptz
);
create index if not exists reviews_status_idx on public.reviews (status, created_at desc);
create index if not exists reviews_user_id_idx on public.reviews (user_id);
alter table public.reviews enable row level security;

-- ── 6. Newsletter subscribers ──
create table if not exists public.newsletter_subscribers (
  email      text primary key check (email = lower(email) and char_length(email) <= 254),
  created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;

-- ── 7. Public bucket for pictures uploaded from the admin dashboard ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media',
  'site-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Optional: make an existing account an admin ──
-- (People listed in the ADMIN_EMAILS server setting are admins automatically.)
-- update public.profiles set role = 'admin' where email = 'you@example.com';
