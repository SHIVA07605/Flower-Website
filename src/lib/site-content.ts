/**
 * Every piece of storefront copy, imagery and billing configuration the admin can edit,
 * with the value the site ships with. The database (`site_content`) only stores edits;
 * a missing or empty value always falls back to the default here.
 */
export const DEFAULT_SITE_CONTENT = {
  // Hero
  hero_kicker: "Trusted by 120,000+ flower lovers",
  hero_title_1: "Shop the Blooms",
  hero_title_2: "You Saw in Reels",
  hero_subtitle:
    "Hand-tied bouquets from indie florists, shown in short, snappy reels. Tap any reel to see it up close, then send it across town today.",
  hero_cta: "Shop Now",
  hero_note_tap: "Tap a reel\nto shop it",
  hero_note_sameday: "Same-day",

  // Delivery promises
  delivery_promise_1_title: "Same-day delivery",
  delivery_promise_1_body: "Order by 2pm, at their door tonight",
  delivery_promise_2_title: "7-day freshness guarantee",
  delivery_promise_2_body: "Wilted early? We'll replace it free",
  delivery_promise_3_title: "Hand-tied by local florists",
  delivery_promise_3_body: "Never boxed in a warehouse",
  delivery_promise_4_title: "Free handwritten card",
  delivery_promise_4_body: "Your words, in real ink",

  // Bouquet gallery
  gallery_kicker: "The Reelmark Bouquet",
  gallery_title: "Every stem, gathered in one place",
  gallery_desc:
    "Our florists cut, condition and hand-tie every bouquet the morning it ships. These are a few of today's favourites, straight from the studio bench.",

  // Occasions
  occasions_kicker: "Shop by occasion",
  occasions_title: "Whatever the moment, there's a bouquet",
  occasions_desc: "Pick a moment and our bouquet finder will start from there.",

  // AI bouquet finder
  finder_kicker: "AI Bouquet Finder",
  finder_title: "Tell us the moment, we'll pick the stems",
  finder_desc:
    "Describe the occasion, the flowers they love and what you'd like to spend. Our AI florist matches it to the best bouquet in today's studio.",

  // Best sellers
  bestsellers_kicker: "Best sellers",
  bestsellers_title: "The bouquets everyone's sending",
  bestsellers_sub: "Restocked every morning. Order by 2pm for delivery today.",

  // Reviews
  reviews_kicker: "4.9 from 18,000+ reviews",
  reviews_title: "Sent with love, received with joy",

  // Makers
  makers_kicker: "Meet the makers",
  makers_title: "Real florists, real benches, real hands",
  makers_desc:
    "Every Reelmark bouquet is made by an independent studio in your city, never a warehouse.",

  // Newsletter
  newsletter_kicker: "a little something for you",
  newsletter_title: "15% off your first bouquet",
  newsletter_desc:
    "Join the Reelmark letter for new drops, seasonal stems and florist tips. Your code arrives instantly.",
  newsletter_cta: "Get my 15% off",

  // Footer
  footer_tagline: "Fresh bouquets from indie florists, delivered today.",
  footer_copyright: "© 2026 Reelmark Inc. Handcrafted blooms for every moment.",

  // Picture overrides (empty = the bundled original)
  image_hero_floral_top: "",
  image_hero_floral_bottom: "",
  image_bouquet_center: "",
  image_maker_1: "",
  image_maker_2: "",
  image_maker_3: "",
  image_maker_4: "",

  // Billing (Indian Rupees)
  billing_standard_delivery: "149",
  billing_express_delivery: "249",
  billing_free_shipping_threshold: "999",
  billing_tax_rate: "18",
  promo_code: "BLOOM15",
  promo_percent: "15",
} as const satisfies Record<string, string>;

export type ContentKey = keyof typeof DEFAULT_SITE_CONTENT;
export type SiteContent = Record<ContentKey, string>;

export const CONTENT_KEYS = Object.keys(DEFAULT_SITE_CONTENT) as ContentKey[];

export const IMAGE_KEYS = [
  "image_hero_floral_top",
  "image_hero_floral_bottom",
  "image_bouquet_center",
  "image_maker_1",
  "image_maker_2",
  "image_maker_3",
  "image_maker_4",
] as const satisfies readonly ContentKey[];

export const BILLING_KEYS = [
  "billing_standard_delivery",
  "billing_express_delivery",
  "billing_free_shipping_threshold",
  "billing_tax_rate",
  "promo_code",
  "promo_percent",
] as const satisfies readonly ContentKey[];

export function isContentKey(key: string): key is ContentKey {
  return Object.prototype.hasOwnProperty.call(DEFAULT_SITE_CONTENT, key);
}

export interface SiteContentRow {
  section_key: string;
  text_content: string | null;
}

/** Defaults overlaid with the admin's saved edits. Unknown keys and blank values are ignored. */
export function mergeSiteContent(rows: readonly SiteContentRow[]): SiteContent {
  const content: SiteContent = { ...DEFAULT_SITE_CONTENT };
  for (const row of rows) {
    const value = row.text_content ?? "";
    if (isContentKey(row.section_key) && value.trim() !== "") content[row.section_key] = value;
  }
  return content;
}

/** The custom picture URL for an image key, or the bundled asset when none is set. */
export function contentImage(content: SiteContent, key: ContentKey, fallback: string): string {
  const custom = content[key].trim();
  return custom === "" ? fallback : custom;
}
