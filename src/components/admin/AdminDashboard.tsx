import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { getAdminDashboard } from "@/lib/admin.functions";
import { unwrap } from "@/lib/result";
import { BillingPanel, CopyPanel, PicturesPanel } from "./ContentPanels";
import { CustomersPanel } from "./CustomersPanel";
import { OrdersPanel } from "./OrdersPanel";
import { OverviewPanel, type AdminTab } from "./OverviewPanel";
import { ProductsPanel } from "./ProductsPanel";
import { ReviewsPanel } from "./ReviewsPanel";
import { SetupBanner } from "./SetupBanner";
import { ErrorNote, LoadingRows } from "./shared";

const TABS: { id: AdminTab; label: string; icon: typeof Package }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "orders", label: "Orders", icon: Receipt },
  { id: "products", label: "Bouquets & prices", icon: Package },
  { id: "copy", label: "Copy", icon: FileText },
  { id: "pictures", label: "Pictures", icon: ImageIcon },
  { id: "billing", label: "Billing & promo", icon: Wallet },
  { id: "reviews", label: "Reviews", icon: MessageSquare },
  { id: "customers", label: "Customers", icon: Users },
];

export function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<AdminTab>("overview");
  const dashboard = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => unwrap(await getAdminDashboard()),
    refetchInterval: 60_000,
  });
  const pendingReviews = dashboard.data?.stats?.pendingReviews ?? 0;
  const openOrders = dashboard.data?.stats?.ordersOpen ?? 0;

  return (
    <div className="min-h-screen bg-[#faf8f5] text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-2">
            <Link to="/" className="font-display text-lg font-black tracking-tight">
              Reelmark
            </Link>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[0.7rem] font-bold text-primary">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-foreground sm:inline-flex"
            >
              View store <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <span className="hidden max-w-[200px] truncate text-xs text-ink-soft md:inline">
              {user?.email}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Log out
            </button>
          </div>
        </div>
        <nav aria-label="Admin sections" className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-8">
          <ul className="flex gap-1 pb-2">
            {TABS.map(({ id, label, icon: Icon }) => {
              const badge = id === "reviews" ? pendingReviews : id === "orders" ? openOrders : 0;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setTab(id)}
                    aria-current={tab === id ? "page" : undefined}
                    className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
                      tab === id
                        ? "bg-primary text-primary-foreground"
                        : "text-ink-soft hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                    {badge > 0 && (
                      <span
                        className={`rounded-full px-1.5 text-[0.65rem] font-bold ${
                          tab === id ? "bg-white/25" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
        {dashboard.data && <SetupBanner setup={dashboard.data.setup} />}

        {tab === "overview" &&
          (dashboard.isPending ? (
            <LoadingRows />
          ) : dashboard.isError ? (
            <ErrorNote message={dashboard.error.message} />
          ) : (
            <OverviewPanel data={dashboard.data} onOpen={setTab} />
          ))}
        {tab === "orders" && <OrdersPanel />}
        {tab === "products" && <ProductsPanel />}
        {tab === "copy" && <CopyPanel />}
        {tab === "pictures" && <PicturesPanel />}
        {tab === "billing" && <BillingPanel />}
        {tab === "reviews" && <ReviewsPanel />}
        {tab === "customers" && <CustomersPanel />}
      </main>
    </div>
  );
}
