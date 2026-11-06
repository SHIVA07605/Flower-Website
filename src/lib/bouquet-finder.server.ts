import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayRunIdFetch } from "./ai/run-id.server";
import { matchBouquet } from "./bouquet-finder.match";
import { pickCandidates, type FinderInput, type FinderResult } from "./bouquet-finder.shared";
import type { CatalogItem } from "./catalog";
import { loadCatalog } from "./server/store.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

const resultSchema = z.object({
  bestId: z.string(),
  alternateId: z.string().nullable(),
  headline: z.string(),
  reason: z.string(),
  cardNote: z.string(),
});

export class FinderError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const INSTRUCTIONS = `You are the head florist at Reelmark, a flower shop. A shopper describes an occasion, the flowers they like and a budget.
Choose the single best matching bouquet from the provided catalog, plus an optional different alternate.
Only use ids that appear in the catalog. Weigh, in order: fit for the occasion and its mood, overlap with preferred flowers or colours, then value for the budget.
Sympathy calls for calm, respectful arrangements. Romance favours roses and peonies. Keep it warm and specific.
headline: max 8 words. reason: 2 short sentences referencing the shopper's words. cardNote: a gift card message of max 20 words matching the occasion.`;

/**
 * Recommends a bouquet the shopper can afford. The AI florist chooses when LOVABLE_API_KEY is
 * set; if it isn't, or the gateway fails (credits, rate limits, outages), the rule-based
 * matcher answers instead so the shopper never hits a dead end. Both only see candidates
 * that `pickCandidates` already filtered to the budget.
 */
export async function recommendBouquet(input: FinderInput): Promise<FinderResult> {
  // The same live catalog the storefront shows (admin prices, hidden and added bouquets).
  const { candidates, overBudget } = pickCandidates(await loadCatalog(), input.budget);
  if (candidates.length === 0) {
    throw new FinderError("The studio has no bouquets available right now.", 503);
  }

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return matchBouquet(candidates, input, overBudget);
  try {
    return await askAiFlorist(apiKey, candidates, input, overBudget);
  } catch (error) {
    console.warn(
      "[finder] AI florist unavailable, using rule-based matching:",
      error instanceof Error ? error.message : error,
    );
    return matchBouquet(candidates, input, overBudget);
  }
}

async function askAiFlorist(
  apiKey: string,
  candidates: CatalogItem[],
  input: FinderInput,
  overBudget: boolean,
): Promise<FinderResult> {
  const catalog = candidates
    .map(
      (b) =>
        `- id: ${b.id} | ${b.name} by ${b.maker} | ₹${b.price} | flowers: ${b.flowers.join(", ")} | colours: ${b.palette} | good for: ${b.occasions.join(", ")} | ${b.blurb}`,
    )
    .join("\n");

  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    instructions: INSTRUCTIONS,
    maxRetries: 0,
    messages: [
      {
        role: "user",
        content: `Occasion: ${input.occasion}\nPreferred flowers: ${input.flowers || "no preference"}\nBudget: up to ₹${input.budget} (Indian Rupees)\n\nCatalog:\n${catalog}`,
      },
    ],
    output: Output.object({ schema: resultSchema }),
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  let parsed: z.infer<typeof resultSchema>;
  try {
    parsed = await result.output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error) && error.text) {
      parsed = resultSchema.parse(JSON.parse(error.text));
    } else if (APICallError.isInstance(error)) {
      const status = error.statusCode ?? 502;
      // Logged for the admin; the shopper gets the rule-based match instead.
      throw new Error(
        status === 402
          ? "AI gateway 402: credits have run out — add credits to re-enable the AI florist"
          : `AI gateway ${status}: ${error.message}`,
      );
    } else {
      throw error;
    }
  }

  const ids = new Set(candidates.map((c) => c.id));
  const bestId = ids.has(parsed.bestId) ? parsed.bestId : candidates[0]!.id;
  const alternateId =
    parsed.alternateId && ids.has(parsed.alternateId) && parsed.alternateId !== bestId
      ? parsed.alternateId
      : null;

  return {
    bestId,
    alternateId,
    headline: parsed.headline.slice(0, 80),
    reason: parsed.reason.slice(0, 400),
    cardNote: parsed.cardNote.slice(0, 160),
    overBudget,
  };
}
