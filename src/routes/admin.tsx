import { useState, useEffect, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useSiteContent } from "@/hooks/use-site-content";
import { saveProductLocalOverride } from "@/hooks/use-products";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { GoogleIcon } from "@/components/ui/google-icon";
import {
  Package,
  FileText,
  MessageSquare,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Save,
  ArrowLeft,
  Loader2,
  Lock,
  Mail,
  Copy,
  Check,
  ExternalLink,
  KeyRound,
  DollarSign,
  Image as ImageIcon,
  Receipt,
  TrendingUp,
  Printer,
  X,
  CreditCard,
  Truck,
  RotateCcw,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { bouquets } from "@/components/shop/products";
import floralTopDefault from "@/assets/floral-top-long.webp";
import floralBottomDefault from "@/assets/floral-bottom.webp";
import bouquetCenterDefault from "@/assets/bouquet-center.webp";
import maker1Default from "@/assets/makers/maker-1.jpg";
import maker2Default from "@/assets/makers/maker-2.jpg";
import maker3Default from "@/assets/makers/maker-3.jpg";
import maker4Default from "@/assets/makers/maker-4.jpg";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin Portal — Reelmark" }],
  }),
  component: AdminPage,
});

const DEFAULT_ADMIN_EMAIL = "admin@reelmark.com";
const DEFAULT_ADMIN_PASS = "adminpassword123";

type AdminTab = "products" | "billing" | "media" | "content" | "comments";

