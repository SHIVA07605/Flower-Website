import { afterEach, describe, expect, it, vi } from "vitest";

/** Answers every table query the way PostgREST does when the table doesn't exist. */
function databaseWithoutTables() {
  const missing = {
    data: null,
    count: null,
    error: { code: "PGRST205", message: "Could not find the table in the schema cache" },
  };
  return {
    from: () => {
      const builder = {
        select: () => builder,
        limit: () => builder,
        eq: () => builder,
        order: () => builder,
        then: (resolve: (r: typeof missing) => void) => resolve(missing),
      };
      return builder;
    },
    storage: { getBucket: async () => ({ data: null, error: { message: "Bucket not found" } }) },
  };
}

let db: ReturnType<typeof databaseWithoutTables> | null = null;

vi.mock("@/lib/server/db.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/db.server")>();
  return { ...actual, getServiceDb: () => db, requireServiceDb: () => db, getAnonDb: () => null };
});

const admin = {
  id: "firebase:owner",
  uid: "owner",
  provider: "firebase" as const,
  email: "owner@example.com",
  emailVerified: true,
  name: "Owner",
  avatarUrl: null,
  isAdmin: true,
  isOwner: true,
  adminUntil: null,
};

afterEach(() => {
  db = null;
});

describe("admin dashboard setup check", () => {
  it("reports missing tables instead of failing, so the setup panel can show", async () => {
    db = databaseWithoutTables();
    const { getDashboard } = await import("@/lib/server/admin.server");
    const data = await getDashboard(admin);
    expect(data.stats).toBeNull();
    expect(data.setup).toMatchObject({
      serviceKey: true,
      dbReady: false,
      storageReady: false,
      rateLimitsReady: false,
    });
    expect(Object.values(data.setup.tables).every((ok) => ok === false)).toBe(true);
  });

  it("still refuses shoppers", async () => {
    db = databaseWithoutTables();
    const { getDashboard } = await import("@/lib/server/admin.server");
    await expect(getDashboard({ ...admin, isAdmin: false, isOwner: false })).rejects.toThrow(
      /admin access/,
    );
  });
});
