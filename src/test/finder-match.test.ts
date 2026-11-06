import { describe, expect, it } from "vitest";

import { bouquets } from "@/components/shop/products";
import { detectOccasion, matchBouquet } from "@/lib/bouquet-finder.match";
import { pickCandidates } from "@/lib/bouquet-finder.shared";

/** What the finder does without the AI: budget filter first, then rule-based matching. */
function recommend(occasion: string, flowers = "", budget = 3999) {
  const { candidates, overBudget } = pickCandidates(bouquets, budget);
  return {
    result: matchBouquet(candidates, { occasion, flowers, budget }, overBudget),
    candidates,
  };
}

describe("rule-based bouquet matching (no AI key)", () => {
  it("reads the occasion from everyday wording", () => {
    expect(detectOccasion("Sympathy flowers for a colleague who lost her mother")).toBe("sympathy");
    expect(detectOccasion("Our 10th wedding anniversary, something romantic")).toBe("anniversary");
    expect(detectOccasion("My best friend's 30th birthday")).toBe("birthday");
    expect(detectOccasion("Just because, to cheer up my sister")).toBe("just-because");
    expect(detectOccasion("so sorry for your loss")).toBe("sympathy");
    expect(detectOccasion("flowers")).toBeNull();
  });

  it("chooses a calm sympathy arrangement for a loss", () => {
    const { result } = recommend("Sympathy flowers for a colleague who lost her mother");
    expect(result.bestId).toBe("white-lily");
    expect(result.cardNote).toMatch(/thinking of you/i);
  });

  it("follows the flowers the shopper asked for", () => {
    expect(recommend("A birthday", "Sunflowers").result.bestId).toBe("sunflower-wrap");
    expect(recommend("Anniversary", "Peonies").result.bestId).toBe("blush-peony");
    expect(recommend("Just because", "Dried stems").result.bestId).toBe("dried-pampas");
    expect(recommend("Birthday", "Ranunculus").result.bestId).toBe("ranunculus-posy");
  });

  it("mentions the requested flowers in the reason, by their catalog names", () => {
    const { result } = recommend("Birthday", "Sunflowers");
    expect(result.reason).toMatch(/including the sunflower you asked for/);
    expect(result.reason).toMatch(/budget/);
    expect(recommend("Birthday", "Ranunculus").result.reason).toMatch(
      /including the ranunculus you asked for/,
    );
    expect(result.reason).toMatch(/sunflower, gerbera and billy buttons/);
  });

  it("steers away from flowers the shopper wants to avoid", () => {
    const { result } = recommend("Sympathy for a neighbour, no lilies please");
    expect(result.bestId).not.toBe("white-lily");
  });

  it("never recommends anything over budget", () => {
    for (const budget of [1199, 1500, 1999, 2499]) {
      const { result, candidates } = recommend("Anniversary", "Peonies, roses", budget);
      const ids = candidates.map((c) => c.id);
      expect(ids).toContain(result.bestId);
      if (result.alternateId) expect(ids).toContain(result.alternateId);
      expect(bouquets.find((b) => b.id === result.bestId)!.price).toBeLessThanOrEqual(budget);
    }
  });

  it("offers a different alternate when there is one", () => {
    const { result } = recommend("Birthday");
    expect(result.alternateId).not.toBeNull();
    expect(result.alternateId).not.toBe(result.bestId);
  });

  it("flags the cheapest bouquet when nothing fits the budget", () => {
    const { result } = recommend("Birthday", "", 800);
    expect(result).toMatchObject({ bestId: "dried-pampas", alternateId: null, overBudget: true });
  });

  it("keeps the AI's length limits", () => {
    const { result } = recommend(
      "A big celebration for my mum's 60th birthday",
      "Roses, sunflowers",
    );
    expect(result.headline.split(" ").length).toBeLessThanOrEqual(8);
    expect(result.cardNote.split(" ").length).toBeLessThanOrEqual(20);
    expect(result.reason.length).toBeLessThanOrEqual(400);
  });
});
