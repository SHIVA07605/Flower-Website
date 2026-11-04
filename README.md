# 🌸 Reelmark — Fresh Bouquets from Indie Florists

> A hyper-premium, modern e-commerce storefront for artisanal floral studios, featuring an interactive 3D GSAP reel carousel, streaming AI bouquet finder, full-stack content management, and dual Firebase/Supabase authentication.

---

## ✨ Key Features

- **🪄 3D Interactive Arc Carousel**: Smooth 3D perspective transforms with GSAP animations and physics-based card hover effects, fully accessible with `prefers-reduced-motion` support.
- **🤖 AI-Powered Bouquet Finder**: Intelligent, streaming AI assistant that filters catalogs strictly by occasions, floral preferences, and shopper budget before recommendations.
- **🔐 Dual Authentication**:
  - One-click **Google OAuth via Firebase** (popup flow with instant session sync & avatar rendering).
  - Native **Supabase Email & Password** auth with role-based access control (Admin & Shopper).
- **🛠️ Master Admin Portal (`/admin`)**:
  - **Text & Copy Controller**: Edit headings, kickers, delivery promises, and footers with immediate live-storefront reflection.
  - **Billing & Prices (₹ INR)**: Real-time price overrides, bulk markup/discount calculators, customizable delivery thresholds, and printable customer receipts.
  - **Media & Asset Manager**: Swap hero floral corners, spotlight bouquets, and florist portraits directly from the dashboard.
  - **Catalog & Review Moderation**: Live catalog management and review approval system.
- **⚡ Dual-Layer Persistence**: Edits reflect immediately in the live browser via synchronized caching, backed by automated cloud database migrations.

---

## 🛠️ Tech Stack

- **Framework**: React 19, [TanStack Start](https://tanstack.com/start) & TanStack Router
- **Styling**: Tailwind CSS, Radix UI Primitives, Lucide Icons
- **Animations**: GSAP (GreenSock Animation Platform) + 3D CSS transforms
- **Backend & Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Firebase Auth (Google OAuth) + Supabase Auth
- **AI Engine**: AI SDK Gateway with streamed structured responses
- **Bundler & Tooling**: Vite, Vitest, Nitro

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/SHIVA07605/Flower-Website.git
cd Flower-Website
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory (see `.env.example`):
```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Firebase
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📜 License
Licensed under the MIT License.
