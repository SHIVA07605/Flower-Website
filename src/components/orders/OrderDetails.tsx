import { Check } from "lucide-react";

import { formatPrice } from "@/components/shop/products";
import {
  DELIVERY_SLOT_LABEL,
  formatDeliveryDate,
  FULFILMENT_STEPS,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  type OrderRecord,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders";

const STATUS_STYLE: Record<OrderStatus, string> = {
  placed: "bg-sky-100 text-sky-800",
  confirmed: "bg-indigo-100 text-indigo-800",
  preparing: "bg-amber-100 text-amber-800",
  out_for_delivery: "bg-violet-100 text-violet-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

const PAYMENT_STYLE: Record<PaymentStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  paid: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  refunded: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  failed: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[status]}`}
    >
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

export function PaymentPill({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PAYMENT_STYLE[status]}`}
    >
      {PAYMENT_STATUS_LABEL[status]}
    </span>
  );
}

export function formatOrderTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Placed → confirmed → hand-tied → out for delivery → delivered. */
export function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
        This order was cancelled. If you were charged, the refund is on its way.
      </p>
    );
  }
  const current = FULFILMENT_STEPS.indexOf(status);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Order progress">
      {FULFILMENT_STEPS.map((step, i) => {
        const done = i <= current;
        return (
          <li key={step} className="flex flex-col items-center text-center">
            <span className="flex w-full items-center">
              <span
                className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : done ? "bg-primary" : "bg-border"}`}
              />
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  done ? "bg-primary text-primary-foreground" : "bg-muted text-ink-soft"
                } ${i === current ? "ring-4 ring-primary/15" : ""}`}
                aria-current={i === current ? "step" : undefined}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span
                className={`h-0.5 flex-1 ${i === FULFILMENT_STEPS.length - 1 ? "opacity-0" : i < current ? "bg-primary" : "bg-border"}`}
              />
            </span>
            <span
              className={`mt-1.5 text-[0.65rem] leading-tight sm:text-xs ${done ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              {ORDER_STATUS_LABEL[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderItems({ order }: { order: OrderRecord }) {
  return (
    <ul className="divide-y divide-border/60">
      {order.items.map((item, i) => (
        <li key={`${item.id}-${i}`} className="flex items-center gap-3 py-2.5">
          {item.image ? (
            <img src={item.image} alt="" className="h-12 w-10 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="h-12 w-10 shrink-0 rounded-lg bg-muted" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">
              {item.name}
            </span>
            <span className="block text-xs text-muted-foreground">
              {item.qty} × {formatPrice(item.price)}
              {item.maker ? ` · ${item.maker}` : ""}
            </span>
          </span>
          <span className="text-sm font-semibold">{formatPrice(item.price * item.qty)}</span>
        </li>
      ))}
    </ul>
  );
}

export function OrderTotals({ order }: { order: OrderRecord }) {
  return (
    <dl className="space-y-1 text-sm">
      <div className="flex justify-between text-muted-foreground">
        <dt>Subtotal</dt>
        <dd>{formatPrice(order.subtotal)}</dd>
      </div>
      {order.discount > 0 && (
        <div className="flex justify-between text-primary">
          <dt>Discount{order.promoCode ? ` (${order.promoCode})` : ""}</dt>
          <dd>−{formatPrice(order.discount)}</dd>
        </div>
      )}
      <div className="flex justify-between text-muted-foreground">
        <dt>Delivery</dt>
        <dd>{order.deliveryFee === 0 ? "Free" : formatPrice(order.deliveryFee)}</dd>
      </div>
      {order.tax > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <dt>GST</dt>
          <dd>{formatPrice(order.tax)}</dd>
        </div>
      )}
      <div className="flex justify-between border-t border-border pt-1.5 font-bold text-foreground">
        <dt>Total</dt>
        <dd>{formatPrice(order.total)}</dd>
      </div>
    </dl>
  );
}

export function DeliveryInfo({ order }: { order: OrderRecord }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="font-semibold text-foreground">
        {formatDeliveryDate(order.deliveryDate)} · {DELIVERY_SLOT_LABEL[order.deliverySlot]}
      </p>
      <p className="text-muted-foreground">
        For {order.recipientName} ({order.recipientPhone})
      </p>
      <p className="text-muted-foreground">
        {order.address}, {order.city} {order.pincode}
      </p>
      {order.cardMessage && (
        <p className="mt-2 rounded-xl bg-gold-soft px-3 py-2 font-hand text-lg leading-6 text-foreground">
          "{order.cardMessage}"
        </p>
      )}
    </div>
  );
}

/** The full order as a shopper sees it. */
export function OrderCard({ order }: { order: OrderRecord }) {
  return (
    <article className="paper-panel rounded-3xl p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-foreground">{order.orderNumber}</p>
          <p className="text-xs text-muted-foreground">Placed {formatOrderTime(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusPill status={order.status} />
          <PaymentPill status={order.paymentStatus} />
        </div>
      </header>
      <div className="mt-5">
        <OrderTimeline status={order.status} />
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Bouquets</h3>
          <OrderItems order={order} />
          <div className="mt-2">
            <OrderTotals order={order} />
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Delivery
          </h3>
          <DeliveryInfo order={order} />
        </div>
      </div>
    </article>
  );
}
