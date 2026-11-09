import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeTotals, readBillingSettings } from "@/lib/billing";
import { checkoutSchema, type CheckoutInput } from "@/lib/orders";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content";

/* A tiny stand-in for the Supabase query builder: records each query and answers it. */
interface Query {
  table: string;
  op: "select" | "insert";
  payload?: unknown;
  head: boolean;
  filters: [string, string, unknown][];
}
type Answer = {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
  count?: number;
};

function fakeDb(answer: (q: Query) => Answer) {
  const queries: Query[] = [];
  return {
    queries,
    from(table: string) {
      const q: Query = { table, op: "select", head: false, filters: [] };
      queries.push(q);
      const builder = {
        select(_columns?: string, opts?: { head?: boolean }) {
          if (q.op === "select") q.head = Boolean(opts?.head);
          return builder;
        },
        insert(payload: unknown) {
          q.op = "insert";
          q.payload = payload;
          return builder;
        },
        eq: (column: string, value: unknown) => (q.filters.push(["eq", column, value]), builder),
        neq: (column: string, value: unknown) => (q.filters.push(["neq", column, value]), builder),
        single: () => builder,
        maybeSingle: () => builder,
        then(resolve: (r: Answer) => void) {
          resolve({ data: null, error: null, count: 0, ...answer(q) });
        },
      };
      return builder;
    },
  };
}

let db: ReturnType<typeof fakeDb> | null = null;

vi.mock("@/lib/server/db.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/db.server")>();
  return {
    ...actual,
    requireServiceDb: () => {
      if (!db) throw new actual.SetupError(actual.NOT_CONNECTED);
      return db;
    },
    getServiceDb: () => db,
    getAnonDb: () => null,
  };
});

const { placeOrder } = await import("@/lib/server/orders.server");
const { run, SHOP_UNAVAILABLE, NOT_SET_UP } = await import("@/lib/server/db.server");

const order = (overrides: Partial<CheckoutInput> = {}) =>
  checkoutSchema.parse({
    items: [{ id: "blush-peony", qty: 1 }],
    customer: { name: "Asha Verma", email: "Asha@Example.com", phone: "+91 98765 43210" },
    recipient: {
      name: "Meera",
      phone: "9876501234",
      address: "Flat 4B, Lotus Apartments, MG Road",
      city: "Bengaluru",
      pincode: "560001",
    },
    delivery: { date: "2026-11-06", slot: "standard", cardMessage: "Happy birthday!" },
    ...overrides,
  });

/** Answers like a set-up store: optional product/content edits and past orders by email. */
function store({ products = [] as unknown[], content = [] as unknown[], previousOrders = 0 } = {}) {
  return fakeDb((q) => {
    if (q.table === "products") return { data: products };
    if (q.table === "site_content") return { data: content };
    if (q.table === "orders" && q.op === "select") return { count: previousOrders };
    if (q.table === "orders" && q.op === "insert") {
      const row = q.payload as { total_amount: number; customer_email: string };
      return {
        data: {
          order_number: "RM-10001",
          total_amount: row.total_amount,
          customer_email: row.customer_email,
        },
      };
    }
    return {};
  });
}

const inserted = () =>
  db!.queries.find((q) => q.table === "orders" && q.op === "insert")?.payload as Record<
    string,
    unknown
  >;

beforeEach(() => {
  // 09:30 in India: same-day delivery is still open.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-06T04:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  db = null;
});

