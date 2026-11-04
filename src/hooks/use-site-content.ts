import { useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface SiteContentItem {
  id?: string;
  section_key: string;
  text_content: string;
}

export const DEFAULT_SITE_CONTENT: Record<string, string> = {
  // Hero section
  hero_kicker: "Trusted by 120,000+ flower lovers",
  hero_title_1: "Shop the Blooms",
  hero_title_2: "You Saw in Reels",
  hero_subtitle:
    "Hand-tied bouquets from indie florists, shown in short, snappy reels. Tap any reel to see it up close, then send it across town today.",
  hero_cta: "Shop Best Sellers",
  hero_note_tap: "Tap a reel\nto shop it",
  hero_note_sameday: "Same-day",

  // Delivery Bar
  delivery_bar: "Same-day delivery · 7-day freshness guarantee · Free delivery over ₹999",
  delivery_promise_1_title: "Same-day delivery",
  delivery_promise_1_body: "Order by 2pm, at their door tonight",
  delivery_promise_2_title: "7-day freshness guarantee",
  delivery_promise_2_body: "Wilted early? We'll replace it free",
  delivery_promise_3_title: "Hand-tied by local florists",
  delivery_promise_3_body: "Never boxed in a warehouse",
  delivery_promise_4_title: "Free handwritten card",
  delivery_promise_4_body: "Your words, in real ink",

  // Best Sellers
  bestsellers_kicker: "Best sellers",
  bestsellers_title: "The bouquets everyone's sending",
  bestsellers_sub: "Restocked every morning. Order by 2pm for delivery today.",

  // Bouquet Finder
  finder_kicker: "AI bouquet finder",
  finder_title: "Find the right stems in 30 seconds",

  // Occasions
  occasions_kicker: "Occasions",
  occasions_title: "Flowers made for the moment",

  // Makers
  makers_kicker: "Meet the makers",
  makers_title: "Real florists, real benches, real hands",
  makers_desc: "Every Reelmark bouquet is made by an independent studio in your city, never a warehouse.",

  // Reviews
  reviews_kicker: "4.9 from 18,000+ reviews",
  reviews_title: "Sent with love, received with joy",

  // Newsletter
  newsletter_kicker: "a little something for you",
  newsletter_title: "15% off your first bouquet",
  newsletter_desc: "Join the Reelmark letter for new drops, seasonal stems and florist tips. Your code arrives instantly.",

  // Footer & Brand
  footer_tagline: "Fresh bouquets from indie florists, delivered today.",
  footer_copyright: "© 2026 Reelmark Inc. Handcrafted blooms for every moment.",

  // Media / Picture URLs (overrides for static assets if customized)
  image_hero_floral_top: "",
  image_hero_floral_bottom: "",
  image_bouquet_center: "",
  image_maker_1: "",
  image_maker_2: "",
  image_maker_3: "",
  image_maker_4: "",

  // Billing & Shipping Settings (in Indian Rupees ₹)
  billing_currency_symbol: "₹",
  billing_standard_delivery: "149",
  billing_express_delivery: "249",
  billing_free_shipping_threshold: "999",
  billing_tax_rate: "18",
};

const STORAGE_KEY = "reelmark_site_content_v1";

function getLocalContent(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function useSiteContent() {
  const [content, setContent] = useState<Record<string, string>>(() => ({
    ...DEFAULT_SITE_CONTENT,
    ...getLocalContent(),
  }));
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const loadContent = useCallback(async () => {
    // 1. First populate from local cache
    const local = getLocalContent();
    setContent((prev) => ({ ...prev, ...local }));

    // 2. Fetch from Supabase if configured
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("site_content")
        .select("section_key, text_content");

      if (error) {
        console.warn("Could not load site_content from database:", error.message);
      } else if (data && data.length > 0) {
        const map: Record<string, string> = { ...DEFAULT_SITE_CONTENT, ...local };
        for (const item of data) {
          if (item.section_key && item.text_content) {
            map[item.section_key] = item.text_content;
          }
        }
        setContent(map);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
        } catch {}
      }
    } catch (err) {
      console.warn("site_content exception:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent();

    // Listen for local updates across tabs / components
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setContent((prev) => ({ ...prev, ...parsed }));
        } catch {}
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [loadContent]);

  const getText = (key: string, fallback?: string): string => {
    return content[key] || fallback || DEFAULT_SITE_CONTENT[key] || "";
  };

  const getImage = (key: string, defaultSrc: string): string => {
    const custom = content[key];
    return custom && custom.trim().length > 0 ? custom : defaultSrc;
  };

  const saveContentLocallyAndRemote = async (
    updates: Record<string, string>
  ): Promise<{ error: Error | null; savedLocally: boolean; savedRemote: boolean }> => {
    const merged = { ...content, ...updates };
    setContent(merged);

    // Save to localStorage so storefront updates immediately
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {}

    let savedRemote = false;
    let remoteError: Error | null = null;

    if (isSupabaseConfigured) {
      try {
        const rows = Object.entries(updates).map(([section_key, text_content]) => ({
          section_key,
          text_content,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from("site_content").upsert(rows, {
          onConflict: "section_key",
        });
        if (error) {
          remoteError = new Error(error.message);
        } else {
          savedRemote = true;
        }
      } catch (err: any) {
        remoteError = err;
      }
    }

    return { error: remoteError, savedLocally: true, savedRemote };
  };

  return {
    content,
    getText,
    getImage,
    saveContent: saveContentLocallyAndRemote,
    refreshContent: loadContent,
    loading,
  };
}
