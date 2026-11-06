import { describe, expect, it } from "vitest";

import { bouquets } from "@/components/shop/products";
import { computeTotals, promoMatches, readBillingSettings } from "@/lib/billing";
import { mergeCatalog, type ProductRow } from "@/lib/catalog";
import { checkoutSchema, deliveryWindow } from "@/lib/orders";
import { publicAuthorName } from "@/lib/reviews";
import { DEFAULT_SITE_CONTENT, mergeSiteContent } from "@/lib/site-content";

const row = (patch: Partial<ProductRow> & { id: string }): ProductRow => ({
  name: null,
  maker: null,
  price: null,
  image_url: null,
  flowers: null,
  palette: null,
  occasions: null,
  blurb: null,
  is_active: true,
  is_featured: null,
  sort_order: null,
  ...patch,
});

describe("catalog merge (products.ts + admin edits)", () => {
  it("returns the base catalog untouched when there are no edits", () => {
    const catalog = mergeCatalog([]);
    expect(catalog.map((b) => b.id)).toEqual(bouquets.map((b) => b.id));
    expect(catalog.every((b) => !b.isEdited && !b.isCustom)).toBe(true);
  });

  it("applies only the fields the admin changed", () => {
    const [item] = mergeCatalog([row({ id: "blush-peony", price: "2999.00" })]).filter(
      (b) => b.id === "blush-peony",
    );
    expect(item?.price).toBe(2999);
    expect(item?.name).toBe("Blush Peony Cloud");
    expect(item?.isEdited).toBe(true);
  });

  it("hides bouquets the admin switched off, except in admin views", () => {
    const rows = [row({ id: "white-lily", is_active: false })];
    expect(mergeCatalog(rows).some((b) => b.id === "white-lily")).toBe(false);
    expect(mergeCatalog(rows, { includeHidden: true }).some((b) => b.id === "white-lily")).toBe(
      true,
    );
  });

  it("adds admin-created bouquets and skips incomplete ones", () => {
    const catalog = mergeCatalog([
      row({
        id: "amber-sunrise",
        name: "Amber Sunrise",
        price: 1799,
        image_url: "https://x.test/a.jpg",
      }),
      row({ id: "broken", name: null, price: 100 }),
    ]);
    const custom = catalog.find((b) => b.id === "amber-sunrise");
    expect(custom?.isCustom).toBe(true);
    expect(custom?.price).toBe(1799);
    expect(catalog.some((b) => b.id === "broken")).toBe(false);
  });
});

describe("billing", () => {
  const settings = readBillingSettings(mergeSiteContent([]));

  it("charges standard delivery below the free threshold and adds GST", () => {
    const t = computeTotals([{ price: 500, qty: 1 }], settings, {
      slot: "standard",
      promoApplied: false,
    });
    expect(t).toEqual({ subtotal: 500, discount: 0, deliveryFee: 149, tax: 90, total: 739 });
  });

  it("makes standard delivery free at the threshold, but still charges express", () => {
    const standard = computeTotals([{ price: 1299, qty: 1 }], settings, {
      slot: "standard",
      promoApplied: false,
    });
    const express = computeTotals([{ price: 1299, qty: 1 }], settings, {
      slot: "express",
      promoApplied: false,
    });
    expect(standard.deliveryFee).toBe(0);
    expect(express.deliveryFee).toBe(249);
  });

  it("applies the promo before delivery and tax", () => {
    const t = computeTotals([{ price: 1000, qty: 1 }], settings, {
      slot: "standard",
      promoApplied: true,
    });
    expect(t.discount).toBe(150);
    // 850 is under the ₹999 free-delivery minimum.
    expect(t.deliveryFee).toBe(149);
    expect(t.tax).toBe(153);
    expect(t.total).toBe(1152);
  });

  it("matches promo codes case-insensitively and can be switched off", () => {
    expect(promoMatches(" bloom15 ", settings)).toBe(true);
    expect(promoMatches("OTHER", settings)).toBe(false);
    const off = readBillingSettings(
      mergeSiteContent([{ section_key: "promo_percent", text_content: "0" }]),
    );
    expect(promoMatches("BLOOM15", off)).toBe(false);
  });

  it("ignores blank or unknown content rows", () => {
    const content = mergeSiteContent([
      { section_key: "hero_kicker", text_content: "  " },
      { section_key: "not_a_key", text_content: "x" },
    ]);
    expect(content.hero_kicker).toBe(DEFAULT_SITE_CONTENT.hero_kicker);
    expect(Object.keys(content)).not.toContain("not_a_key");
  });
});

describe("checkout validation", () => {
  const valid = {
    items: [{ id: "blush-peony", qty: 1 }],
    customer: { name: "Priya Sharma", email: " Priya@Example.com ", phone: "+91 98765 43210" },
    recipient: {
      name: "Anita",
      phone: "9876543210",
      address: "12 MG Road, Indiranagar",
      city: "Bengaluru",
      pincode: "560038",
    },
    delivery: { date: "2026-12-01", slot: "standard" as const, cardMessage: "Happy birthday!" },
  };

  it("accepts a complete order and normalises the email and phone", () => {
    const parsed = checkoutSchema.parse(valid);
    expect(parsed.customer.email).toBe("priya@example.com");
    expect(parsed.customer.phone).toBe("+919876543210");
  });

  it("rejects bad phone numbers and pincodes", () => {
    expect(
      checkoutSchema.safeParse({ ...valid, customer: { ...valid.customer, phone: "12345" } })
        .success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...valid, recipient: { ...valid.recipient, pincode: "0123" } })
        .success,
    ).toBe(false);
  });

  it("closes same-day delivery at 2pm IST", () => {
    // 13:00 IST = 07:30 UTC; 15:00 IST = 09:30 UTC.
    const before = deliveryWindow(new Date("2026-11-06T07:30:00Z"));
    const after = deliveryWindow(new Date("2026-11-06T09:30:00Z"));
    expect(before.earliest).toBe("2026-11-06");
    expect(after.earliest).toBe("2026-11-07");
  });
});

describe("review author names", () => {
  it("never shows a full surname or email", () => {
    expect(publicAuthorName("hannah kapoor", "h@x.com")).toBe("Hannah K.");
    expect(publicAuthorName(null, "leo.m@example.com")).toBe("Leo.m");
    expect(publicAuthorName("Grace", null)).toBe("Grace");
  });
});
