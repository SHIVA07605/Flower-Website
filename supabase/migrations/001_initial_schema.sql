-- ============================================================
-- Reelmark — Supabase database schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── 1. PROFILES ──────────────────────────────────────────────
-- Extends auth.users with a public profile + role column.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text,
  avatar_url  text,
  role        text not null default 'user'
                check (role in ('admin', 'user')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone can read profiles.
create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

-- Users can update their own profile (but NOT their role).
create policy "Users can update own profile"
  on public.profiles for update
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- ── Helper: is the current user an admin? ────────────────────
create or replace function public.is_admin()
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── Auto-create a profile row on signup ──────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
as $$
begin
  insert into public.profiles (id, username, avatar_url, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'role',
      case when new.email = 'admin@reelmark.com' then 'admin' else 'user' end
    )
  )
  on conflict (id) do update set
    username = coalesce(excluded.username, profiles.username),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
    role = coalesce(excluded.role, profiles.role);
  return new;
end;
$$;

-- Drop the trigger first (safe to call even if it doesn't exist).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── 2. PRODUCTS ──────────────────────────────────────────────
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  maker       text not null default '',
  price       numeric(10,2) not null,
  image_url   text,
  video_url   text,
  description text not null default '',
  flowers     text[] not null default '{}',
  palette     text not null default '',
  occasions   text[] not null default '{}',
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.products enable row level security;

-- Public can read active products.
create policy "Active products are viewable by everyone"
  on public.products for select
  using (is_active = true);

-- Admins can read ALL products (including inactive).
create policy "Admins can view all products"
  on public.products for select
  using (public.is_admin());

-- Admin CRUD
create policy "Admins can insert products"
  on public.products for insert
  with check (public.is_admin());

create policy "Admins can update products"
  on public.products for update
  using (public.is_admin());

create policy "Admins can delete products"
  on public.products for delete
  using (public.is_admin());


-- ── 3. SITE_CONTENT ──────────────────────────────────────────
create table if not exists public.site_content (
  id           uuid primary key default gen_random_uuid(),
  section_key  text unique not null,
  text_content text not null default '',
  updated_at   timestamptz not null default now()
);

alter table public.site_content enable row level security;

-- Public can read content.
create policy "Site content is viewable by everyone"
  on public.site_content for select using (true);

-- Admin CRUD
create policy "Admins can insert site content"
  on public.site_content for insert
  with check (public.is_admin());

create policy "Admins can update site content"
  on public.site_content for update
  using (public.is_admin());

create policy "Admins can delete site content"
  on public.site_content for delete
  using (public.is_admin());


-- ── 4. COMMENTS ──────────────────────────────────────────────
create table if not exists public.comments (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  user_id       uuid not null references auth.users(id)  on delete cascade,
  comment_text  text not null,
  rating        integer check (rating between 1 and 5),
  is_approved   boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.comments enable row level security;

-- Public can read approved comments.
create policy "Approved comments are viewable by everyone"
  on public.comments for select
  using (is_approved = true);

-- Admins see every comment.
create policy "Admins can view all comments"
  on public.comments for select
  using (public.is_admin());

-- Authenticated users can post comments.
create policy "Authenticated users can insert comments"
  on public.comments for insert
  with check (auth.uid() = user_id);

-- Users can update their own comments.
create policy "Users can update own comments"
  on public.comments for update
  using (auth.uid() = user_id);

-- Admins can update any comment (approve / edit).
create policy "Admins can update any comment"
  on public.comments for update
  using (public.is_admin());

-- Admins can delete any comment.
create policy "Admins can delete any comment"
  on public.comments for delete
  using (public.is_admin());


-- ── 5. ORDERS & BILLING ──────────────────────────────────────
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text unique not null,
  customer_name   text not null,
  customer_email  text not null,
  items           jsonb not null default '[]'::jsonb,
  subtotal        numeric(10,2) not null default 0,
  delivery_fee    numeric(10,2) not null default 0,
  tax             numeric(10,2) not null default 0,
  total_amount    numeric(10,2) not null default 0,
  status          text not null default 'processing'
                    check (status in ('processing', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
  payment_status  text not null default 'paid'
                    check (payment_status in ('paid', 'pending', 'refunded', 'failed')),
  created_at      timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "Admins can view all orders"
  on public.orders for select
  using (public.is_admin());

create policy "Admins can insert orders"
  on public.orders for insert
  with check (public.is_admin());

create policy "Admins can update orders"
  on public.orders for update
  using (public.is_admin());

create policy "Admins can delete orders"
  on public.orders for delete
  using (public.is_admin());


-- ── 6. SEED SITE_CONTENT (defaults) ─────────────────────────
insert into public.site_content (section_key, text_content)
values
  ('hero_kicker',   'Trusted by 120,000+ flower lovers'),
  ('hero_title_1',  'Shop the Blooms'),
  ('hero_title_2',  'You Saw in Reels'),
  ('hero_subtitle', 'Hand-tied bouquets from indie florists, shown in short, snappy reels. Tap any reel to see it up close, then send it across town today.'),
  ('hero_cta',       'Shop Best Sellers'),
  ('delivery_bar',   'Same-day delivery · 7-day freshness guarantee · Free shipping over $75'),
  ('billing_standard_delivery', '9.99'),
  ('billing_express_delivery',  '14.99'),
  ('billing_free_shipping_threshold', '75'),
  ('billing_tax_rate', '8.25'),
  ('billing_currency_symbol', '$')
on conflict (section_key) do nothing;


-- ── 7. STORAGE BUCKET for product images ─────────────────────
-- Run this separately if you also want image uploads:
-- insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true);
-- create policy "Anyone can view product images" on storage.objects for select using (bucket_id = 'product-images');
-- create policy "Admins can upload product images" on storage.objects for insert with check (bucket_id = 'product-images' and public.is_admin());
-- create policy "Admins can delete product images" on storage.objects for delete using (bucket_id = 'product-images' and public.is_admin());

