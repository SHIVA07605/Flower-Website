import { computeTotals, promoMatches, readBillingSettings, type DeliverySlot } from "../billing";
import { mergeCatalog } from "../catalog";
import {
  deliveryWindow,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type CheckoutData,
  type OrderItemSnapshot,
  type OrderRecord,
  type OrderStatus,
  type PaymentStatus,
} from "../orders";
import { mergeSiteContent, type SiteContentRow } from "../site-content";
import { dbFailure, requireServiceDb } from "./db.server";
import { ServiceError } from "./env.server";
import { PRODUCT_COLUMNS } from "./store.server";
import type { Viewer } from "./viewer.server";

export const ORDER_COLUMNS =
  "id,order_number,user_id,customer_name,customer_email,customer_phone,recipient_name,recipient_phone,delivery_address,delivery_city,delivery_pincode,delivery_date,delivery_slot,card_message,items,subtotal,discount,promo_code,delivery_fee,tax,total_amount,payment_method,payment_status,status,admin_note,created_at,updated_at";

export interface OrderRow {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  delivery_city: string;
  delivery_pincode: string;
  delivery_date: string;
  delivery_slot: string;
  card_message: string;
  items: unknown;
  subtotal: number | string;
  discount: number | string;
  promo_code: string | null;
  delivery_fee: number | string;
  tax: number | string;
  total_amount: number | string;
  payment_method: string;
  payment_status: string;
  status: string;
  admin_note: string;
  created_at: string;
  updated_at: string;
}

const isStatus = (s: string): s is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(s);
const isPayment = (s: string): s is PaymentStatus =>
  (PAYMENT_STATUSES as readonly string[]).includes(s);

function snapshotItems(raw: unknown): OrderItemSnapshot[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): OrderItemSnapshot[] => {
    if (!entry || typeof entry !== "object") return [];
    const e = entry as Record<string, unknown>;
    return [
      {
        id: String(e["id"] ?? ""),
        name: String(e["name"] ?? "Bouquet"),
        maker: String(e["maker"] ?? ""),
        price: Number(e["price"] ?? 0),
        qty: Number(e["qty"] ?? 1),
        image: String(e["image"] ?? ""),
      },
    ];
  });
}

/** Maps a database row to the app's order shape. Internal notes only go to admins. */
export function toOrderRecord(row: OrderRow, opts: { forAdmin?: boolean } = {}): OrderRecord {
  return {
    id: row.id,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: isStatus(row.status) ? row.status : "placed",
    paymentStatus: isPayment(row.payment_status) ? row.payment_status : "pending",
    paymentMethod: row.payment_method,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    address: row.delivery_address,
    city: row.delivery_city,
    pincode: row.delivery_pincode,
    deliveryDate: row.delivery_date,
    deliverySlot: (row.delivery_slot === "express" ? "express" : "standard") as DeliverySlot,
    cardMessage: row.card_message,
    items: snapshotItems(row.items),
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    promoCode: row.promo_code,
    deliveryFee: Number(row.delivery_fee),
    tax: Number(row.tax),
    total: Number(row.total_amount),
    adminNote: opts.forAdmin ? row.admin_note : "",
  };
}

const normalizePhone = (phone: string) => phone.replace(/^(\+91|0)/, "");

/**
 * Prices the order from the live catalog and the admin's billing rules — never from
 * what the browser sent — then stores it.
 */
