import type { SupabaseClient } from "@supabase/supabase-js";

import { mergeCatalog, type CatalogItem, type ProductRow } from "../catalog";
import { readBillingSettings } from "../billing";
import { publicAuthorName, type PublicReview, type reviewSchema } from "../reviews";
import {
  DEFAULT_SITE_CONTENT,
  mergeSiteContent,
  type SiteContent,
  type SiteContentRow,
} from "../site-content";
import type { StorefrontPayload } from "../storefront-data";
import { dbFailure, getAnonDb, getServiceDb, isMissingTable, requireServiceDb } from "./db.server";
import { ServiceError } from "./env.server";
import type { Viewer } from "./viewer.server";
import type { z } from "zod";

export const PRODUCT_COLUMNS =
  "id,name,maker,price,image_url,flowers,palette,occasions,blurb,is_active,is_featured,sort_order,updated_at";

const readDb = (): SupabaseClient | null => getServiceDb() ?? getAnonDb();

interface Loaded<T> {
  rows: T[];
  /** The table could be read (it exists and the database is reachable). */
  ok: boolean;
}

async function loadContentRows(db: SupabaseClient | null): Promise<Loaded<SiteContentRow>> {
  if (!db) return { rows: [], ok: false };
  const { data, error } = await db.from("site_content").select("section_key,text_content");
  if (error) {
    if (!isMissingTable(error)) console.warn("[store] site_content:", error.message);
    return { rows: [], ok: false };
  }
  return { rows: (data ?? []) as SiteContentRow[], ok: true };
}

async function loadProductRowsFrom(db: SupabaseClient | null): Promise<Loaded<ProductRow>> {
  if (!db) return { rows: [], ok: false };
  const { data, error } = await db.from("products").select(PRODUCT_COLUMNS);
  if (error) {
    if (!isMissingTable(error)) console.warn("[store] products:", error.message);
    return { rows: [], ok: false };
  }
  return { rows: (data ?? []) as ProductRow[], ok: true };
}

export async function loadContent(): Promise<SiteContent> {
  const { rows } = await loadContentRows(readDb());
  return mergeSiteContent(rows);
}

export async function loadProductRows(): Promise<ProductRow[]> {
  return (await loadProductRowsFrom(readDb())).rows;
}

/** The live catalog (products.ts + admin edits) — the same one the storefront shows. */
export async function loadCatalog(opts: { includeHidden?: boolean } = {}): Promise<CatalogItem[]> {
  return mergeCatalog(await loadProductRows(), opts);
}

interface ReviewRow {
  id: string;
  product_id: string;
  author_name: string;
  rating: number;
  body: string;
  created_at: string;
}

async function loadApprovedReviews(limit = 40): Promise<PublicReview[]> {
  const db = getServiceDb();
  if (!db) return [];
  const { data, error } = await db
    .from("reviews")
    .select("id,product_id,author_name,rating,body,created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (!isMissingTable(error)) console.warn("[store] reviews:", error.message);
    return [];
  }
  return ((data ?? []) as ReviewRow[]).map((r) => ({
    id: r.id,
    productId: r.product_id,
    authorName: r.author_name,
    rating: r.rating,
    body: r.body,
    createdAt: r.created_at,
  }));
}

/** Never throws: if the database is unreachable the shop still renders with its defaults. */
export async function loadStorefront(): Promise<StorefrontPayload> {
  try {
    const db = readDb();
    const [content, products, reviews] = await Promise.all([
      loadContentRows(db),
      loadProductRowsFrom(db),
      loadApprovedReviews(),
    ]);
    return {
      content: mergeSiteContent(content.rows),
      productRows: products.rows,
      reviews,
      dbReady: content.ok && products.ok,
    };
  } catch (error) {
    console.error("[store] storefront load failed:", error);
    return { content: { ...DEFAULT_SITE_CONTENT }, productRows: [], reviews: [], dbReady: false };
  }
}

export async function subscribeToNewsletter(email: string) {
  const db = requireServiceDb();
  const { error } = await db
    .from("newsletter_subscribers")
    .upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  if (error) throw dbFailure(error, "save your subscription");
  const billing = readBillingSettings(await loadContent());
  return billing.promoCode !== "" && billing.promoPercent > 0
    ? { promoCode: billing.promoCode, promoPercent: billing.promoPercent }
    : { promoCode: null, promoPercent: 0 };
}

export async function createReview(viewer: Viewer, input: z.output<typeof reviewSchema>) {
  const db = requireServiceDb();
  const catalog = mergeCatalog((await loadProductRowsFrom(db)).rows);
  const product = catalog.find((p) => p.id === input.productId);
  if (!product) throw new ServiceError("That bouquet isn't available to review.", 404);

  const { count, error: countError } = await db
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", viewer.id)
    .eq("product_id", product.id)
    .eq("status", "pending");
  if (countError) throw dbFailure(countError, "check your reviews");
  if ((count ?? 0) > 0) {
    throw new ServiceError("You already have a review for this bouquet waiting for approval.", 409);
  }

  const { error } = await db.from("reviews").insert({
    product_id: product.id,
    user_id: viewer.id,
    author_name: publicAuthorName(viewer.name, viewer.email),
    rating: input.rating,
    body: input.body,
  });
  if (error) throw dbFailure(error, "save your review");
  return { productName: product.name };
}
