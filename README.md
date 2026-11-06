# 🌸 Reelmark — Fresh Bouquets from Indie Florists

A modern flower-shop storefront with a 3D GSAP reel carousel, an AI bouquet finder, a full
checkout, shopper accounts and an admin dashboard — all connected through one Supabase database.

---

## ✨ What's inside

**Storefront (`/`)**
- 3D reel carousel — tap a reel to bring it forward, tap again to open the bouquet.
- Bag & checkout: sender and recipient details, delivery date (same-day until 2pm IST),
  standard or express delivery, free handwritten card, promo codes, pay on delivery.
- AI bouquet finder that only ever recommends bouquets within the shopper's budget.
- Reviews (published after admin approval) and a newsletter that hands out the welcome code.

**My orders (`/account`)**
- Signed-in shoppers see every order with a live delivery timeline and their review statuses.
- Guests track an order with its number and email.

**Admin (`/admin`)**
- Orders: search, move through placed → confirmed → hand-tied → out for delivery → delivered,
  mark payments, internal notes, printable invoices.
- Bouquets & prices: edit any bouquet, upload photos, hide/show, best-seller flags, add new ones.
- Copy, pictures, billing (delivery fees, GST, free-delivery minimum) and the promo code.
- Review moderation, customers (with admin role management) and newsletter subscribers.

Everything an admin saves is live for every shopper on their next page load (and instantly in
other tabs of the same browser).

---

## 🔐 How the pieces connect

```
Browser ──(Firebase or Supabase sign-in token)──▶ server functions ──(service-role key)──▶ Supabase
```

- Shoppers sign in with **Google (Firebase)** or **email & password (Supabase)**.
- The browser never writes to the database. Server functions (`src/lib/*.functions.ts`) verify the
  caller's token, decide what they may do, and only then use the service-role key.
- Admin access is decided on the server: an email in `ADMIN_EMAILS` (verified) or
  `profiles.role = 'admin'`.
- Order totals are always recalculated on the server from the live catalog and billing rules.

---

## 🚀 Getting started

### 1. Install
```bash
npm install
```

### 2. Environment
Copy `.env.example` to `.env.local` and fill it in. The important server-only values:

| Variable | Why |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Lets the server save orders, reviews and admin edits |
| `ADMIN_EMAILS` | Comma-separated emails allowed into `/admin` |
| `LOVABLE_API_KEY` | Lets the AI florist pick bouquets and write card notes (without it the finder uses rule-based matching) |

### 3. Create the database tables (once)
Open **Supabase → SQL Editor**, paste
[`supabase/migrations/20261106120000_reelmark_schema.sql`](supabase/migrations/20261106120000_reelmark_schema.sql)
and press **Run**. (The admin dashboard also offers a *Copy setup SQL* button.) It is safe to
run again.

### 4. Run
```bash
npm run dev
```
Open http://localhost:5173 — the admin dashboard is at `/admin`.

### Deploying (Vercel / Lovable)
Add the same environment variables in your hosting dashboard (server-only ones without the
`VITE_` prefix), redeploy, and add your site's domain to **Firebase → Authentication →
Settings → Authorized domains** so Google sign-in works there.

---

## 🧪 Checks
```bash
npm test        # vitest: pricing, catalog merge, checkout validation and UI, server order placement, finder matching
npm run lint
npx tsc --noEmit
```

## 🛠️ Tech stack
React 19 · TanStack Start & Router · Tailwind CSS · Radix UI · GSAP · Supabase (Postgres + RLS +
Storage) · Firebase Auth · AI SDK via Lovable AI Gateway · Vite · Vitest

## 📜 License
MIT
