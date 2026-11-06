import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { viewerMiddleware } from "./auth.middleware";
import { validateWith } from "./result";
import { reviewSchema } from "./reviews";
import type { StorefrontPayload } from "./storefront-data";

/** Public storefront data for SSR: live copy, catalog edits and approved reviews. */
export const getStorefront = createServerFn({ method: "GET" }).handler(
  async (): Promise<StorefrontPayload> => {
    const { loadStorefront } = await import("./server/store.server");
    return loadStorefront();
  },
);

const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email").max(254),
});

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .validator(validateWith(newsletterSchema))
  .handler(async ({ data }) => {
    if (!data.ok) return data;
    const { run } = await import("./server/db.server");
    const { subscribeToNewsletter } = await import("./server/store.server");
    return run(() => subscribeToNewsletter(data.value.email));
  });

/** Signed-in shoppers only; reviews wait for admin approval before they're published. */
export const submitReview = createServerFn({ method: "POST" })
  .middleware([viewerMiddleware])
  .validator(validateWith(reviewSchema))
  .handler(async ({ data, context }) => {
    if (!data.ok) return data;
    const { run } = await import("./server/db.server");
    const { createReview } = await import("./server/store.server");
    const { requireViewer } = await import("./server/viewer.server");
    return run(() => createReview(requireViewer(context.viewer), data.value));
  });
