import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { BUDGET_MAX, BUDGET_MIN, type FinderResult } from "./bouquet-finder.shared";

const inputSchema = z.object({
  occasion: z.string().trim().min(2, "Tell us a little about the occasion").max(400),
  flowers: z.string().trim().max(200),
  budget: z.number().int().min(BUDGET_MIN).max(BUDGET_MAX),
});

export type FinderResponse = { ok: true; result: FinderResult } | { ok: false; error: string };

export const findBouquet = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<FinderResponse> => {
    const { recommendBouquet, FinderError } = await import("./bouquet-finder.server");
    try {
      return { ok: true, result: await recommendBouquet(data) };
    } catch (error) {
      if (error instanceof FinderError) return { ok: false, error: error.message };
      console.error(error);
      return { ok: false, error: "Something went wrong. Please try again." };
    }
  });
