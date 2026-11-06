import type { SiteContent } from "./site-content";

/** Checkout rules the admin controls from the dashboard (all amounts in ₹). */
export interface BillingSettings {
  standardDelivery: number;
  expressSurcharge: number;
  freeDeliveryThreshold: number;
  /** GST % added on top of item prices. 0 when prices already include tax. */
  taxRate: number;
  /** Upper-case code shown after newsletter sign-up; empty disables the offer. */
  promoCode: string;
  promoPercent: number;
}

export type DeliverySlot = "standard" | "express";

export interface PriceLine {
  price: number;
  qty: number;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function amount(raw: string, fallback: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
}

export function readBillingSettings(content: SiteContent): BillingSettings {
  return {
    standardDelivery: amount(content.billing_standard_delivery, 149, 10_000),
    expressSurcharge: amount(content.billing_express_delivery, 249, 10_000),
    freeDeliveryThreshold: amount(content.billing_free_shipping_threshold, 999, 1_000_000),
    taxRate: amount(content.billing_tax_rate, 18, 50),
    promoCode: content.promo_code.trim().toUpperCase(),
    promoPercent: Math.round(amount(content.promo_percent, 0, 90)),
  };
}

export function promoMatches(code: string | undefined, settings: BillingSettings): boolean {
  if (!code || settings.promoCode === "" || settings.promoPercent <= 0) return false;
  return code.trim().toUpperCase() === settings.promoCode;
}

/**
 * The single pricing formula used by the cart preview and, authoritatively, by the server
 * when an order is placed: discount → free/standard delivery (+ express surcharge) → tax.
 */
export function computeTotals(
  lines: readonly PriceLine[],
  settings: BillingSettings,
  opts: { slot: DeliverySlot; promoApplied: boolean },
): OrderTotals {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.price * l.qty, 0));
  const discount = opts.promoApplied ? round2((subtotal * settings.promoPercent) / 100) : 0;
  const goods = round2(subtotal - discount);
  const standard =
    subtotal === 0 || goods >= settings.freeDeliveryThreshold ? 0 : settings.standardDelivery;
  const deliveryFee = round2(standard + (opts.slot === "express" ? settings.expressSurcharge : 0));
  const tax = round2((goods * settings.taxRate) / 100);
  return { subtotal, discount, deliveryFee, tax, total: round2(goods + deliveryFee + tax) };
}

/** How much more the shopper needs to add for free standard delivery (0 when already free). */
export function amountToFreeDelivery(subtotal: number, settings: BillingSettings): number {
  return Math.max(0, round2(settings.freeDeliveryThreshold - subtotal));
}
