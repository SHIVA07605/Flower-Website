import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* A database where `grants` decides what admin_grants holds for each email. */
let grants: Record<string, string | null> = {};
let writes: { table: string; op: string; payload?: unknown }[] = [];

function fakeDb() {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: {
            id: "u1",
            email: currentEmail,
            email_confirmed_at: confirmedAt,
            user_metadata: {},
          },
        },
        error: null,
      })),
    },
    from(table: string) {
      let email: string | undefined;
      const builder = {
        select: () => builder,
        upsert: (payload: unknown) => {
          writes.push({ table, op: "upsert", payload });
          return builder;
        },
        update: (payload: unknown) => {
          writes.push({ table, op: "update", payload });
          return builder;
        },
        delete: () => {
          writes.push({ table, op: "delete" });
          return builder;
        },
        eq: (_col: string, value: string) => {
          email = value;
          return builder;
        },
        single: () => Promise.resolve({ data: { role: "user" }, error: null }),
        maybeSingle: () =>
          Promise.resolve({
            data: email !== undefined && email in grants ? { expires_at: grants[email] } : null,
            error: null,
          }),
        then: (resolve: (r: unknown) => void) => resolve({ data: null, error: null }),
      };
      return builder;
    },
  };
}

let currentEmail = "helper@gmail.com";
let confirmedAt: string | null = "2026-11-01T00:00:00Z";

vi.mock("@/lib/server/db.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/db.server")>();
  const db = fakeDb();
  return { ...actual, getServiceDb: () => db, requireServiceDb: () => db, getAnonDb: () => null };
});

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_ANON_KEY", "sb_publishable_test_key_123456");
  vi.stubEnv("ADMIN_EMAILS", "owner@gmail.com, partner@gmail.com");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ mailer_autoconfirm: false }))),
  );
  grants = {};
  writes = [];
  currentEmail = "helper@gmail.com";
  confirmedAt = "2026-11-01T00:00:00Z";
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

let tokenCounter = 0;
async function signIn(email: string) {
  currentEmail = email;
  const { resolveViewer } = await import("@/lib/server/viewer.server");
  return resolveViewer(`Bearer token-${++tokenCounter}`, "supabase");
}

describe("who counts as an admin", () => {
  it("treats every ADMIN_EMAILS address as an owner", async () => {
    expect(await signIn("owner@gmail.com")).toMatchObject({ isOwner: true, isAdmin: true });
    expect(await signIn("partner@gmail.com")).toMatchObject({ isOwner: true, isAdmin: true });
  });

  it("gives a granted email admin access until its end time", async () => {
    const until = new Date(Date.now() + 86_400_000).toISOString();
    grants["helper@gmail.com"] = until;
    const viewer = await signIn("helper@gmail.com");
    expect(viewer).toMatchObject({ isAdmin: true, isOwner: false });
    expect(viewer?.adminUntil).toBe(new Date(until).toISOString());
  });

  it("supports access with no end date", async () => {
    grants["helper@gmail.com"] = null;
    expect(await signIn("helper@gmail.com")).toMatchObject({ isAdmin: true, adminUntil: null });
  });

  it("ignores a grant that has already ended", async () => {
    grants["helper@gmail.com"] = new Date(Date.now() - 1000).toISOString();
    expect((await signIn("helper@gmail.com"))?.isAdmin).toBe(false);
  });

  it("stops access the moment it ends, even within a session", async () => {
    grants["helper@gmail.com"] = new Date(Date.now() + 60_000).toISOString();
    const viewer = await signIn("helper@gmail.com");
    const { requireAdmin } = await import("@/lib/server/viewer.server");
    expect(() => requireAdmin(viewer)).not.toThrow();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 120_000);
    expect(() => requireAdmin(viewer)).toThrow(/admin access has ended/);
  });

  it("never trusts an unconfirmed email, even with a grant", async () => {
    grants["helper@gmail.com"] = null;
    confirmedAt = null;
    expect((await signIn("helper@gmail.com"))?.isAdmin).toBe(false);
  });

  it("leaves everyone else as a shopper", async () => {
    expect(await signIn("stranger@gmail.com")).toMatchObject({ isAdmin: false, isOwner: false });
  });
});

describe("managing admin access", () => {
  it("lets owners give time-limited access", async () => {
    const owner = await signIn("owner@gmail.com");
    const { saveAdminGrant } = await import("@/lib/server/admin.server");
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    await saveAdminGrant(owner, { email: "helper@gmail.com", expiresAt, note: "Diwali" });
    expect(writes).toContainEqual({
      table: "admin_grants",
      op: "upsert",
      payload: {
        email: "helper@gmail.com",
        expires_at: expiresAt,
        note: "Diwali",
        granted_by: "owner@gmail.com",
      },
    });
  });

  it("refuses an end time in the past", async () => {
    const owner = await signIn("owner@gmail.com");
    const { saveAdminGrant } = await import("@/lib/server/admin.server");
    await expect(
      saveAdminGrant(owner, {
        email: "helper@gmail.com",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        note: "",
      }),
    ).rejects.toThrow(/future/);
  });

  it("doesn't let a granted admin add or remove other admins", async () => {
    grants["helper@gmail.com"] = null;
    const helper = await signIn("helper@gmail.com");
    const { saveAdminGrant, revokeAdminGrant, listAdminGrants, setCustomerRole } =
      await import("@/lib/server/admin.server");
    await expect(
      saveAdminGrant(helper, { email: "friend@gmail.com", expiresAt: null, note: "" }),
    ).rejects.toThrow(/Only the shop owner/);
    await expect(revokeAdminGrant(helper, "owner@gmail.com")).rejects.toThrow(
      /Only the shop owner/,
    );
    await expect(listAdminGrants(helper)).rejects.toThrow(/Only the shop owner/);
    await expect(setCustomerRole(helper, { id: "firebase:x", role: "admin" })).rejects.toThrow(
      /Only the shop owner/,
    );
    expect(writes.filter((w) => w.table === "admin_grants")).toEqual([]);
  });

  it("removes access straight away, including a permanent admin role", async () => {
    const owner = await signIn("owner@gmail.com");
    const { revokeAdminGrant } = await import("@/lib/server/admin.server");
    await revokeAdminGrant(owner, "helper@gmail.com");
    expect(writes).toContainEqual({ table: "admin_grants", op: "delete" });
    expect(writes).toContainEqual({ table: "profiles", op: "update", payload: { role: "user" } });
  });
});
