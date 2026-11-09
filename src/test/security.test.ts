import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderRecord } from "@/lib/orders";

/* ---------------- Shared fakes ---------------- */

const fakeServiceDb = {
  current: null as null | Record<string, unknown>,
};

vi.mock("@/lib/server/db.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/db.server")>();
  return {
    ...actual,
    getServiceDb: () => fakeServiceDb.current,
    getAnonDb: () => null,
  };
});

vi.mock("@tanstack/react-start/server-entry", () => ({
  default: {
    fetch: (request: Request) =>
      new URL(request.url).pathname === "/boom"
        ? Promise.reject(new Error("render failed"))
        : new Response("<html></html>", { headers: { "content-type": "text/html" } }),
  },
}));

afterEach(() => {
  fakeServiceDb.current = null;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

/* ---------------- Rate limits ---------------- */

describe("rate limits", () => {
  it("blocks a caller after the limit, per action and per caller", async () => {
    const { enforceLimit, resetMemoryLimits, RATE_LIMITED } =
      await import("@/lib/server/rate-limit.server");
    resetMemoryLimits();
    const limit = { name: "test", max: 3, windowSeconds: 60 };
    for (let i = 0; i < 3; i++) await enforceLimit(limit, "1.2.3.4");
    await expect(enforceLimit(limit, "1.2.3.4")).rejects.toThrow(RATE_LIMITED);
    // Someone else, or another action, still gets through.
    await expect(enforceLimit(limit, "5.6.7.8")).resolves.toBeUndefined();
    await expect(enforceLimit({ ...limit, name: "other" }, "1.2.3.4")).resolves.toBeUndefined();
  });

  it("uses the shared database counter when it exists, sending only a hashed key", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    fakeServiceDb.current = { rpc };
    const { enforceLimit, LIMITS } = await import("@/lib/server/rate-limit.server");
    await expect(enforceLimit(LIMITS.trackOrder, "203.0.113.9")).rejects.toThrow(/too often/);
    const [fn, args] = rpc.mock.calls[0]!;
    expect(fn).toBe("hit_rate_limit");
    expect(args).toMatchObject({ p_limit: 10, p_window_seconds: 600 });
    expect(args.p_key).toMatch(/^track:[0-9a-f]{32}$/);
    expect(args.p_key).not.toContain("203.0.113.9");
  });

  it("falls back to counting in memory before the migration has run", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function" },
    });
    fakeServiceDb.current = { rpc };
    const { enforceLimit, resetMemoryLimits } = await import("@/lib/server/rate-limit.server");
    resetMemoryLimits();
    const limit = { name: "fallback", max: 1, windowSeconds: 60 };
    await enforceLimit(limit, "ip");
    await expect(enforceLimit(limit, "ip")).rejects.toThrow(/too often/);
  });
});

/* ---------------- Guest order tracking ---------------- */

describe("guest order tracking", () => {
  const order: OrderRecord = {
    id: "1",
    orderNumber: "RM-10001",
    createdAt: "",
    updatedAt: "",
    status: "confirmed",
    paymentStatus: "pending",
    paymentMethod: "pay_on_delivery",
    customerName: "Asha Verma",
    customerEmail: "asha@example.com",
    customerPhone: "9876543210",
    recipientName: "Meera Iyer",
    recipientPhone: "9876501234",
    address: "Flat 4B, Lotus Apartments, MG Road",
    city: "Bengaluru",
    pincode: "560001",
    deliveryDate: "2026-11-07",
    deliverySlot: "standard",
    cardMessage: "Happy birthday, love you!",
    items: [],
    subtotal: 1999,
    discount: 0,
    promoCode: null,
    deliveryFee: 0,
    tax: 0,
    total: 1999,
    adminNote: "VIP",
  };

  it("shows progress but not the address, phone numbers, email or card message", async () => {
    const { redactForGuest } = await import("@/lib/server/orders.server");
    const guest = redactForGuest(order);
    expect(guest).toMatchObject({
      status: "confirmed",
      city: "Bengaluru",
      pincode: "560001",
      recipientName: "Meera",
      customerName: "Asha",
      recipientPhone: "••••••1234",
      customerPhone: "••••••3210",
      address: "",
      customerEmail: "",
      cardMessage: "",
      adminNote: "",
    });
    expect(JSON.stringify(guest)).not.toMatch(/Lotus|asha@|9876|love you|Iyer|Verma|VIP/);
  });
});

/* ---------------- Admin access via email/password ---------------- */

describe("admin access for email/password accounts", () => {
  function signedInAs(email: string) {
    fakeServiceDb.current = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "u1",
              email,
              email_confirmed_at: "2026-11-01T00:00:00Z",
              user_metadata: {},
            },
          },
          error: null,
        }),
      },
      from: () => ({
        // No admin_grants row for anyone in these tests.
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
        upsert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { role: "user" }, error: null }),
          }),
        }),
      }),
    };
  }

  function supabaseSettings(autoconfirm: boolean | "unreachable") {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        autoconfirm === "unreachable"
          ? Promise.reject(new Error("network down"))
          : new Response(JSON.stringify({ mailer_autoconfirm: autoconfirm })),
      ),
    );
  }

  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "sb_publishable_test_key_123456");
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
  });

  it("trusts a confirmed admin email when Supabase requires confirmation", async () => {
    signedInAs("owner@example.com");
    supabaseSettings(false);
    const { resolveViewer } = await import("@/lib/server/viewer.server");
    const viewer = await resolveViewer("Bearer token-a", "supabase");
    expect(viewer?.isAdmin).toBe(true);
    expect(viewer?.emailVerified).toBe(true);
  });

  it("refuses admin access if 'Confirm email' is switched off", async () => {
    signedInAs("owner@example.com");
    supabaseSettings(true);
    const { resolveViewer } = await import("@/lib/server/viewer.server");
    const viewer = await resolveViewer("Bearer token-b", "supabase");
    expect(viewer?.isAdmin).toBe(false);
    expect(viewer?.emailVerified).toBe(false);
  });

  it("fails closed when the auth settings can't be read", async () => {
    signedInAs("owner@example.com");
    supabaseSettings("unreachable");
    const { resolveViewer } = await import("@/lib/server/viewer.server");
    expect((await resolveViewer("Bearer token-c", "supabase"))?.isAdmin).toBe(false);
  });

  it("never makes a non-allowlisted email an admin", async () => {
    signedInAs("someone@example.com");
    supabaseSettings(false);
    const { resolveViewer } = await import("@/lib/server/viewer.server");
    expect((await resolveViewer("Bearer token-d", "supabase"))?.isAdmin).toBe(false);
  });
});

/* ---------------- Response headers ---------------- */

describe("security headers", () => {
  const get = async (path: string) => {
    const { default: server } = await import("@/server");
    return server.fetch(new Request(`https://shop.example${path}`), {}, {});
  };

  it("sets baseline headers on every page", async () => {
    const res = await get("/");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("strict-transport-security")).toMatch(/max-age=/);
    expect(res.headers.get("content-security-policy")).toBeNull();
  });

  it("stops other sites from framing the admin and account pages", async () => {
    for (const path of ["/admin", "/account", "/account?order=RM-10001"]) {
      const csp = (await get(path)).headers.get("content-security-policy");
      expect(csp).toMatch(/^frame-ancestors 'self' /);
      expect(csp).not.toMatch(/\*\.lovable\.app|\*\s*$/);
    }
  });

  it("keeps the headers on the error page too", async () => {
    const res = await get("/boom");
    expect(res.status).toBe(500);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
