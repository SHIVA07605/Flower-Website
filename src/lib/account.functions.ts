import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { viewerMiddleware } from "./auth.middleware";
import { checkoutSchema } from "./orders";
import { validateWith } from "./result";
import type { PublicViewer } from "./viewer";

/** Who the server thinks the caller is, including whether they're an admin. */
export const getViewer = createServerFn({ method: "GET" })
  .middleware([viewerMiddleware])
  .handler(async ({ context }): Promise<PublicViewer | null> => {
    if (!context.viewer) return null;
    const { toPublicViewer } = await import("./server/viewer.server");
    return toPublicViewer(context.viewer);
  });

export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([viewerMiddleware])
  .handler(async ({ context }) => {
    const { run } = await import("./server/db.server");
    const { getAccount } = await import("./server/account.server");
    return run(() => getAccount(context.viewer));
  });

/** Guests can check out too; signed-in shoppers get the order linked to their account. */
export const placeOrder = createServerFn({ method: "POST" })
  .middleware([viewerMiddleware])
  .validator(validateWith(checkoutSchema))
  .handler(async ({ data, context }) => {
    if (!data.ok) return data;
    const { run } = await import("./server/db.server");
    const { placeOrder: place } = await import("./server/orders.server");
    const { clientAddress, enforceLimit, LIMITS } = await import("./server/rate-limit.server");
    return run(async () => {
      await enforceLimit(LIMITS.placeOrder, await clientAddress());
      return place(context.viewer, data.value);
    });
  });

const trackSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .regex(/^RM-?\d{4,}$/i, "Order numbers look like RM-10001"),
  email: z.string().trim().toLowerCase().email("Enter the email used for the order"),
});

export const trackOrder = createServerFn({ method: "POST" })
  .validator(validateWith(trackSchema))
  .handler(async ({ data }) => {
    if (!data.ok) return data;
    const { run } = await import("./server/db.server");
    const { trackOrder: track } = await import("./server/orders.server");
    const { clientAddress, enforceLimit, LIMITS } = await import("./server/rate-limit.server");
    const number = data.value.orderNumber.toUpperCase().replace(/^RM-?/, "RM-");
    return run(async () => {
      await enforceLimit(LIMITS.trackOrder, await clientAddress());
      return track(number, data.value.email);
    });
  });
