import { describe, expect, it } from "vitest";

import { bouquets } from "@/components/shop/products";
import { pickCandidates } from "@/lib/bouquet-finder.shared";
import { mergeCatalog } from "@/lib/catalog";

describe("bouquet finder budget", () => {
  it("only offers bouquets at or under the shopper's budget", () => {
    const { candidates, overBudget } = pickCandidates(bouquets, 1500);
    expect(overBudget).toBe(false);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((b) => b.price <= 1500)).toBe(true);
  });

  it("includes a bouquet priced exactly at the budget", () => {
    const { candidates } = pickCandidates(bouquets, 1999);
    expect(candidates.some((b) => b.id === "golden-hour-roses")).toBe(true);
  });

  it("falls back to the cheapest bouquet and flags it when nothing fits", () => {
    const { candidates, overBudget } = pickCandidates(bouquets, 500);
    expect(overBudget).toBe(true);
    expect(candidates.map((b) => b.id)).toEqual(["dried-pampas"]);
  });

  it("respects admin price changes in the live catalog", () => {
    const live = mergeCatalog([
      {
        id: "dried-pampas",
        name: null,
        maker: null,
        price: 3500,
        image_url: null,
        flowers: null,
        palette: null,
        occasions: null,
        blurb: null,
        is_active: true,
        is_featured: null,
        sort_order: null,
      },
    ]);
    const { candidates } = pickCandidates(live, 1200);
    expect(candidates.some((b) => b.id === "dried-pampas")).toBe(false);
  });

  it("returns nothing when the catalog is empty", () => {
    expect(pickCandidates([], 2000)).toEqual({ candidates: [], overBudget: false });
  });
});
