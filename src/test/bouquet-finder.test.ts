import { describe, expect, it } from "vitest";

import { pickCandidates } from "@/lib/bouquet-finder.shared";

describe("bouquet finder budget", () => {
  it("only offers bouquets at or under the shopper's budget", () => {
    const { candidates, overBudget } = pickCandidates(1500);
    expect(overBudget).toBe(false);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((b) => b.price <= 1500)).toBe(true);
  });

  it("includes a bouquet priced exactly at the budget", () => {
    const { candidates } = pickCandidates(1999);
    expect(candidates.some((b) => b.id === "golden-hour-roses")).toBe(true);
  });

  it("falls back to the cheapest bouquet and flags it when nothing fits", () => {
    const { candidates, overBudget } = pickCandidates(500);
    expect(overBudget).toBe(true);
    expect(candidates.map((b) => b.id)).toEqual(["dried-pampas"]);
  });
});
