import { z } from "zod";

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** An approved review as shown on the storefront. */
export interface PublicReview {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
}

/** A review with moderation details (admin dashboard and the shopper's own account page). */
export interface ReviewRecord extends PublicReview {
  status: ReviewStatus;
  userId: string;
  moderatedAt: string | null;
  productName: string;
}

export const reviewSchema = z.object({
  productId: z.string().min(1).max(64),
  rating: z.number().int().min(1).max(5),
  body: z
    .string()
    .trim()
    .min(3, "Tell us a little more about your bouquet")
    .max(1000, "Keep your review under 1000 characters"),
});

export type ReviewInput = z.input<typeof reviewSchema>;

/** "Hannah Kapoor" → "Hannah K." — reviews never show a shopper's full name or email. */
export function publicAuthorName(
  name: string | null | undefined,
  email: string | null | undefined,
) {
  const source = (name ?? "").trim() || (email ?? "").split("@")[0] || "Reelmark customer";
  const [first = "", ...rest] = source.split(/\s+/);
  const last = rest.at(-1);
  const firstName = first.charAt(0).toUpperCase() + first.slice(1);
  return last ? `${firstName} ${last.charAt(0).toUpperCase()}.` : firstName;
}
