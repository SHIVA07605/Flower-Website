import type { ProductRow } from "./catalog";
import type { PublicReview } from "./reviews";
import type { SiteContent } from "./site-content";

/** Everything the storefront page needs, loaded on the server for each visit. */
export interface StorefrontPayload {
  content: SiteContent;
  productRows: ProductRow[];
  reviews: PublicReview[];
  /** False until the Supabase tables exist (the shop then runs on its built-in defaults). */
  dbReady: boolean;
}
