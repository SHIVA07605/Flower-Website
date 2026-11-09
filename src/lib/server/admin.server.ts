import type { z } from "zod";

import {
  MAX_UPLOAD_BYTES,
  STORE_TABLES,
  UPLOAD_TYPES,
  type AdminDashboardData,
  type CustomerRecord,
  type orderUpdateSchema,
  type productInputSchema,
  type reviewModerationSchema,
  type roleSchema,
  type SetupStatus,
  type StoreTable,
  type SubscriberRecord,
  type AdminGrantRecord,
  type adminGrantSchema,
} from "../admin-types";
import { baseSortOrder, isBaseBouquetId, mergeCatalog, slugify } from "../catalog";
import { istNow, ORDER_STATUSES, type OrderRecord } from "../orders";
import type { ReviewRecord, ReviewStatus } from "../reviews";
import { IMAGE_KEYS, isContentKey, type ContentKey } from "../site-content";
import { bouquets, getBaseBouquet } from "@/components/shop/products";
import { dbFailure, getServiceDb, requireServiceDb } from "./db.server";
import { serverEnv, ServiceError } from "./env.server";
import { ORDER_COLUMNS, toOrderRecord, type OrderRow } from "./orders.server";
import { loadCatalog, loadProductRows } from "./store.server";
import { forgetCachedViewers, requireAdmin, requireOwner, type Viewer } from "./viewer.server";

export const MEDIA_BUCKET = "site-media";

/* ---------------- Dashboard ---------------- */

export async function getDashboard(viewer: Viewer | null): Promise<AdminDashboardData> {
  requireAdmin(viewer);
  const env = serverEnv();
  const db = getServiceDb();
  const tables = Object.fromEntries(STORE_TABLES.map((t) => [t, false])) as Record<
    StoreTable,
    boolean
  >;
  const setup: SetupStatus = {
    serviceKey: db !== null,
    tables,
    dbReady: false,
    storageReady: false,
    rateLimitsReady: false,
    adminEmailsFromEnv: env.adminEmailsFromEnv,
    aiConfigured: env.aiConfigured,
  };
  if (!db) return { setup, stats: null, recentOrders: [] };

  const counts = await Promise.all(
    STORE_TABLES.map(async (table) => {
      // A GET, never `head: true`: supabase-js reports a HEAD request for a missing table
      // as a success (404 with no body becomes 204), which hid this setup check.
      const { count, error } = await db.from(table).select("*", { count: "exact" }).limit(0);
      return { table, ok: !error, count: count ?? 0 };
    }),
  );
  for (const c of counts) tables[c.table] = c.ok;
  setup.dbReady = counts.every((c) => c.ok);
  const [{ data: bucket }, rateLimits] = await Promise.all([
    db.storage.getBucket(MEDIA_BUCKET),
    db.from("rate_limits").select("key").limit(0),
  ]);
  setup.storageReady = Boolean(bucket);
  setup.rateLimitsReady = !rateLimits.error;
  if (!setup.dbReady) return { setup, stats: null, recentOrders: [] };

  const countOf = (table: StoreTable) => counts.find((c) => c.table === table)?.count ?? 0;
  const [orderStats, pending, recent] = await Promise.all([
    db.from("orders").select("status,payment_status,total_amount,created_at").limit(10_000),
    db.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("orders").select(ORDER_COLUMNS).order("created_at", { ascending: false }).limit(6),
  ]);
  if (orderStats.error) throw dbFailure(orderStats.error, "load order stats");
  if (recent.error) throw dbFailure(recent.error, "load recent orders");

  const today = istNow().date;
  const rows = (orderStats.data ?? []) as Pick<
    OrderRow,
    "status" | "payment_status" | "total_amount" | "created_at"
  >[];
  const live = rows.filter((o) => o.status !== "cancelled");
  return {
    setup,
    stats: {
      revenue: live
        .filter((o) => o.payment_status === "paid")
        .reduce((sum, o) => sum + Number(o.total_amount), 0),
      ordersTotal: rows.length,
      ordersOpen: live.filter((o) => o.status !== "delivered").length,
      ordersToday: rows.filter((o) => istNow(new Date(o.created_at)).date === today).length,
      pendingReviews: pending.count ?? 0,
      customers: countOf("profiles"),
      subscribers: countOf("newsletter_subscribers"),
    },
    recentOrders: ((recent.data ?? []) as OrderRow[]).map((r) =>
      toOrderRecord(r, { forAdmin: true }),
    ),
  };
}

