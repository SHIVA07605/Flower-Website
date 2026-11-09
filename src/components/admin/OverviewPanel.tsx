import { Mail, MessageSquare, Package, Receipt, TrendingUp, Users } from "lucide-react";

import { formatOrderTime, PaymentPill, StatusPill } from "@/components/orders/OrderDetails";
import { formatPrice } from "@/components/shop/products";
import type { AdminDashboardData } from "@/lib/admin-types";
import { EmptyState, Panel } from "./shared";

export type AdminTab =
  | "overview"
  | "orders"
  | "products"
  | "copy"
  | "pictures"
  | "billing"
  | "reviews"
  | "customers"
  | "access";

export function OverviewPanel({
  data,
  onOpen,
}: {
  data: AdminDashboardData;
  onOpen: (tab: AdminTab) => void;
}) {
  const { stats, recentOrders } = data;
  if (!stats) {
    return (
      <Panel>
        <EmptyState>
          Store numbers will appear here once the database is connected (see the steps above).
        </EmptyState>
      </Panel>
    );
  }

  const cards = [
    {
      label: "Paid revenue",
      value: formatPrice(stats.revenue),
      note: "Orders marked paid",
      icon: TrendingUp,
      tab: "orders" as const,
    },
    {
      label: "Open orders",
      value: stats.ordersOpen,
      note: `${stats.ordersToday} placed today · ${stats.ordersTotal} all time`,
      icon: Package,
      tab: "orders" as const,
    },
    {
      label: "Reviews to approve",
      value: stats.pendingReviews,
      note: "Waiting for moderation",
      icon: MessageSquare,
      tab: "reviews" as const,
    },
    {
      label: "Customers",
      value: stats.customers,
      note: "Signed-in shoppers",
      icon: Users,
      tab: "customers" as const,
    },
    {
      label: "Newsletter",
      value: stats.subscribers,
      note: "Subscribers",
      icon: Mail,
      tab: "customers" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map(({ label, value, note, icon: Icon, tab }) => (
          <button
            key={label}
            type="button"
            onClick={() => onOpen(tab)}
            className="cursor-pointer rounded-3xl border border-border bg-white p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5 sm:p-5"
          >
            <span className="flex items-center justify-between text-ink-soft">
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider">{label}</span>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="mt-2 block font-display text-2xl font-bold text-foreground">
              {value}
            </span>
            <span className="mt-0.5 block text-xs text-ink-soft">{note}</span>
          </button>
        ))}
      </div>

      <Panel
        title="Latest orders"
        description="New orders appear here the moment a shopper checks out."
        actions={
          <button
            type="button"
            onClick={() => onOpen("orders")}
            className="cursor-pointer text-xs font-semibold text-primary hover:underline"
          >
            Manage all orders →
          </button>
        }
      >
        {recentOrders.length === 0 ? (
          <EmptyState>
            <Receipt className="mx-auto mb-2 h-6 w-6" aria-hidden="true" />
            No orders yet. They'll show up here as soon as shoppers check out.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border/60">
            {recentOrders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-24 font-mono text-xs font-bold">{o.orderNumber}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{o.customerName}</span>
                  <span className="block text-xs text-ink-soft">
                    {formatOrderTime(o.createdAt)} ·{" "}
                    {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                  </span>
                </span>
                <span className="text-sm font-bold">{formatPrice(o.total)}</span>
                <StatusPill status={o.status} />
                <PaymentPill status={o.paymentStatus} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