export async function placeOrder(viewer: Viewer | null, input: CheckoutData) {
  if (input.website) throw new ServiceError("We couldn't place that order.", 400);

  const dates = deliveryWindow();
  const date = input.delivery.date;
  if (date < dates.earliest) {
    throw new ServiceError(
      dates.sameDayOpen
        ? "Please choose today or a later date."
        : "Same-day orders close at 2pm — please choose tomorrow or later.",
    );
  }
  if (date > dates.latest) {
    throw new ServiceError("We take orders up to 30 days ahead. Please choose an earlier date.");
  }

  const db = requireServiceDb();
  const [{ data: productRows, error: productError }, { data: contentRows, error: contentError }] =
    await Promise.all([
      db.from("products").select(PRODUCT_COLUMNS),
      db.from("site_content").select("section_key,text_content"),
    ]);
  if (productError) throw dbFailure(productError, "load the catalog");
  if (contentError) throw dbFailure(contentError, "load delivery settings");

  const catalog = mergeCatalog(productRows ?? []);
  const settings = readBillingSettings(mergeSiteContent((contentRows ?? []) as SiteContentRow[]));

  const quantities = new Map<string, number>();
  for (const item of input.items) {
    quantities.set(item.id, Math.min(20, (quantities.get(item.id) ?? 0) + item.qty));
  }
  const items: OrderItemSnapshot[] = [];
  for (const [id, qty] of quantities) {
    const product = catalog.find((p) => p.id === id);
    if (!product) {
      throw new ServiceError(
        "One of the bouquets in your bag is no longer available. Please remove it and try again.",
        409,
      );
    }
    items.push({
      id,
      name: product.name,
      maker: product.maker,
      price: product.price,
      qty,
      image: product.image,
    });
  }

  let promoApplied = false;
  if (input.promoCode) {
    if (!promoMatches(input.promoCode, settings)) {
      throw new ServiceError("That promo code isn't valid.");
    }
    // A fresh email alone shouldn't unlock the first-order discount again: check the phone too.
    const previous = (column: "customer_email" | "customer_phone", value: string) =>
      db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq(column, value)
        .neq("status", "cancelled");
    const [byEmail, byPhone] = await Promise.all([
      previous("customer_email", input.customer.email),
      previous("customer_phone", normalizePhone(input.customer.phone)),
    ]);
    if (byEmail.error) throw dbFailure(byEmail.error, "check your promo code");
    if (byPhone.error) throw dbFailure(byPhone.error, "check your promo code");
    if ((byEmail.count ?? 0) + (byPhone.count ?? 0) > 0) {
      throw new ServiceError(
        `${settings.promoCode} is for a first order only, and you've ordered with us before.`,
      );
    }
    promoApplied = true;
  }

  const totals = computeTotals(items, settings, { slot: input.delivery.slot, promoApplied });

  const { data, error } = await db
    .from("orders")
    .insert({
      user_id: viewer?.id ?? null,
      customer_name: input.customer.name,
      customer_email: input.customer.email,
      customer_phone: normalizePhone(input.customer.phone),
      recipient_name: input.recipient.name,
      recipient_phone: normalizePhone(input.recipient.phone),
      delivery_address: input.recipient.address,
      delivery_city: input.recipient.city,
      delivery_pincode: input.recipient.pincode,
      delivery_date: date,
      delivery_slot: input.delivery.slot,
      card_message: input.delivery.cardMessage,
      items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      promo_code: promoApplied ? settings.promoCode : null,
      delivery_fee: totals.deliveryFee,
      tax: totals.tax,
      total_amount: totals.total,
      payment_method: "pay_on_delivery",
    })
    .select("order_number,total_amount,customer_email")
    .single();
  if (error || !data) throw dbFailure(error ?? { message: "no row returned" }, "place your order");

  return {
    orderNumber: data.order_number as string,
    total: Number(data.total_amount),
    email: data.customer_email as string,
  };
}

/** The viewer's orders: placed while signed in, or as a guest with their verified email. */
export async function listViewerOrders(viewer: Viewer): Promise<OrderRecord[]> {
  const db = requireServiceDb();
  const queries = [
    db.from("orders").select(ORDER_COLUMNS).eq("user_id", viewer.id).limit(100),
    ...(viewer.email && viewer.emailVerified
      ? [db.from("orders").select(ORDER_COLUMNS).eq("customer_email", viewer.email).limit(100)]
      : []),
  ];
  const results = await Promise.all(queries);
  const rows = new Map<string, OrderRow>();
  for (const { data, error } of results) {
    if (error) throw dbFailure(error, "load your orders");
    for (const row of (data ?? []) as OrderRow[]) rows.set(row.id, row);
  }
  return [...rows.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((row) => toOrderRecord(row));
}

/** "9876543210" → "••••••3210". */
const maskPhone = (phone: string) => (phone.length > 4 ? `••••••${phone.slice(-4)}` : "••••");

/**
 * What guest tracking may reveal. Order numbers are sequential, so anyone who knows a
 * shopper's email could find their orders: show delivery progress, but not the street
 * address, phone numbers, the buyer's contact details or the private card message.
 * Signed-in owners see everything via their account.
 */
export function redactForGuest(order: OrderRecord): OrderRecord {
  return {
    ...order,
    customerName: order.customerName.split(/\s+/)[0] ?? "",
    customerEmail: "",
    customerPhone: maskPhone(order.customerPhone),
    recipientName: order.recipientName.split(/\s+/)[0] ?? "",
    recipientPhone: maskPhone(order.recipientPhone),
    address: "",
    cardMessage: "",
    adminNote: "",
  };
}

/** Guest tracking: needs both the order number and the email it was placed with. */
export async function trackOrder(orderNumber: string, email: string): Promise<OrderRecord | null> {
  const db = requireServiceDb();
  const { data, error } = await db
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("order_number", orderNumber.trim().toUpperCase())
    .eq("customer_email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw dbFailure(error, "find that order");
  return data ? redactForGuest(toOrderRecord(data as OrderRow)) : null;
}
