import { bouquets, type Bouquet } from "@/components/shop/products";

export const BUDGET_MIN = 799;
export const BUDGET_MAX = 3999;

export interface FinderInput {
  occasion: string;
  flowers: string;
  budget: number;
}

export interface FinderResult {
  bestId: string;
  alternateId: string | null;
  headline: string;
  reason: string;
  cardNote: string;
  overBudget: boolean;
}

/**
 * Bouquets the AI may choose from: everything at or under the shopper's budget.
 * If nothing fits, offer only the cheapest bouquet and flag it as over budget.
 */
export function pickCandidates(budget: number): { candidates: Bouquet[]; overBudget: boolean } {
  const within = bouquets.filter((b) => b.price <= budget);
  if (within.length > 0) return { candidates: within, overBudget: false };
  const cheapest = [...bouquets].sort((a, b) => a.price - b.price)[0]!;
  return { candidates: [cheapest], overBudget: true };
}
