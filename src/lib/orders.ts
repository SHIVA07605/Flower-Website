import { z } from "zod";

import type { DeliverySlot } from "./billing";

export const ORDER_STATUSES = [
  "placed",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "refunded", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Order placed",
  confirmed: "Confirmed",
  preparing: "Being hand-tied",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pay on delivery",
  paid: "Paid",
  refunded: "Refunded",
  failed: "Payment failed",
};

/** The happy-path timeline shown to shoppers. */
export const FULFILMENT_STEPS: OrderStatus[] = [
  "placed",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
];

export const DELIVERY_SLOT_LABEL: Record<DeliverySlot, string> = {
  standard: "Standard · same-day by 9pm",
  express: "Express · within 3 hours",
};

export interface OrderItemSnapshot {
  id: string;
  name: string;
  maker: string;
  price: number;
  qty: number;
  image: string;
}

/** An order as the app passes it around (camelCase view of the `orders` row). */
export interface OrderRecord {
  id: string;
  orderNumber: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  recipientName: string;
  recipientPhone: string;
  address: string;
  city: string;
  pincode: string;
  deliveryDate: string;
  deliverySlot: DeliverySlot;
  cardMessage: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  discount: number;
  promoCode: string | null;
  deliveryFee: number;
  tax: number;
  total: number;
  adminNote: string;
}

/* ---------------- Delivery dates (India Standard Time) ---------------- */

/** Orders for same-day delivery close at 2pm IST, matching the storefront promise. */
export const SAME_DAY_CUTOFF_HOUR = 14;
export const MAX_DAYS_AHEAD = 30;

export function istNow(now: Date = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function deliveryWindow(now: Date = new Date()) {
  const { date, hour } = istNow(now);
  const sameDayOpen = hour < SAME_DAY_CUTOFF_HOUR;
  return {
    today: date,
    earliest: sameDayOpen ? date : addDays(date, 1),
    latest: addDays(date, MAX_DAYS_AHEAD),
    sameDayOpen,
  };
}

export function formatDeliveryDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/* ---------------- Checkout validation (shared by the form and the server) ---------------- */

const indianMobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^(\+91|0)?[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"));

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        qty: z.number().int().min(1).max(20),
      }),
    )
    .min(1, "Your bag is empty")
    .max(20),
  customer: z.object({
    name: z.string().trim().min(2, "Please enter your name").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
    phone: indianMobile,
  }),
  recipient: z.object({
    name: z.string().trim().min(2, "Who are the flowers for?").max(80),
    phone: indianMobile,
    address: z.string().trim().min(8, "Please enter the full delivery address").max(300),
    city: z.string().trim().min(2, "Enter the city").max(60),
    pincode: z
      .string()
      .trim()
      .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode"),
  }),
  delivery: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a delivery date"),
    slot: z.enum(["standard", "express"]),
    cardMessage: z.string().trim().max(240, "Keep the card message under 240 characters"),
  }),
  promoCode: z.string().trim().max(32).optional(),
  /** Honeypot — real shoppers never see or fill this field. */
  website: z.string().max(200).optional(),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;
