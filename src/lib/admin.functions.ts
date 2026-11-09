import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  adminGrantSchema,
  contentUpdateSchema,
  revokeGrantSchema,
  orderUpdateSchema,
  productInputSchema,
  reviewModerationSchema,
  roleSchema,
} from "./admin-types";
import { viewerMiddleware } from "./auth.middleware";
import { validateWith, type Parsed } from "./result";

// Every handler re-checks admin access on the server (requireAdmin) before touching data.

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([viewerMiddleware])
  .handler(async ({ context }) => {
    const { run } = await import("./server/db.server");
    const { getDashboard } = await import("./server/admin.server");
    return run(() => getDashboard(context.viewer), { audience: "admin" });
  });

export const saveSiteContent = createServerFn({ method: "POST" })
  .middleware([viewerMiddleware])
  .validator(validateWith(contentUpdateSchema))
  .handler(async ({ data, context }) => {
    if (!data.ok) return data;
    const { run } = await import("./server/db.server");
    const { saveContent } = await import("./server/admin.server");
    return run(() => saveContent(context.viewer, data.value), { audience: "admin" });
  });

export const uploadMedia = createServerFn({ method: "POST" })
  .middleware([viewerMiddleware])
  .validator((data: FormData): Parsed<File> => {
    const file = data instanceof FormData ? data.get("file") : null;
    return file instanceof File
      ? { ok: true, value: file }
      : { ok: false, error: "Choose a picture to upload." };
  })
  .handler(async ({ data, context }) => {
    if (!data.ok) return data;
    const { run } = await import("./server/db.server");
    const { uploadMedia: upload } = await import("./server/admin.server");
    return run(() => upload(context.viewer, data.value), { audience: "admin" });
  });

export const listAdminProducts = createServerFn({ method: "GET" })
  .middleware([viewerMiddleware])
  .handler(async ({ context }) => {
    const { run } = await import("./server/db.server");
    const { listProducts } = await import("./server/admin.server");
    return run(() => listProducts(context.viewer), { audience: "admin" });
  });

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([viewerMiddleware])
  .validator(validateWith(productInputSchema))
  .handler(async ({ data, context }) => {
    if (!data.ok) return data;
    const { run } = await import("./server/db.server");
    const { saveProduct: save } = await import("./server/admin.server");
    return run(() => save(context.viewer, data.value), { audience: "admin" });
  });

const idSchema = z.object({ id: z.string().min(1).max(200) });

export const removeProduct = createServerFn({ method: "POST" })
  .middleware([viewerMiddleware])
  .validator(validateWith(idSchema))
  .handler(async ({ data, context }) => {
    if (!data.ok) return data;
    const { run } = await import("./server/db.server");
    const { removeProduct: remove } = await import("./server/admin.server");
    return run(() => remove(context.viewer, data.value.id), { audience: "admin" });
  });

const orderFilterSchema = z.object({
  status: z.string().max(40).optional(),
  search: z.string().max(80).optional(),
});

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([viewerMiddleware])
  .validator(validateWith(orderFilterSchema))
  .handler(async ({ data, context }) => {
    if (!data.ok) return data;
    const { run } = await import("./server/db.server");
    const { listOrders } = await import("./server/admin.server");
    return run(() => listOrders(context.viewer, data.value), { audience: "admin" });
  });

export const updateAdminOrder = createServerFn({ method: "POST" })
  .middleware([viewerMiddleware])
  .validator(validateWith(orderUpdateSchema))
  .handler(async ({ data, context }) => {
    if (!data.ok) return data;
    const { run } = await import("./server/db.server");
    const { updateOrder } = await import("./server/admin.server");
    return run(() => updateOrder(context.viewer, data.value), { audience: "admin" });
  });

export const listAdminReviews = createServerFn({ method: "GET" })
  .middleware([viewerMiddleware])
  .handler(async ({ context }) => {
    const { run } = await import("./server/db.server");
    const { listReviews } = await import("./server/admin.server");
    return run(() => listReviews(context.viewer), { audience: "admin" });
  });

export const moderateReview = createServerFn({ method: "POST" })
  .middleware([viewerMiddleware])
  .validator(validateWith(reviewModerationSchema))
  .handler(async ({ data, context }) => {
    if (!data.ok) return data;
    const { run } = await import("./server/db.server");
    const { moderateReview: moderate } = await import("./server/admin.server");
    return run(() => moderate(context.viewer, data.value), { audience: "admin" });
  });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([viewerMiddleware])
  .validator(validateWith(idSchema))
  .handler(async ({ data, context }) => {
    if (!data.ok) return data;
    const { run } = await import("./server/db.server");
    const { deleteReview: remove } = await import("./server/admin.server");
    return run(() => remove(context.viewer, data.value.id), { audience: "admin" });
  });

export const listAdminCustomers = createServerFn({ method: "GET" })
  .middleware([viewerMiddleware])
  .handler(async ({ context }) => {
    const { run } = await import("./server/db.server");
    const { listCustomers } = await import("./server/admin.server");
    return run(() => listCustomers(context.viewer), { audience: "admin" });
  });

export const setCustomerRole = createServerFn({ method: "POST" })
  .middleware([viewerMiddleware])
  .validator(validateWith(roleSchema))
  .handler(async ({ data, context }) => {
    if (!data.ok) return data;
    const { run } = await import("./server/db.server");
    const { setCustomerRole: setRole } = await import("./server/admin.server");
    return run(() => setRole(context.viewer, data.value), { audience: "admin" });
  });

export const listAdminGrants = createServerFn({ method: "GET" })
  .middleware([viewerMiddleware])
  .handler(async ({ context }) => {
    const { run } = await import("./server/db.server");
    const { listAdminGrants: list } = await import("./server/admin.server");
    return run(() => list(context.viewer), { audience: "admin" });
  });

export const saveAdminGrant = createServerFn({ method: "POST" })
  .middleware([viewerMiddleware])
  .validator(validateWith(adminGrantSchema))
  .handler(async ({ data, context }) => {
    if (!data.ok) return data;
    const { run } = await import("./server/db.server");
    const { saveAdminGrant: save } = await import("./server/admin.server");
    return run(() => save(context.viewer, data.value), { audience: "admin" });
  });

export const revokeAdminGrant = createServerFn({ method: "POST" })
  .middleware([viewerMiddleware])
  .validator(validateWith(revokeGrantSchema))
  .handler(async ({ data, context }) => {
    if (!data.ok) return data;
    const { run } = await import("./server/db.server");
    const { revokeAdminGrant: revoke } = await import("./server/admin.server");
    return run(() => revoke(context.viewer, data.value.email), { audience: "admin" });
  });