function AdminPage() {
  const { user, profile, isAdmin, loading: authLoading, signIn, signInWithGoogle, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("content");

  // Direct Admin Login Form State
  const [adminEmail, setAdminEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [adminPassword, setAdminPassword] = useState(DEFAULT_ADMIN_PASS);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [dbTablesMissing, setDbTablesMissing] = useState(true);

  const handleGoogleAdminLogin = async () => {
    setIsGoogleLoggingIn(true);
    try {
      const redirectUrl = typeof window !== "undefined" ? `${window.location.origin}/admin` : "/admin";
      await signInWithGoogle(redirectUrl);
    } finally {
      setIsGoogleLoggingIn(false);
    }
  };

  // Check if tables exist in Supabase
  useEffect(() => {
    async function checkDb() {
      try {
        const { error } = await supabase.from("site_content").select("section_key").limit(1);
        if (error && (error.message.includes("schema cache") || error.message.includes("does not exist"))) {
          setDbTablesMissing(true);
        } else if (!error) {
          setDbTablesMissing(false);
        }
      } catch {
        setDbTablesMissing(true);
      }
    }
    checkDb();
  }, []);

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !adminPassword) {
      toast.error("Please enter both ID/Email and Password");
      return;
    }

    setIsLoggingIn(true);
    try {
      const { error } = await signIn(adminEmail, adminPassword);
      if (error) {
        toast.error("Login failed: " + error.message);
      } else {
        toast.success("Welcome, Administrator!");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const copyMigrationSql = () => {
    const sql = `-- ============================================================
-- Reelmark — Complete Supabase Database Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. PROFILES
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text,
  avatar_url  text,
  role        text not null default 'user' check (role in ('admin', 'user')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.is_admin() returns boolean language sql stable security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    coalesce(new.raw_user_meta_data ->> 'role', case when new.email = 'admin@reelmark.com' then 'admin' else 'user' end)
  )
  on conflict (id) do update set
    username = coalesce(excluded.username, profiles.username),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
    role = coalesce(excluded.role, profiles.role);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. PRODUCTS
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
create policy "Active products are viewable by everyone" on public.products for select using (is_active = true);
create policy "Admins can view all products" on public.products for select using (public.is_admin());
create policy "Admins can insert products" on public.products for insert with check (public.is_admin());
create policy "Admins can update products" on public.products for update using (public.is_admin());
create policy "Admins can delete products" on public.products for delete using (public.is_admin());

-- 3. SITE_CONTENT
create table if not exists public.site_content (
  id           uuid primary key default gen_random_uuid(),
  section_key  text unique not null,
  text_content text not null default '',
  updated_at   timestamptz not null default now()
);

alter table public.site_content enable row level security;
create policy "Site content is viewable by everyone" on public.site_content for select using (true);
create policy "Admins can insert site content" on public.site_content for insert with check (public.is_admin());
create policy "Admins can update site content" on public.site_content for update using (public.is_admin());
create policy "Admins can delete site content" on public.site_content for delete using (public.is_admin());

-- 4. COMMENTS
create table if not exists public.comments (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid references public.products(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  comment_text  text not null,
  rating        integer check (rating between 1 and 5),
  is_approved   boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.comments enable row level security;
create policy "Approved comments are viewable by everyone" on public.comments for select using (is_approved = true);
create policy "Admins can view all comments" on public.comments for select using (public.is_admin());
create policy "Authenticated users can insert comments" on public.comments for insert with check (auth.uid() = user_id);
create policy "Users can update own comments" on public.comments for update using (auth.uid() = user_id);
create policy "Admins can update any comment" on public.comments for update using (public.is_admin());
create policy "Admins can delete any comment" on public.comments for delete using (public.is_admin());

-- 5. ORDERS
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
  status          text not null default 'processing',
  payment_status  text not null default 'paid',
  created_at      timestamptz not null default now()
);

alter table public.orders enable row level security;
create policy "Admins can view all orders" on public.orders for select using (public.is_admin());
create policy "Admins can insert orders" on public.orders for insert with check (public.is_admin());
create policy "Admins can update orders" on public.orders for update using (public.is_admin());
create policy "Admins can delete orders" on public.orders for delete using (public.is_admin());

-- Seed default Rupee content
insert into public.site_content (section_key, text_content) values
  ('hero_kicker',   'Trusted by 120,000+ flower lovers'),
  ('hero_title_1',  'Shop the Blooms'),
  ('hero_title_2',  'You Saw in Reels'),
  ('hero_subtitle', 'Hand-tied bouquets from indie florists, shown in short, snappy reels. Tap any reel to see it up close, then send it across town today.'),
  ('hero_cta',      'Shop Best Sellers'),
  ('delivery_bar',  'Same-day delivery · 7-day freshness guarantee · Free delivery over ₹999'),
  ('billing_standard_delivery', '149'),
  ('billing_express_delivery',  '249'),
  ('billing_free_shipping_threshold', '999'),
  ('billing_tax_rate', '18'),
  ('billing_currency_symbol', '₹')
on conflict (section_key) do nothing;
`;
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    toast.success("SQL migration script copied to clipboard!");
    setTimeout(() => setCopiedSql(false), 3500);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-ink-soft">Verifying admin credentials...</p>
        </div>
      </div>
    );
  }

  // Not authorized or not admin -> Show Direct Admin ID & Password Login Form
  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#faf8f5] px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-border bg-white p-8 shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground text-center">
            Reelmark Admin Portal
          </h1>
          <p className="mt-1.5 text-center text-sm text-ink-soft">
            Control pictures, copy, bouquet prices (₹) & billing.
          </p>

          {/* Quick preset helper card */}
          <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/[0.04] p-3.5 text-xs text-foreground">
            <div className="flex items-center justify-between font-semibold text-primary mb-1">
              <span className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Configured Admin Credentials
              </span>
              <button
                type="button"
                onClick={() => {
                  setAdminEmail(DEFAULT_ADMIN_EMAIL);
                  setAdminPassword(DEFAULT_ADMIN_PASS);
                  toast.success("Credentials auto-filled");
                }}
                className="text-primary hover:underline font-bold cursor-pointer"
              >
                Auto-fill
              </button>
            </div>
            <div className="space-y-0.5 text-ink-soft font-mono">
              <p>ID / Email: <span className="text-foreground font-semibold">{DEFAULT_ADMIN_EMAIL}</span></p>
              <p>Password: <span className="text-foreground font-semibold">{DEFAULT_ADMIN_PASS}</span></p>
            </div>
          </div>

          {user && !isAdmin && (
            <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
              <p className="font-semibold">Logged in as non-admin user:</p>
              <p className="truncate">{user.email}</p>
              <button
                onClick={() => signOut()}
                className="mt-2 text-xs font-semibold text-amber-900 underline cursor-pointer"
              >
                Sign out to log in as Admin
              </button>
            </div>
          )}

          {/* Sign In with Google */}
          <div className="mt-5">
            <button
              type="button"
              onClick={handleGoogleAdminLogin}
              disabled={isGoogleLoggingIn}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-[#faf8f5] px-4 py-2.5 text-sm font-semibold text-foreground shadow-xs transition-all hover:bg-neutral-100 hover:shadow-sm active:scale-[0.99] cursor-pointer disabled:opacity-70"
            >
              {isGoogleLoggingIn ? (
                <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
              ) : (
                <GoogleIcon className="h-4 w-4" />
              )}
              <span>Continue with Google</span>
            </button>
          </div>

          <div className="relative my-4 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/80" />
            </div>
            <div className="relative bg-white px-3 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
              or with Admin ID & Password
            </div>
          </div>

          {/* Direct Login Form */}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1.5 pl-1">
                Admin ID / Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                <input
                  type="email"
                  required
                  placeholder="admin@reelmark.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-[#faf8f5] py-2.5 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1.5 pl-1">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-[#faf8f5] py-2.5 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="bg-cta shadow-cta mt-2 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                "Sign In to Admin Dashboard"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Return to Reelmark Store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Authorized Admin View
  return (
    <div className="min-h-screen bg-[#faf8f5] text-foreground">
      {/* Top Admin Navigation */}
      <header className="border-b border-border/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-8">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-xs font-semibold text-ink-soft hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Storefront
            </Link>
            <span className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-black tracking-tight text-foreground">
                Reelmark
              </span>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[0.7rem] font-bold text-primary">
                Admin Control Suite
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={copyMigrationSql}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink-soft hover:text-foreground transition-colors cursor-pointer"
              title="Copy Database Migration SQL"
            >
              {copiedSql ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedSql ? "SQL Copied!" : "Copy SQL Script"}</span>
            </button>

            <span className="hidden text-xs text-ink-soft sm:inline">
              Logged in as <strong className="text-foreground">{user.email}</strong>
            </span>

            <button
              onClick={() => signOut()}
              className="rounded-full border border-border px-3.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Dashboard Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {/* Prominent Database Notice Banner if tables are pending */}
        {dbTablesMissing && (
          <div className="mb-6 rounded-3xl border-2 border-amber-300 bg-amber-50/90 p-5 shadow-sm text-amber-950">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-200 text-amber-900">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">One-Time Database Activation</h3>
                  <p className="mt-0.5 text-xs text-amber-900/80 leading-relaxed max-w-2xl">
                    Your edits are currently being updated in your <strong>live browser session</strong>. To enable <strong>permanent cloud database saving</strong> in Supabase, run the SQL script in your Supabase SQL Editor once.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={copyMigrationSql}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-950 transition-all cursor-pointer"
                >
                  {copiedSql ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedSql ? "Copied to Clipboard!" : "1. Copy SQL Script"}</span>
                </button>
                <a
                  href="https://supabase.com/dashboard/project/rvchblbsszpruaxaeljc/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-900 bg-white px-4 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100 transition-all"
                >
                  <span>2. Open Supabase SQL Editor</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("content")}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "content"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-white text-ink-soft hover:text-foreground border border-border"
              }`}
            >
              <FileText className="h-4 w-4" />
              Text & Details
            </button>

            <button
              onClick={() => setActiveTab("billing")}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "billing"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-white text-ink-soft hover:text-foreground border border-border"
              }`}
            >
              <span className="font-bold text-sm">₹</span>
              Billing & Prices
            </button>

            <button
              onClick={() => setActiveTab("media")}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "media"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-white text-ink-soft hover:text-foreground border border-border"
              }`}
            >
              <ImageIcon className="h-4 w-4" />
              Pictures & Media
            </button>

            <button
              onClick={() => setActiveTab("products")}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "products"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-white text-ink-soft hover:text-foreground border border-border"
              }`}
            >
              <Package className="h-4 w-4" />
              Products
            </button>

            <button
              onClick={() => setActiveTab("comments")}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "comments"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-white text-ink-soft hover:text-foreground border border-border"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              Reviews
            </button>
          </div>

          <a
            href="https://supabase.com/dashboard/project/rvchblbsszpruaxaeljc/sql/new"
            target="_blank"
            rel="noreferrer"
            className="hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            Supabase SQL Console <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Tab contents */}
        <div className="mt-6">
          {activeTab === "content" && <ContentManager onCopySql={copyMigrationSql} />}
          {activeTab === "billing" && <BillingManager onCopySql={copyMigrationSql} />}
          {activeTab === "media" && <MediaManager onCopySql={copyMigrationSql} />}
          {activeTab === "products" && <ProductManager onCopySql={copyMigrationSql} />}
          {activeTab === "comments" && <CommentModerator onCopySql={copyMigrationSql} />}
        </div>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 1. TEXT & CONTENT CONTROLLER (EVERY SMALL DETAIL)
 * ───────────────────────────────────────────────────────────── */
function ContentManager({ onCopySql }: { onCopySql: () => void }) {
  const { content: liveContent, saveContent } = useSiteContent();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(liveContent);
  }, [liveContent]);

  const update = (key: string, val: string) => {
    setFormData((p) => ({ ...p, [key]: val }));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await saveContent(formData);
      if (res.savedRemote) {
        toast.success("Published live to cloud database and storefront!");
      } else {
        toast.success("Changes saved live to storefront! (Run the SQL script above to persist permanently in Supabase).");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Global Site Text & Copy Controller</h2>
          <p className="text-sm text-ink-soft">
            Edit headings, descriptions, guarantee cards, and footer notices across all sections.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="bg-cta shadow-cta flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? "Publishing Changes..." : "Publish All Copy"}
        </button>
      </div>

      {/* 1. Hero & Header */}
      <div className="rounded-3xl border border-border bg-white p-6 sm:p-8 shadow-sm space-y-4">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <span>🌺</span> Hero Section & Headline
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Hero Kicker Badge</label>
            <input
              type="text"
              value={formData.hero_kicker ?? ""}
              onChange={(e) => update("hero_kicker", e.target.value)}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">CTA Button Label</label>
            <input
              type="text"
              value={formData.hero_cta ?? ""}
              onChange={(e) => update("hero_cta", e.target.value)}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Hero Heading (Line 1)</label>
            <input
              type="text"
              value={formData.hero_title_1 ?? ""}
              onChange={(e) => update("hero_title_1", e.target.value)}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm font-bold font-display focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Hero Heading (Line 2)</label>
            <input
              type="text"
              value={formData.hero_title_2 ?? ""}
              onChange={(e) => update("hero_title_2", e.target.value)}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm font-bold font-display focus:border-primary focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Hero Subtitle Paragraph</label>
            <textarea
              rows={2}
              value={formData.hero_subtitle ?? ""}
              onChange={(e) => update("hero_subtitle", e.target.value)}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 2. Delivery Guarantees */}
      <div className="rounded-3xl border border-border bg-white p-6 sm:p-8 shadow-sm space-y-4">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <span>🚚</span> 4 Delivery Promises (Delivery Bar)
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Promise 1 Title</label>
            <input
              type="text"
              value={formData.delivery_promise_1_title ?? ""}
              onChange={(e) => update("delivery_promise_1_title", e.target.value)}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2 text-xs focus:border-primary focus:outline-none"
            />
            <input
              type="text"
              value={formData.delivery_promise_1_body ?? ""}
              onChange={(e) => update("delivery_promise_1_body", e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-[#faf8f5] p-2 text-xs text-ink-soft focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Promise 2 Title</label>
            <input
              type="text"
              value={formData.delivery_promise_2_title ?? ""}
              onChange={(e) => update("delivery_promise_2_title", e.target.value)}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2 text-xs focus:border-primary focus:outline-none"
            />
            <input
              type="text"
              value={formData.delivery_promise_2_body ?? ""}
              onChange={(e) => update("delivery_promise_2_body", e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-[#faf8f5] p-2 text-xs text-ink-soft focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Promise 3 Title</label>
            <input
              type="text"
              value={formData.delivery_promise_3_title ?? ""}
              onChange={(e) => update("delivery_promise_3_title", e.target.value)}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2 text-xs focus:border-primary focus:outline-none"
            />
            <input
              type="text"
              value={formData.delivery_promise_3_body ?? ""}
              onChange={(e) => update("delivery_promise_3_body", e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-[#faf8f5] p-2 text-xs text-ink-soft focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Promise 4 Title</label>
            <input
              type="text"
              value={formData.delivery_promise_4_title ?? ""}
              onChange={(e) => update("delivery_promise_4_title", e.target.value)}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2 text-xs focus:border-primary focus:outline-none"
            />
            <input
              type="text"
              value={formData.delivery_promise_4_body ?? ""}
              onChange={(e) => update("delivery_promise_4_body", e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-[#faf8f5] p-2 text-xs text-ink-soft focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 3. Makers & Florist Mission */}
      <div className="rounded-3xl border border-border bg-white p-6 sm:p-8 shadow-sm space-y-4">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <span>👩‍🌾</span> Meet The Makers Section
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Section Kicker</label>
            <input
              type="text"
              value={formData.makers_kicker ?? ""}
              onChange={(e) => update("makers_kicker", e.target.value)}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Section Title</label>
            <input
              type="text"
              value={formData.makers_title ?? ""}
              onChange={(e) => update("makers_title", e.target.value)}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none font-bold"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Florist Mission Description</label>
            <textarea
              rows={2}
              value={formData.makers_desc ?? ""}
              onChange={(e) => update("makers_desc", e.target.value)}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 4. Newsletter & Footer */}
      <div className="rounded-3xl border border-border bg-white p-6 sm:p-8 shadow-sm space-y-4">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <span>💌</span> Newsletter & Footer Details
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Newsletter Offer Title</label>
            <input
              type="text"
              value={formData.newsletter_title ?? ""}
              onChange={(e) => update("newsletter_title", e.target.value)}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Footer Brand Tagline</label>
            <input
              type="text"
              value={formData.footer_tagline ?? ""}
              onChange={(e) => update("footer_tagline", e.target.value)}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Footer Copyright Notice</label>
            <input
              type="text"
              value={formData.footer_copyright ?? ""}
              onChange={(e) => update("footer_copyright", e.target.value)}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>
    </form>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 2. BILLING & PRICING SUITE (RUPEES ₹)
 * ───────────────────────────────────────────────────────────── */
interface OrderItem {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  items: Array<{ name: string; price: number; qty: number }>;
  subtotal: number;
  delivery_fee: number;
  tax: number;
  total_amount: number;
  status: "processing" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";
  payment_status: "paid" | "pending" | "refunded";
  created_at: string;
}

const INITIAL_MOCK_ORDERS: OrderItem[] = [
  {
    id: "ord-1",
    order_number: "RM-84920",
    customer_name: "Aarav Sharma",
    customer_email: "aarav@example.com",
    items: [
      { name: "Golden Hour Roses", price: 1999, qty: 1 },
      { name: "Handwritten Card", price: 0, qty: 1 },
    ],
    subtotal: 1999,
    delivery_fee: 0,
    tax: 359.82,
    total_amount: 2358.82,
    status: "delivered",
    payment_status: "paid",
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: "ord-2",
    order_number: "RM-84921",
    customer_name: "Pooja Patel",
    customer_email: "pooja@example.com",
    items: [{ name: "Coral Ranunculus Posy", price: 1699, qty: 1 }],
    subtotal: 1699,
    delivery_fee: 0,
    tax: 305.82,
    total_amount: 2004.82,
    status: "preparing",
    payment_status: "paid",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "ord-3",
    order_number: "RM-84922",
    customer_name: "Vikram Malhotra",
    customer_email: "vikram@example.com",
    items: [{ name: "Meadow Jar", price: 1299, qty: 1 }],
    subtotal: 1299,
    delivery_fee: 0,
    tax: 233.82,
    total_amount: 1532.82,
    status: "out_for_delivery",
    payment_status: "paid",
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
];

function BillingManager({ onCopySql }: { onCopySql: () => void }) {
  const { saveContent } = useSiteContent();
  const [products, setProducts] = useState<any[]>([]);
  const [priceUpdates, setPriceUpdates] = useState<Record<string, number>>({});
  const [isSavingPrices, setIsSavingPrices] = useState(false);

  // Fee & Delivery settings (Rupees ₹)
  const [billingSettings, setBillingSettings] = useState({
    currency_symbol: "₹",
    standard_delivery: "149",
    express_delivery: "249",
    free_shipping_threshold: "999",
    tax_rate: "18",
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Orders ledger
  const [orders, setOrders] = useState<OrderItem[]>(INITIAL_MOCK_ORDERS);
  const [selectedInvoice, setSelectedInvoice] = useState<OrderItem | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: dbProducts } = await supabase.from("products").select("*").order("price", { ascending: true });
        if (dbProducts && dbProducts.length > 0) {
          setProducts(dbProducts);
        } else {
          setProducts(bouquets);
        }

        const { data: contentData } = await supabase.from("site_content").select("section_key, text_content");
        if (contentData) {
          const map: Record<string, string> = {};
          contentData.forEach((row) => {
            map[row.section_key] = row.text_content;
          });
          setBillingSettings({
            currency_symbol: map.billing_currency_symbol || "₹",
            standard_delivery: map.billing_standard_delivery || "149",
            express_delivery: map.billing_express_delivery || "249",
            free_shipping_threshold: map.billing_free_shipping_threshold || "999",
            tax_rate: map.billing_tax_rate || "18",
          });
        }
      } catch {
        setProducts(bouquets);
      }
    }
    load();
  }, []);

  const handlePriceChange = (id: string, newPrice: number) => {
    setPriceUpdates((prev) => ({ ...prev, [id]: newPrice }));
  };

  const saveProductPrice = async (id: string) => {
    const newPrice = priceUpdates[id];
    if (newPrice === undefined || isNaN(newPrice)) return;

    setIsSavingPrices(true);
    try {
      // 1. Save local override so storefront updates instantly
      saveProductLocalOverride(id, { price: newPrice });
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, price: newPrice } : p)));

      // 2. Also save to Supabase
      const { error } = await supabase.from("products").update({ price: newPrice }).eq("id", id);
      if (error) {
        toast.success(`Price updated to ₹${newPrice.toLocaleString("en-IN")} on storefront!`);
      } else {
        toast.success(`Price updated to ₹${newPrice.toLocaleString("en-IN")} in database & storefront!`);
      }
    } finally {
      setIsSavingPrices(false);
    }
  };

  const applyBulkDiscountOrMarkup = (percentage: number) => {
    const updated: Record<string, number> = {};
    products.forEach((p) => {
      const current = priceUpdates[p.id] ?? p.price;
      const adjusted = Math.round(current * (1 + percentage / 100));
      updated[p.id] = adjusted;
    });
    setPriceUpdates((prev) => ({ ...prev, ...updated }));
    toast.info(`Adjusted all prices by ${percentage > 0 ? "+" : ""}${percentage}%. Click Save on each item to apply.`);
  };

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const updates = {
        billing_currency_symbol: billingSettings.currency_symbol,
        billing_standard_delivery: billingSettings.standard_delivery,
        billing_express_delivery: billingSettings.express_delivery,
        billing_free_shipping_threshold: billingSettings.free_shipping_threshold,
        billing_tax_rate: billingSettings.tax_rate,
      };
      await saveContent(updates);
      toast.success("Billing & shipping parameters saved!");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const updateOrderStatus = (orderId: string, status: OrderItem["status"]) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    toast.success(`Order status updated to ${status.replace("_", " ")}`);
  };

  const updatePaymentStatus = (orderId: string, payment_status: OrderItem["payment_status"]) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, payment_status } : o)));
    toast.success(`Payment status marked as ${payment_status}`);
  };

  const createSimulatedOrder = () => {
    const randomProduct = products[Math.floor(Math.random() * products.length)] || bouquets[0];
    const qty = 1;
    const subtotal = randomProduct.price * qty;
    const isFreeShip = subtotal >= parseFloat(billingSettings.free_shipping_threshold);
    const ship = isFreeShip ? 0 : parseFloat(billingSettings.standard_delivery);
    const tax = Math.round(subtotal * (parseFloat(billingSettings.tax_rate) / 100) * 100) / 100;
    const total = Math.round((subtotal + ship + tax) * 100) / 100;

    const newOrder: OrderItem = {
      id: "ord-" + Date.now(),
      order_number: "RM-" + Math.floor(10000 + Math.random() * 90000),
      customer_name: "Customer " + Math.floor(100 + Math.random() * 900),
      customer_email: "guest" + Math.floor(100 + Math.random() * 900) + "@reelmark.in",
      items: [{ name: randomProduct.title || randomProduct.name, price: randomProduct.price, qty }],
      subtotal,
      delivery_fee: ship,
      tax,
      total_amount: total,
      status: "processing",
      payment_status: "paid",
      created_at: new Date().toISOString(),
    };

    setOrders([newOrder, ...orders]);
    toast.success(`Generated test sale for ${billingSettings.currency_symbol}${total.toLocaleString("en-IN")}`);
  };

  const totalRevenue = orders
    .filter((o) => o.payment_status === "paid")
    .reduce((acc, o) => acc + o.total_amount, 0);

  return (
    <div className="space-y-8">
      {/* Financial Metrics Cards (Rupees) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Sales</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {billingSettings.currency_symbol}
            {totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </p>
          <p className="mt-0.5 text-xs text-emerald-600 font-medium">Verified customer receipts</p>
        </div>

        <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-semibold uppercase tracking-wider">Orders Processed</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">{orders.length}</p>
          <p className="mt-0.5 text-xs text-ink-soft">All-time transactions</p>
        </div>

        <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Order Value</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {billingSettings.currency_symbol}
            {(totalRevenue / (orders.length || 1)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">Per bouquet order</p>
        </div>

        <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-semibold uppercase tracking-wider">Free Delivery At</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {billingSettings.currency_symbol}
            {billingSettings.free_shipping_threshold}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">Cart minimum qualifying</p>
        </div>
      </div>

      {/* Delivery Fees & Billing Parameters Form */}
      <form onSubmit={saveSettings} className="rounded-3xl border border-border bg-white p-6 shadow-sm sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-bold text-foreground">Store Delivery & Tax Rules</h3>
            <p className="text-xs text-ink-soft">
              Configure checkout fees, free shipping order threshold and tax percentage.
            </p>
          </div>
          <button
            type="submit"
            disabled={isSavingSettings}
            className="bg-cta shadow-cta flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
          >
            {isSavingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Fee Rules
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 pt-2">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Currency Symbol</label>
            <input
              type="text"
              value={billingSettings.currency_symbol}
              onChange={(e) => setBillingSettings({ ...billingSettings, currency_symbol: e.target.value })}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm font-semibold focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Standard Delivery (₹)</label>
            <input
              type="number"
              step="1"
              value={billingSettings.standard_delivery}
              onChange={(e) => setBillingSettings({ ...billingSettings, standard_delivery: e.target.value })}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Express Surcharge (₹)</label>
            <input
              type="number"
              step="1"
              value={billingSettings.express_delivery}
              onChange={(e) => setBillingSettings({ ...billingSettings, express_delivery: e.target.value })}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Free Delivery Min (₹)</label>
            <input
              type="number"
              step="1"
              value={billingSettings.free_shipping_threshold}
              onChange={(e) => setBillingSettings({ ...billingSettings, free_shipping_threshold: e.target.value })}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">GST / Tax Rate (%)</label>
            <input
              type="number"
              step="0.01"
              value={billingSettings.tax_rate}
              onChange={(e) => setBillingSettings({ ...billingSettings, tax_rate: e.target.value })}
              className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </form>

      {/* Live Bouquet Price Matrix */}
      <div className="rounded-3xl border border-border bg-white p-6 shadow-sm sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-bold text-foreground">Live Bouquet Price Matrix (Rupees ₹)</h3>
            <p className="text-xs text-ink-soft">
              Directly edit retail price points in Rupees across your active storefront collection.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-semibold text-ink-soft mr-1">Bulk Tools:</span>
            <button
              onClick={() => applyBulkDiscountOrMarkup(10)}
              className="rounded-full border border-border px-3 py-1 hover:bg-[#faf8f5] font-semibold cursor-pointer"
            >
              +10% Markup
            </button>
            <button
              onClick={() => applyBulkDiscountOrMarkup(-10)}
              className="rounded-full border border-border px-3 py-1 hover:bg-[#faf8f5] font-semibold cursor-pointer"
            >
              -10% Sale
            </button>
            <button
              onClick={() => applyBulkDiscountOrMarkup(5)}
              className="rounded-full border border-border px-3 py-1 hover:bg-[#faf8f5] font-semibold cursor-pointer"
            >
              +5% Inflation
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#faf8f5] text-xs font-bold uppercase tracking-wider text-ink-soft border-b border-border">
              <tr>
                <th className="px-4 py-3">Bouquet</th>
                <th className="px-4 py-3">Florist Studio</th>
                <th className="px-4 py-3">Current Price</th>
                <th className="px-4 py-3">Adjusted Price</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {products.map((p) => {
                const currentVal = priceUpdates[p.id] ?? p.price;
                const isModified = priceUpdates[p.id] !== undefined && priceUpdates[p.id] !== p.price;
                return (
                  <tr key={p.id} className="hover:bg-[#faf8f5]/50">
                    <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                      <img
                        src={p.image_url || p.image}
                        alt=""
                        className="h-8 w-8 rounded-lg object-cover border border-border"
                      />
                      <span>{p.title || p.name}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{p.maker || "Indie Florist"}</td>
                    <td className="px-4 py-3 font-bold text-foreground">
                      ₹{Number(p.price).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-ink-soft">₹</span>
                        <input
                          type="number"
                          step="1"
                          value={currentVal}
                          onChange={(e) => handlePriceChange(p.id, parseFloat(e.target.value))}
                          className={`w-28 rounded-lg border p-1.5 text-sm font-bold focus:outline-none ${
                            isModified ? "border-amber-400 bg-amber-50 text-amber-900" : "border-border bg-[#faf8f5]"
                          }`}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => saveProductPrice(p.id)}
                        disabled={!isModified || isSavingPrices}
                        className={`rounded-full px-3.5 py-1 text-xs font-semibold cursor-pointer transition-all ${
                          isModified
                            ? "bg-primary text-primary-foreground shadow-sm hover:opacity-90"
                            : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                        }`}
                      >
                        Save Price
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Orders Ledger & Invoices */}
      <div className="rounded-3xl border border-border bg-white p-6 shadow-sm sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-bold text-foreground">Recent Orders & Billing Invoices</h3>
            <p className="text-xs text-ink-soft">
              Real-time checkout records, invoice generation, and fulfillment tracking.
            </p>
          </div>

          <button
            onClick={createSimulatedOrder}
            className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold hover:bg-[#faf8f5] transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Record Test Order
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#faf8f5] text-xs font-bold uppercase tracking-wider text-ink-soft border-b border-border">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Fulfillment</th>
                <th className="px-4 py-3 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-[#faf8f5]/50">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-foreground">{o.order_number}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{o.customer_name}</p>
                    <p className="text-xs text-ink-soft">{o.customer_email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground">
                    {o.items.map((it) => `${it.qty}x ${it.name}`).join(", ")}
                  </td>
                  <td className="px-4 py-3 font-bold text-foreground">
                    ₹{o.total_amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      onClick={() =>
                        updatePaymentStatus(o.id, o.payment_status === "paid" ? "refunded" : "paid")
                      }
                      className={`inline-block cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        o.payment_status === "paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : o.payment_status === "refunded"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                      }`}
                      title="Click to toggle Paid/Refunded"
                    >
                      {o.payment_status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={o.status}
                      onChange={(e) => updateOrderStatus(o.id, e.target.value as any)}
                      className="rounded-lg border border-border bg-[#faf8f5] px-2 py-1 text-xs font-semibold focus:outline-none"
                    >
                      <option value="processing">Processing</option>
                      <option value="preparing">Preparing Bouquet</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedInvoice(o)}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted cursor-pointer"
                    >
                      <Receipt className="h-3 w-3 text-primary" /> View Invoice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Viewer Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="font-display text-2xl font-black text-foreground">Reelmark</span>
                <p className="text-xs text-ink-soft">Official Flower Delivery Receipt</p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="rounded-full p-1.5 text-ink-soft hover:bg-muted cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex justify-between text-xs">
              <div>
                <p className="font-bold text-foreground">Billed To:</p>
                <p>{selectedInvoice.customer_name}</p>
                <p>{selectedInvoice.customer_email}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground">Invoice #{selectedInvoice.order_number}</p>
                <p>Date: {new Date(selectedInvoice.created_at).toLocaleDateString()}</p>
                <p>Payment: <strong className="text-emerald-700">{selectedInvoice.payment_status.toUpperCase()}</strong></p>
              </div>
            </div>

            <div className="border-t border-b border-border py-3 space-y-2 text-xs">
              {selectedInvoice.items.map((item, idx) => (
                <div key={idx} className="flex justify-between font-medium">
                  <span>{item.qty}x {item.name}</span>
                  <span>₹{(item.price * item.qty).toLocaleString("en-IN")}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-border/40 text-ink-soft">
                <span>Subtotal</span>
                <span>₹{selectedInvoice.subtotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-ink-soft">
                <span>Same-day Courier Delivery</span>
                <span>{selectedInvoice.delivery_fee === 0 ? "FREE" : `₹${selectedInvoice.delivery_fee.toLocaleString("en-IN")}`}</span>
              </div>
              <div className="flex justify-between text-ink-soft">
                <span>GST Tax ({billingSettings.tax_rate}%)</span>
                <span>₹{selectedInvoice.tax.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-foreground pt-2 border-t border-border">
                <span>Total Amount Charged</span>
                <span className="text-primary">₹{selectedInvoice.total_amount.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-muted cursor-pointer"
              >
                <Printer className="h-4 w-4" /> Print Receipt
              </button>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="bg-cta rounded-full px-5 py-2 text-xs font-semibold text-primary-foreground shadow-cta cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 3. PICTURES & MEDIA CONTROLLER
 * ───────────────────────────────────────────────────────────── */
interface MediaCard {
  key: string;
  label: string;
  section: string;
  defaultSrc: string;
}

const MEDIA_TARGETS: MediaCard[] = [
  {
    key: "image_hero_floral_top",
    label: "Hero Top Floral Spray",
    section: "Header Corners (Animated in GSAP)",
    defaultSrc: floralTopDefault,
  },
  {
    key: "image_hero_floral_bottom",
    label: "Hero Bottom Floral Corner",
    section: "Bottom Corners (Animated in GSAP)",
    defaultSrc: floralBottomDefault,
  },
  {
    key: "image_bouquet_center",
    label: "Bouquet Gallery Center Spotlight",
    section: "Central Bouquet in Orbit Section",
    defaultSrc: bouquetCenterDefault,
  },
  {
    key: "image_maker_1",
    label: "Florist: Rosa Alvarez",
    section: "Makers Showcase (Petalcraft Studio)",
    defaultSrc: maker1Default,
  },
  {
    key: "image_maker_2",
    label: "Florist: Theo Marsh",
    section: "Makers Showcase (Field & Stem)",
    defaultSrc: maker2Default,
  },
  {
    key: "image_maker_3",
    label: "Florist: Meera Iyer",
    section: "Makers Showcase (Stillwater)",
    defaultSrc: maker3Default,
  },
  {
    key: "image_maker_4",
    label: "Florist: Ama Boateng",
    section: "Makers Showcase (Wildroot)",
    defaultSrc: maker4Default,
  },
];

function MediaManager({ onCopySql }: { onCopySql: () => void }) {
  const { content: liveContent, saveContent } = useSiteContent();
  const [inputUrls, setInputUrls] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    setInputUrls(liveContent);
  }, [liveContent]);

  const handleUpdateImage = async (key: string) => {
    const url = inputUrls[key];
    setSavingKey(key);
    try {
      await saveContent({ [key]: url || "" });
      toast.success("Picture updated live across the website!");
    } finally {
      setSavingKey(null);
    }
  };

  const resetImageToDefault = async (key: string) => {
    setInputUrls((prev) => ({ ...prev, [key]: "" }));
    setSavingKey(key);
    try {
      await saveContent({ [key]: "" });
      toast.success("Reset picture to original high-res asset");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Pictures & Visual Media Control</h2>
          <p className="text-sm text-ink-soft">
            Change any photo on the website instantly — floral corners, center bouquet, florist profiles and bouquet covers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {MEDIA_TARGETS.map((target) => {
          const activeUrl = inputUrls[target.key];
          const displaySrc = activeUrl && activeUrl.trim().length > 0 ? activeUrl : target.defaultSrc;
          const isCustom = Boolean(activeUrl && activeUrl.trim().length > 0);

          return (
            <div key={target.key} className="rounded-3xl border border-border bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-display text-base font-bold text-foreground">{target.label}</h4>
                  <p className="text-[0.7rem] text-ink-soft">{target.section}</p>
                </div>
                {isCustom && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-bold text-emerald-800">
                    Custom Active
                  </span>
                )}
              </div>

              {/* Picture Preview */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border bg-[#faf8f5]">
                <img
                  src={displaySrc}
                  alt={target.label}
                  className="h-full w-full object-contain p-2"
                />
              </div>

              {/* URL input and action */}
              <div className="space-y-2">
                <label className="block text-[0.7rem] font-semibold text-foreground/80">
                  Image Source URL (WebP, JPG, PNG)
                </label>
                <input
                  type="url"
                  placeholder="Paste https:// image URL or leave empty for default"
                  value={inputUrls[target.key] ?? ""}
                  onChange={(e) => setInputUrls({ ...inputUrls, [target.key]: e.target.value })}
                  className="w-full rounded-xl border border-border bg-[#faf8f5] p-2 text-xs focus:border-primary focus:bg-white focus:outline-none"
                />

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleUpdateImage(target.key)}
                    disabled={savingKey === target.key}
                    className="flex-1 bg-cta shadow-cta flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                  >
                    {savingKey === target.key ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    Apply Picture
                  </button>

                  {isCustom && (
                    <button
                      onClick={() => resetImageToDefault(target.key)}
                      title="Reset to original asset"
                      className="rounded-full border border-border p-2 text-xs hover:bg-[#faf8f5] cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-ink-soft" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 4. PRODUCT CATALOG MANAGER
 * ───────────────────────────────────────────────────────────── */
function ProductManager({ onCopySql }: { onCopySql: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // New product form state
  const [title, setTitle] = useState("");
  const [maker, setMaker] = useState("Field & Stem");
  const [price, setPrice] = useState("1499");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [flowers, setFlowers] = useState("garden roses, mimosa, eucalyptus");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) {
        setProducts(bouquets);
      } else {
        setProducts(data);
      }
    } catch {
      setProducts(bouquets);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAddProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!title || !price) {
      toast.error("Please fill in Title and Price");
      return;
    }

    setIsSubmitting(true);
    try {
      const flowersList = flowers.split(",").map((f) => f.trim()).filter(Boolean);

      const { error } = await supabase.from("products").insert({
        title,
        maker,
        price: parseFloat(price),
        image_url: imageUrl || "https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=800&q=80",
        description,
        flowers: flowersList,
        is_active: true,
      });

      if (error) {
        toast.error("Could not add to database: " + error.message);
      } else {
        toast.success(`Bouquet "${title}" added to catalog!`);
        setTitle("");
        setPrice("1499");
        setImageUrl("");
        setDescription("");
        setShowAddForm(false);
        fetchProducts();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProductActive = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("products")
      .update({ is_active: !current })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
    } else {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_active: !current } : p))
      );
      toast.success(`Product ${!current ? "activated" : "hidden"}`);
    }
  };

  const deleteProduct = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success(`Deleted "${title}"`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Catalog & Bouquets (₹)</h2>
          <p className="text-sm text-ink-soft">
            Manage your live bouquet collection, add high-resolution pictures and floral details.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-cta shadow-cta flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          {showAddForm ? "Close Form" : "Add New Bouquet"}
        </button>
      </div>

      {/* Add New Product Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddProduct}
          className="rounded-3xl border border-border bg-white p-6 shadow-sm sm:p-8 space-y-4"
        >
          <h3 className="font-display text-lg font-bold text-foreground">Create New Bouquet</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1">
                Bouquet Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Amber Sunrise Posy"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1">
                Indie Florist / Maker
              </label>
              <input
                type="text"
                placeholder="e.g. Field & Stem"
                value={maker}
                onChange={(e) => setMaker(e.target.value)}
                className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1">
                Price in Rupees (₹) *
              </label>
              <input
                type="number"
                step="1"
                required
                placeholder="e.g. 1699"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1">
                Image URL
              </label>
              <input
                type="url"
                placeholder="https://... image link"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-foreground/80 mb-1">
                Included Flowers (comma separated)
              </label>
              <input
                type="text"
                placeholder="ranunculus, garden roses, mimosa, eucalyptus"
                value={flowers}
                onChange={(e) => setFlowers(e.target.value)}
                className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-foreground/80 mb-1">
                Short Description / Floral Blurb
              </label>
              <textarea
                rows={2}
                placeholder="Warm honey tones, sun-drenched garden roses and textured foliage in artisanal wrap."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-border bg-[#faf8f5] p-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-cta rounded-full px-6 py-2 text-sm font-semibold text-primary-foreground shadow-cta cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Publish Bouquet"}
            </button>
          </div>
        </form>
      )}

      {/* Product Table */}
      <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-ink-soft">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />
            Loading catalog...
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-sm text-ink-soft">
            No products found. Click "Add New Bouquet" above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#faf8f5] text-xs font-bold uppercase tracking-wider text-ink-soft border-b border-border">
                <tr>
                  <th className="px-6 py-3.5">Bouquet</th>
                  <th className="px-6 py-3.5">Florist</th>
                  <th className="px-6 py-3.5">Price (₹)</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-[#faf8f5]/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.image_url || p.image}
                          alt=""
                          className="h-10 w-10 rounded-xl object-cover border border-border shrink-0"
                        />
                        <div>
                          <p className="font-semibold text-foreground">{p.title || p.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {p.description || p.blurb || (p.flowers?.join(", "))}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-ink-soft">{p.maker || "Indie Florist"}</td>
                    <td className="px-6 py-4 font-bold text-foreground">
                      ₹{Number(p.price).toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleProductActive(p.id, p.is_active ?? true)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold cursor-pointer ${
                          p.is_active !== false
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.is_active !== false ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> Live
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" /> Draft
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => deleteProduct(p.id, p.title || p.name)}
                        className="rounded-full p-2 text-ink-soft hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Delete product"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 5. COMMENT & REVIEW MODERATOR
 * ───────────────────────────────────────────────────────────── */
function CommentModerator({ onCopySql }: { onCopySql: () => void }) {
  const [comments, setComments] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");
  const [loading, setLoading] = useState(true);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("comments")
        .select(`
          id,
          product_id,
          user_id,
          comment_text,
          rating,
          is_approved,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setComments(data);
      } else {
        setComments([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, []);

  const toggleApproval = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("comments")
      .update({ is_approved: !current })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
    } else {
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_approved: !current } : c))
      );
      toast.success(`Comment ${!current ? "approved" : "unapproved"}`);
    }
  };

  const deleteComment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      setComments((prev) => prev.filter((c) => c.id !== id));
      toast.success("Comment deleted");
    }
  };

  const filteredComments = comments.filter((c) => {
    if (filter === "pending") return !c.is_approved;
    if (filter === "approved") return c.is_approved;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">User Reviews & Comments</h2>
          <p className="text-sm text-ink-soft">
            Moderate community reviews before they appear publicly on the storefront marquee.
          </p>
        </div>

        <div className="flex gap-1.5 rounded-full bg-white p-1 border border-border text-xs font-semibold">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1 cursor-pointer ${
              filter === "all" ? "bg-primary text-primary-foreground" : "text-ink-soft"
            }`}
          >
            All ({comments.length})
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`rounded-full px-3 py-1 cursor-pointer ${
              filter === "pending" ? "bg-amber-500 text-white" : "text-ink-soft"
            }`}
          >
            Pending ({comments.filter((c) => !c.is_approved).length})
          </button>
          <button
            onClick={() => setFilter("approved")}
            className={`rounded-full px-3 py-1 cursor-pointer ${
              filter === "approved" ? "bg-emerald-600 text-white" : "text-ink-soft"
            }`}
          >
            Approved ({comments.filter((c) => c.is_approved).length})
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-ink-soft">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />
            Loading reviews...
          </div>
        ) : filteredComments.length === 0 ? (
          <div className="p-12 text-center text-sm text-ink-soft">
            No customer comments found in this view.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#faf8f5] text-xs font-bold uppercase tracking-wider text-ink-soft border-b border-border">
                <tr>
                  <th className="px-6 py-3.5">Reviewer</th>
                  <th className="px-6 py-3.5">Rating</th>
                  <th className="px-6 py-3.5">Review Content</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredComments.map((c) => (
                  <tr key={c.id} className="hover:bg-[#faf8f5]/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">
                      Customer
                    </td>
                    <td className="px-6 py-4 text-amber-500 font-bold">
                      {"★".repeat(c.rating || 5)}
                    </td>
                    <td className="px-6 py-4 max-w-md text-foreground">
                      "{c.comment_text}"
                    </td>
                    <td className="px-6 py-4 text-xs text-ink-soft">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          c.is_approved
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {c.is_approved ? "Approved" : "Pending"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => toggleApproval(c.id, c.is_approved)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold cursor-pointer ${
                          c.is_approved
                            ? "border border-border text-ink-soft hover:bg-muted"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {c.is_approved ? "Unapprove" : "Approve"}
                      </button>
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="rounded-full p-1.5 text-ink-soft hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Delete review"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