describe("placing an order on the server", () => {
  it("prices the order from the live catalog and the billing rules", async () => {
    db = store({
      products: [{ id: "blush-peony", price: 2000, is_active: true }],
      content: [{ section_key: "billing_tax_rate", text_content: "5" }],
    });
    const result = await placeOrder(null, order({ items: [{ id: "blush-peony", qty: 2 }] }));

    const settings = readBillingSettings({ ...DEFAULT_SITE_CONTENT, billing_tax_rate: "5" });
    const expected = computeTotals([{ price: 2000, qty: 2 }], settings, {
      slot: "standard",
      promoApplied: false,
    });
    expect(result).toEqual({
      orderNumber: "RM-10001",
      total: expected.total,
      email: "asha@example.com",
    });
    const row = inserted();
    expect(row["subtotal"]).toBe(4000);
    expect(row["total_amount"]).toBe(expected.total);
    expect(row["customer_phone"]).toBe("9876543210");
    expect(row["user_id"]).toBeNull();
    expect(row["items"]).toEqual([
      expect.objectContaining({
        id: "blush-peony",
        name: "Blush Peony Cloud",
        price: 2000,
        qty: 2,
      }),
    ]);
  });

  it("merges repeated bag lines and caps each bouquet at 20", async () => {
    db = store();
    await placeOrder(
      null,
      order({
        items: [
          { id: "sunflower-wrap", qty: 15 },
          { id: "sunflower-wrap", qty: 10 },
        ],
      }),
    );
    expect(inserted()["items"]).toEqual([
      expect.objectContaining({ id: "sunflower-wrap", qty: 20 }),
    ]);
  });

  it("links the order to a signed-in shopper", async () => {
    db = store();
    const viewer = {
      id: "firebase:abc",
      uid: "abc",
      provider: "firebase" as const,
      email: "asha@example.com",
      emailVerified: true,
      name: "Asha",
      avatarUrl: null,
      isAdmin: false,
      isOwner: false,
      adminUntil: null,
    };
    await placeOrder(viewer, order());
    expect(inserted()["user_id"]).toBe("firebase:abc");
  });

  it("refuses bouquets the admin has hidden", async () => {
    db = store({ products: [{ id: "blush-peony", is_active: false }] });
    await expect(placeOrder(null, order())).rejects.toThrow(/no longer available/);
    expect(inserted()).toBeUndefined();
  });

  it("applies the promo code only to a first order", async () => {
    const content = [
      { section_key: "promo_code", text_content: "BLOOM15" },
      { section_key: "promo_percent", text_content: "15" },
    ];
    db = store({ content });
    await placeOrder(null, order({ promoCode: "bloom15" }));
    expect(inserted()["discount"]).toBe(374.85);
    expect(inserted()["promo_code"]).toBe("BLOOM15");

    db = store({ content, previousOrders: 1 });
    await expect(placeOrder(null, order({ promoCode: "BLOOM15" }))).rejects.toThrow(
      /first order only/,
    );
  });

  it("rejects an unknown promo code", async () => {
    db = store({
      content: [
        { section_key: "promo_code", text_content: "BLOOM15" },
        { section_key: "promo_percent", text_content: "15" },
      ],
    });
    await expect(placeOrder(null, order({ promoCode: "FREEFLOWERS" }))).rejects.toThrow(
      /isn't valid/,
    );
  });

  it("only takes delivery dates from today to 30 days ahead", async () => {
    db = store();
    const on = (date: string) => order({ delivery: { date, slot: "standard", cardMessage: "" } });
    await expect(placeOrder(null, on("2026-11-05"))).rejects.toThrow(/today or a later date/);
    await expect(placeOrder(null, on("2026-12-07"))).rejects.toThrow(/30 days ahead/);
    await expect(placeOrder(null, on("2026-12-06"))).resolves.toMatchObject({
      orderNumber: "RM-10001",
    });
  });

  it("closes same-day orders after 2pm in India", async () => {
    vi.setSystemTime(new Date("2026-11-06T09:00:00Z")); // 14:30 IST
    db = store();
    await expect(placeOrder(null, order())).rejects.toThrow(/closed at 2pm|close at 2pm/);
  });

  it("silently refuses bots that fill the hidden field", async () => {
    db = store();
    await expect(placeOrder(null, order({ website: "http://spam.example" }))).rejects.toThrow();
    expect(inserted()).toBeUndefined();
  });
});

describe("errors shoppers and admins see", () => {
  const missingTables = () =>
    fakeDb(() => ({
      error: { code: "PGRST205", message: "Could not find the table 'public.orders'" },
    }));

  it("gives shoppers a friendly message when the store isn't set up", async () => {
    db = missingTables();
    const result = await run(() => placeOrder(null, order()));
    expect(result).toEqual({ ok: false, error: SHOP_UNAVAILABLE });
  });

  it("tells admins exactly what to fix", async () => {
    db = missingTables();
    const result = await run(() => placeOrder(null, order()), { audience: "admin" });
    expect(result).toEqual({ ok: false, error: NOT_SET_UP });
  });

  it("treats a missing service key as a setup problem too", async () => {
    db = null;
    expect(await run(() => placeOrder(null, order()))).toEqual({
      ok: false,
      error: SHOP_UNAVAILABLE,
    });
  });

  it("still shows shoppers ordinary reasons, like an invalid promo code", async () => {
    db = store();
    const result = await run(() => placeOrder(null, order({ promoCode: "NOPE" })));
    expect(result).toEqual({ ok: false, error: "That promo code isn't valid." });
  });
});