/* ---------------- Site content, pictures & billing ---------------- */

const NUMERIC_LIMITS: Partial<Record<ContentKey, [label: string, max: number]>> = {
  billing_standard_delivery: ["Standard delivery fee", 10_000],
  billing_express_delivery: ["Express surcharge", 10_000],
  billing_free_shipping_threshold: ["Free delivery minimum", 1_000_000],
  billing_tax_rate: ["Tax rate", 50],
  promo_percent: ["Promo discount", 90],
};

function checkContentValue(key: ContentKey, value: string) {
  if (value === "") return;
  const numeric = NUMERIC_LIMITS[key];
  if (numeric) {
    const n = Number(value);
    const [label, max] = numeric;
    if (!Number.isFinite(n) || n < 0 || n > max) {
      throw new ServiceError(
        `${label} must be a number between 0 and ${max.toLocaleString("en-IN")}.`,
      );
    }
  }
  if (key === "promo_code" && !/^[A-Za-z0-9]{3,20}$/.test(value)) {
    throw new ServiceError("Promo codes use 3–20 letters or numbers, with no spaces.");
  }
  if ((IMAGE_KEYS as readonly string[]).includes(key) && !/^https?:\/\/\S+$/i.test(value)) {
    throw new ServiceError("Pictures need a full https:// link (or use Upload).");
  }
}

/** Saves edited copy/settings. An empty value removes the edit so the default shows again. */
export async function saveContent(viewer: Viewer | null, updates: Record<string, string>) {
  requireAdmin(viewer);
  const entries = Object.entries(updates)
    .filter((entry): entry is [ContentKey, string] => isContentKey(entry[0]))
    .map(([key, value]) => [key, value.trim()] as const);
  if (entries.length === 0) throw new ServiceError("There's nothing to save.");
  for (const [key, value] of entries) checkContentValue(key, value);

  const db = requireServiceDb();
  const upserts = entries
    .filter(([, value]) => value !== "")
    .map(([section_key, text_content]) => ({ section_key, text_content }));
  const removals = entries.filter(([, value]) => value === "").map(([key]) => key);

  if (upserts.length > 0) {
    const { error } = await db.from("site_content").upsert(upserts, { onConflict: "section_key" });
    if (error) throw dbFailure(error, "save your changes");
  }
  if (removals.length > 0) {
    const { error } = await db.from("site_content").delete().in("section_key", removals);
    if (error) throw dbFailure(error, "reset those fields");
  }
  return { saved: entries.length };
}

