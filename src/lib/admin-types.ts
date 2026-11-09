import { z } from "zod";

import { OCCASIONS } from "@/components/shop/products";
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderRecord } from "./orders";
import { REVIEW_STATUSES } from "./reviews";

export const STORE_TABLES = [
  "profiles",
  "products",
  "site_content",
  "orders",
  "reviews",
  "newsletter_subscribers",
  "admin_grants",
] as const;
export type StoreTable = (typeof STORE_TABLES)[number];

export interface SetupStatus {
  /** SUPABASE_SERVICE_ROLE_KEY is available to the server. */
  serviceKey: boolean;
  tables: Record<StoreTable, boolean>;
  dbReady: boolean;
  /** The `site-media` storage bucket exists (needed for picture uploads). */
  storageReady: boolean;
  /** The shared `rate_limits` table exists (otherwise each server instance counts alone). */
  rateLimitsReady: boolean;
  adminEmailsFromEnv: boolean;
  aiConfigured: boolean;
}

export interface DashboardStats {
  revenue: number;
  ordersTotal: number;
  ordersOpen: number;
  ordersToday: number;
  pendingReviews: number;
  customers: number;
  subscribers: number;
}

export interface AdminDashboardData {
  setup: SetupStatus;
  stats: DashboardStats | null;
  recentOrders: OrderRecord[];
}

export interface CustomerRecord {
  id: string;
  provider: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  role: "admin" | "user";
  /** Admin by role or by the ADMIN_EMAILS allowlist. */
  isAdmin: boolean;
  createdAt: string;
  lastSeenAt: string;
  orders: number;
  spent: number;
}

export interface SubscriberRecord {
  email: string;
  createdAt: string;
}

const imageUrl = z
  .string()
  .trim()
  .max(1000)
  .refine(
    // Site-relative paths are fine; "//host/…" would load from another site, so it isn't.
    (v) => /^https?:\/\/\S+$/i.test(v) || /^\/(?!\/)\S*$/.test(v),
    "Use an https:// image link or upload a picture",
  );

export const productInputSchema = z.object({
  /** Omit to create a new bouquet. */
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(64)
    .optional(),
  name: z.string().trim().min(2, "Give the bouquet a name").max(80),
  maker: z.string().trim().min(1, "Which studio makes it?").max(60),
  price: z.number().positive("Price must be more than ₹0").max(100_000),
  /** null keeps the original photo (base bouquets only). */
  imageUrl: imageUrl.nullable(),
  flowers: z.array(z.string().trim().min(1).max(40)).min(1, "List at least one flower").max(12),
  palette: z.string().trim().max(80),
  occasions: z.array(z.enum(OCCASIONS)).min(1, "Pick at least one occasion"),
  blurb: z.string().trim().max(300),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder: z.number().int().min(0).max(100_000),
});
export type ProductInput = z.input<typeof productInputSchema>;

export const orderUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  adminNote: z.string().trim().max(500).optional(),
});
export type OrderUpdateInput = z.input<typeof orderUpdateSchema>;

export const reviewModerationSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(REVIEW_STATUSES),
});

export const roleSchema = z.object({
  id: z.string().min(3).max(200),
  role: z.enum(["admin", "user"]),
});

export const contentUpdateSchema = z.record(z.string(), z.string().max(4000));

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

/** Someone the owner gave admin access to. */
export interface AdminGrantRecord {
  email: string;
  /** ISO date the access ends; null = until the owner removes it. */
  expiresAt: string | null;
  active: boolean;
  note: string;
  grantedBy: string;
  createdAt: string;
  /** Has signed in at least once (has a profile). */
  hasSignedIn: boolean;
}

export const adminGrantSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter the person's email address").max(254),
  /** ISO date-time; null = no end date. */
  expiresAt: z.string().datetime({ offset: true, message: "Choose a valid end date" }).nullable(),
  note: z.string().trim().max(200).default(""),
});
export type AdminGrantInput = z.input<typeof adminGrantSchema>;

export const revokeGrantSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});
