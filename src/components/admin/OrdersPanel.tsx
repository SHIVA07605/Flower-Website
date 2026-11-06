import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Phone, Printer, RefreshCw, Search } from "lucide-react";

import {
  DeliveryInfo,
  formatOrderTime,
  OrderItems,
  OrderTotals,
  PaymentPill,
  StatusPill,
} from "@/components/orders/OrderDetails";
import { formatPrice } from "@/components/shop/products";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { listAdminOrders, updateAdminOrder } from "@/lib/admin.functions";
import type { OrderUpdateInput } from "@/lib/admin-types";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUSES,
  type OrderRecord,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders";
import { unwrap } from "@/lib/result";
import { adminInput, EmptyState, ErrorNote, LoadingRows, Panel, useAdminAction } from "./shared";

const select =
  "rounded-lg border border-border bg-[#faf8f5] px-2 py-1.5 text-xs font-semibold outline-none focus:border-primary";

export function OrdersPanel() {
  const [status, setStatus] = useState("open");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query = useQuery({
    queryKey: ["admin", "orders", status, search],
    queryFn: async () =>
      unwrap(
        await listAdminOrders({
          data: {
            ...(status !== "all" ? { status } : {}),
            ...(search ? { search } : {}),
          },
        }),
      ),
    refetchInterval: 30_000,
  });

  const update = useAdminAction((input: OrderUpdateInput) => updateAdminOrder({ data: input }), {
    success: (o) => `${o.orderNumber} updated — the shopper sees it on their orders page.`,
    invalidate: [
      ["admin", "orders"],
      ["admin", "dashboard"],
    ],
  });

  const orders = query.data ?? [];
  const selected = orders.find((o) => o.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Orders</h2>
          <p className="text-sm text-ink-soft">
            Move each order along as the florist works — shoppers follow the same steps live.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-soft hover:text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Search orders</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            className={`${adminInput} pl-9`}
            placeholder="Order number, name, email or phone"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter by status"
          className={`${adminInput} w-auto`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="open">Open orders</option>
          <option value="all">All orders</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <Panel className="!p-0 overflow-hidden">
        {query.isPending ? (
          <LoadingRows />
        ) : query.isError ? (
          <div className="p-5">
            <ErrorNote message={query.error.message} />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState>No orders match this view.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-border bg-[#faf8f5] text-[0.7rem] font-bold uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {orders.map((o) => (
                  <tr key={o.id} className="align-top hover:bg-[#faf8f5]/60">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-bold">{o.orderNumber}</p>
                      <p className="text-xs text-ink-soft">{formatOrderTime(o.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{o.customerName}</p>
                      <p className="text-xs text-ink-soft">{o.customerEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p className="font-semibold">{o.deliveryDate}</p>
                      <p className="text-ink-soft">
                        {o.deliverySlot === "express" ? "Express" : "Standard"} · {o.city}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-bold">{formatPrice(o.total)}</td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Status of ${o.orderNumber}`}
                        className={select}
                        value={o.status}
                        disabled={update.isPending}
                        onChange={(e) =>
                          update.mutate({ id: o.id, status: e.target.value as OrderStatus })
                        }
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {ORDER_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Payment of ${o.orderNumber}`}
                        className={select}
                        value={o.paymentStatus}
                        disabled={update.isPending}
                        onChange={(e) =>
                          update.mutate({
                            id: o.id,
                            paymentStatus: e.target.value as PaymentStatus,
                          })
                        }
                      >
                        {PAYMENT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {PAYMENT_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedId(o.id)}
                        className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <OrderSheet
        order={selected}
        saving={update.isPending}
        onClose={() => setSelectedId(null)}
        onSaveNote={(adminNote) => selected && update.mutate({ id: selected.id, adminNote })}
      />
    </div>
  );
}

function OrderSheet({
  order,
  saving,
  onClose,
  onSaveNote,
}: {
  order: OrderRecord | null;
  saving: boolean;
  onClose: () => void;
  onSaveNote: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  useEffect(() => setNote(order?.adminNote ?? ""), [order?.id, order?.adminNote]);

  return (
    <Sheet open={order !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {order && (
          <div className="space-y-5" data-print-area>
            <div>
              <SheetTitle className="font-display text-2xl font-bold">
                {order.orderNumber}
              </SheetTitle>
              <SheetDescription>Placed {formatOrderTime(order.createdAt)}</SheetDescription>
              <div className="mt-2 flex gap-1.5">
                <StatusPill status={order.status} />
                <PaymentPill status={order.paymentStatus} />
              </div>
            </div>

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Customer
              </h3>
              <p className="font-semibold">{order.customerName}</p>
              <p className="flex items-center gap-1.5 text-sm text-ink-soft">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                <a href={`mailto:${order.customerEmail}`} className="hover:underline">
                  {order.customerEmail}
                </a>
              </p>
              <p className="flex items-center gap-1.5 text-sm text-ink-soft">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                <a href={`tel:+91${order.customerPhone}`} className="hover:underline">
                  {order.customerPhone}
                </a>
              </p>
            </section>

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Delivery
              </h3>
              <DeliveryInfo order={order} />
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Items
              </h3>
              <OrderItems order={order} />
              <OrderTotals order={order} />
              <p className="mt-1 text-xs text-ink-soft">Payment: pay on delivery (cash / UPI)</p>
            </section>

            <section className="print:hidden">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Internal note (only admins see this)
                </span>
                <textarea
                  className={`${adminInput} resize-none`}
                  rows={3}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Rider assigned, recipient prefers evening"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || note === order.adminNote}
                  onClick={() => onSaveNote(note)}
                  className="bg-cta cursor-pointer rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Save note
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Print invoice
                </button>
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