export async function uploadMedia(viewer: Viewer | null, file: File) {
  requireAdmin(viewer);
  if (!UPLOAD_TYPES.includes(file.type)) {
    throw new ServiceError("Upload a JPG, PNG, WebP, AVIF or GIF picture.");
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new ServiceError("Pictures must be 5 MB or smaller.");

  const db = requireServiceDb();
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const path = `uploads/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new ServiceError(
        "The site-media storage bucket doesn't exist yet. Run the setup SQL again.",
        503,
      );
    }
    console.error("[admin] upload failed:", error.message);
    throw new ServiceError("The picture couldn't be uploaded. Please try again.", 500);
  }
  return { url: db.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl };
}

/* ---------------- Products ---------------- */

export async function listProducts(viewer: Viewer | null) {
  requireAdmin(viewer);
  return loadCatalog({ includeHidden: true });
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

async function uniqueProductId(slug: string): Promise<string> {
  const db = requireServiceDb();
  const { data, error } = await db.from("products").select("id").like("id", `${slug}%`);
  if (error) throw dbFailure(error, "check the bouquet name");
  const taken = new Set([
    ...((data ?? []) as { id: string }[]).map((r) => r.id),
    ...bouquets.map((b) => b.id),
  ]);
  if (!taken.has(slug)) return slug;
  for (let n = 2; n < 1000; n++) {
    if (!taken.has(`${slug}-${n}`)) return `${slug}-${n}`;
  }
  return `${slug}-${Date.now()}`;
}

/**
 * Base bouquets store only what differs from products.ts (null = keep the original), so
 * future catalog updates still flow through. Admin-added bouquets store every field.
 */
export async function saveProduct(
  viewer: Viewer | null,
  input: z.output<typeof productInputSchema>,
) {
  requireAdmin(viewer);
  const db = requireServiceDb();
  const base = input.id ? getBaseBouquet(input.id) : undefined;

  if (base) {
    const index = bouquets.indexOf(base);
    const row = {
      id: base.id,
      name: input.name === base.name ? null : input.name,
      maker: input.maker === base.maker ? null : input.maker,
      price: input.price === base.price ? null : input.price,
      image_url: input.imageUrl && input.imageUrl !== base.image ? input.imageUrl : null,
      flowers: sameList(input.flowers, base.flowers) ? null : input.flowers,
      palette: input.palette === base.palette || input.palette === "" ? null : input.palette,
      occasions: sameList(input.occasions, base.occasions) ? null : input.occasions,
      blurb: input.blurb === base.blurb || input.blurb === "" ? null : input.blurb,
      is_active: input.isActive,
      is_featured: input.isFeatured === (base.bestSeller ?? false) ? null : input.isFeatured,
      sort_order: input.sortOrder === baseSortOrder(index) ? null : input.sortOrder,
    };
    const { error } = await db.from("products").upsert(row, { onConflict: "id" });
    if (error) throw dbFailure(error, "save the bouquet");
    return { id: base.id };
  }

  if (!input.imageUrl) throw new ServiceError("Add a photo for the new bouquet.");
  let id = input.id;
  if (id) {
    const { data, error } = await db.from("products").select("id").eq("id", id).maybeSingle();
    if (error) throw dbFailure(error, "find the bouquet");
    if (!data) throw new ServiceError("That bouquet no longer exists.", 404);
  } else {
    id = await uniqueProductId(slugify(input.name));
  }

  const { error } = await db.from("products").upsert(
    {
      id,
      name: input.name,
      maker: input.maker,
      price: input.price,
      image_url: input.imageUrl,
      flowers: input.flowers,
      palette: input.palette || null,
      occasions: input.occasions,
      blurb: input.blurb || null,
      is_active: input.isActive,
      is_featured: input.isFeatured,
      sort_order: input.sortOrder,
    },
    { onConflict: "id" },
  );
  if (error) throw dbFailure(error, "save the bouquet");
  return { id };
}

/** Base bouquet: drops the admin's edits. Admin-added bouquet: deletes it. */
export async function removeProduct(viewer: Viewer | null, id: string) {
  requireAdmin(viewer);
  const db = requireServiceDb();
  const { error } = await db.from("products").delete().eq("id", id);
  if (error) throw dbFailure(error, "update the catalog");
  return { reset: isBaseBouquetId(id) };
}

/* ---------------- Orders ---------------- */

export async function listOrders(
  viewer: Viewer | null,
  filters: { status?: string | undefined; search?: string | undefined },
): Promise<OrderRecord[]> {
  requireAdmin(viewer);
  const db = requireServiceDb();
  let query = db
    .from("orders")
    .select(ORDER_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  if (filters.status && (ORDER_STATUSES as readonly string[]).includes(filters.status)) {
    query = query.eq("status", filters.status);
  } else if (filters.status === "open") {
    query = query.not("status", "in", "(delivered,cancelled)");
  }
  const term = filters.search?.replace(/[^\p{L}\p{N}@.+\- ]/gu, "").trim();
  if (term) {
    const like = `*${term}*`;
    query = query.or(
      [
        `order_number.ilike.${like}`,
        `customer_name.ilike.${like}`,
        `customer_email.ilike.${like}`,
        `customer_phone.ilike.${like}`,
        `recipient_name.ilike.${like}`,
      ].join(","),
    );
  }
  const { data, error } = await query;
  if (error) throw dbFailure(error, "load orders");
  return ((data ?? []) as OrderRow[]).map((r) => toOrderRecord(r, { forAdmin: true }));
}

export async function updateOrder(
  viewer: Viewer | null,
  input: z.output<typeof orderUpdateSchema>,
): Promise<OrderRecord> {
  requireAdmin(viewer);
  const patch = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.paymentStatus ? { payment_status: input.paymentStatus } : {}),
    ...(input.adminNote !== undefined ? { admin_note: input.adminNote } : {}),
  };
  if (Object.keys(patch).length === 0) throw new ServiceError("There's nothing to update.");
  const db = requireServiceDb();
  const { data, error } = await db
    .from("orders")
    .update(patch)
    .eq("id", input.id)
    .select(ORDER_COLUMNS)
    .maybeSingle();
  if (error) throw dbFailure(error, "update the order");
  if (!data) throw new ServiceError("That order no longer exists.", 404);
  return toOrderRecord(data as OrderRow, { forAdmin: true });
}

/* ---------------- Reviews ---------------- */

interface ReviewRow {
  id: string;
  product_id: string;
  user_id: string;
  author_name: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  created_at: string;
  moderated_at: string | null;
}

export const REVIEW_COLUMNS =
  "id,product_id,user_id,author_name,rating,body,status,created_at,moderated_at";

export async function toReviewRecords(rows: ReviewRow[]): Promise<ReviewRecord[]> {
  const catalog = mergeCatalog(await loadProductRows(), { includeHidden: true });
  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    productName: catalog.find((p) => p.id === r.product_id)?.name ?? "Retired bouquet",
    userId: r.user_id,
    authorName: r.author_name,
    rating: r.rating,
    body: r.body,
    status: r.status,
    createdAt: r.created_at,
    moderatedAt: r.moderated_at,
  }));
}

export async function listReviews(viewer: Viewer | null): Promise<ReviewRecord[]> {
  requireAdmin(viewer);
  const db = requireServiceDb();
  const { data, error } = await db
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw dbFailure(error, "load reviews");
  return toReviewRecords((data ?? []) as ReviewRow[]);
}

export async function moderateReview(
  viewer: Viewer | null,
  input: z.output<typeof reviewModerationSchema>,
) {
  requireAdmin(viewer);
  const db = requireServiceDb();
  const { error } = await db
    .from("reviews")
    .update({ status: input.status, moderated_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) throw dbFailure(error, "update the review");
  return { id: input.id, status: input.status };
}

export async function deleteReview(viewer: Viewer | null, id: string) {
  requireAdmin(viewer);
  const db = requireServiceDb();
  const { error } = await db.from("reviews").delete().eq("id", id);
  if (error) throw dbFailure(error, "delete the review");
  return { id };
}

/* ---------------- Customers ---------------- */

interface ProfileRow {
  id: string;
  provider: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: "admin" | "user";
  created_at: string;
  last_seen_at: string;
}

export async function listCustomers(
  viewer: Viewer | null,
): Promise<{ customers: CustomerRecord[]; subscribers: SubscriberRecord[] }> {
  requireAdmin(viewer);
  const db = requireServiceDb();
  const [profiles, orders, subscribers] = await Promise.all([
    db
      .from("profiles")
      .select("id,provider,email,display_name,avatar_url,role,created_at,last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(500),
    db.from("orders").select("id,user_id,customer_email,total_amount,status").limit(10_000),
    db
      .from("newsletter_subscribers")
      .select("email,created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  if (profiles.error) throw dbFailure(profiles.error, "load customers");
  if (orders.error) throw dbFailure(orders.error, "load customer orders");
  if (subscribers.error) throw dbFailure(subscribers.error, "load subscribers");

  const { adminEmails } = serverEnv();
  const orderRows = (orders.data ?? []) as Pick<
    OrderRow,
    "id" | "user_id" | "customer_email" | "total_amount" | "status"
  >[];
  const customers = ((profiles.data ?? []) as ProfileRow[]).map((p): CustomerRecord => {
    const mine = orderRows.filter(
      (o) =>
        o.status !== "cancelled" &&
        (o.user_id === p.id || (p.email !== null && o.customer_email === p.email)),
    );
    return {
      id: p.id,
      provider: p.provider,
      email: p.email,
      name: p.display_name,
      avatarUrl: p.avatar_url,
      role: p.role,
      isAdmin: p.role === "admin" || (p.email !== null && adminEmails.includes(p.email)),
      createdAt: p.created_at,
      lastSeenAt: p.last_seen_at,
      orders: mine.length,
      spent: mine.reduce((sum, o) => sum + Number(o.total_amount), 0),
    };
  });
  return {
    customers,
    subscribers: ((subscribers.data ?? []) as { email: string; created_at: string }[]).map((s) => ({
      email: s.email,
      createdAt: s.created_at,
    })),
  };
}

export async function setCustomerRole(viewer: Viewer | null, input: z.output<typeof roleSchema>) {
  const admin = requireOwner(viewer);
  if (input.id === admin.id && input.role === "user") {
    throw new ServiceError("You can't remove your own admin access.");
  }
  const db = requireServiceDb();
  const { data, error } = await db
    .from("profiles")
    .update({ role: input.role })
    .eq("id", input.id)
    .select("id")
    .maybeSingle();
  if (error) throw dbFailure(error, "update that account");
  if (!data) throw new ServiceError("That account no longer exists.", 404);
  return { id: input.id, role: input.role };
}

/* ---------------- Admin access (owners only) ---------------- */

interface GrantRow {
  email: string;
  expires_at: string | null;
  note: string;
  granted_by: string;
  created_at: string;
}

export async function listAdminGrants(viewer: Viewer | null): Promise<AdminGrantRecord[]> {
  requireOwner(viewer);
  const db = requireServiceDb();
  const { data, error } = await db
    .from("admin_grants")
    .select("email,expires_at,note,granted_by,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw dbFailure(error, "load admin access");
  const rows = (data ?? []) as GrantRow[];
  const emails = rows.map((r) => r.email);
  const signedIn = new Set<string>();
  if (emails.length > 0) {
    const { data: profiles, error: profileError } = await db
      .from("profiles")
      .select("email")
      .in("email", emails);
    if (profileError) throw dbFailure(profileError, "load admin access");
    for (const p of (profiles ?? []) as { email: string | null }[]) {
      if (p.email) signedIn.add(p.email.toLowerCase());
    }
  }
  const now = Date.now();
  return rows.map((r) => ({
    email: r.email,
    expiresAt: r.expires_at,
    active: r.expires_at === null || new Date(r.expires_at).getTime() > now,
    note: r.note,
    grantedBy: r.granted_by,
    createdAt: r.created_at,
    hasSignedIn: signedIn.has(r.email),
  }));
}

/** Gives (or extends/shortens) someone's admin access. */
export async function saveAdminGrant(
  viewer: Viewer | null,
  input: z.output<typeof adminGrantSchema>,
) {
  const owner = requireOwner(viewer);
  if (serverEnv().adminEmails.includes(input.email)) {
    throw new ServiceError("That email is already an owner (set in ADMIN_EMAILS).");
  }
  if (input.expiresAt !== null && new Date(input.expiresAt).getTime() <= Date.now() + 60_000) {
    throw new ServiceError("Choose an end time in the future.");
  }
  const db = requireServiceDb();
  const { error } = await db.from("admin_grants").upsert(
    {
      email: input.email,
      expires_at: input.expiresAt,
      note: input.note,
      granted_by: owner.email ?? owner.id,
    },
    { onConflict: "email" },
  );
  if (error) throw dbFailure(error, "save admin access");
  forgetCachedViewers();
  return { email: input.email, expiresAt: input.expiresAt };
}

/** Removes someone's admin access straight away (including a permanent admin role). */
export async function revokeAdminGrant(viewer: Viewer | null, email: string) {
  requireOwner(viewer);
  const db = requireServiceDb();
  const [grant, role] = await Promise.all([
    db.from("admin_grants").delete().eq("email", email),
    db.from("profiles").update({ role: "user" }).eq("email", email),
  ]);
  if (grant.error) throw dbFailure(grant.error, "remove admin access");
  if (role.error) throw dbFailure(role.error, "remove admin access");
  forgetCachedViewers();
  return { email };
}
