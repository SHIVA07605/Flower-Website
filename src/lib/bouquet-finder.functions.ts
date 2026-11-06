import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { BUDGET_MAX, BUDGET_MIN, type FinderResult } from "./bouquet-finder.shared";
import { validateWith } from "./result";

const inputSchema = z.object({
  occasion: z.string().trim().min(2, "Tell us a little about the occasion").max(400),
  flowers: z.string().trim().max(200),
  budget: z.number().int().min(BUDGET_MIN).max(BUDGET_MAX),
});

export type FinderResponse = { ok: true; result: FinderResult } | { ok: false; error: string };

export const findBouquet = createServerFn({ method: "POST" })
  .validator(validateWith(inputSchema))
  .handler(async ({ data }): Promise<FinderResponse> => {
    if (!data.ok) return data;
    const { recommendBouquet, FinderError } = await import("./bouquet-finder.server");
    try {
      return { ok: true, result: await recommendBouquet(data.value) };
    } catch (error) {
      if (error instanceof FinderError) return { ok: false, error: error.message };
      console.error(error);
      return { ok: false, error: "Something went wrong. Please try again." };
    }
  });
