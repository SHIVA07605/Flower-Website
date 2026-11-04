import { useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { bouquets as staticBouquets, type Bouquet, type Occasion } from "@/components/shop/products";

export interface SupabaseProduct {
  id: string;
  title: string;
  maker?: string;
  price: number;
  image_url?: string;
  video_url?: string;
  description?: string;
  flowers?: string[];
  palette?: string;
  occasions?: string[];
  is_active?: boolean;
  sort_order?: number;
  created_at?: string;
}

const STORAGE_KEY_PRODUCTS = "reelmark_custom_products_v1";

function getLocalCustomProducts(): Record<string, Partial<Bouquet>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function useProducts() {
  const [products, setProducts] = useState<Bouquet[]>(() => {
    const overrides = getLocalCustomProducts();
    return staticBouquets.map((b) => ({
      ...b,
      ...(overrides[b.id] || {}),
    }));
  });
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const fetchProducts = useCallback(async () => {
    const overrides = getLocalCustomProducts();

    if (!isSupabaseConfigured) {
      setProducts(staticBouquets.map((b) => ({ ...b, ...(overrides[b.id] || {}) })));
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.warn("Could not load products from Supabase, using catalog:", error.message);
        setProducts(staticBouquets.map((b) => ({ ...b, ...(overrides[b.id] || {}) })));
        return;
      }

      if (data && data.length > 0) {
        const mapped: Bouquet[] = data.map((item: SupabaseProduct) => {
          const matchedStatic = staticBouquets.find((b) => b.id === item.id);
          const image =
            item.image_url ||
            matchedStatic?.image ||
            staticBouquets[0].image;

          const base: Bouquet = {
            id: item.id,
            name: item.title,
            maker: item.maker || "Indie Florist",
            price: Number(item.price),
            image,
            flowers: item.flowers || ["seasonal blooms"],
            palette: item.palette || "seasonal",
            occasions: (item.occasions as Occasion[]) || ["just-because"],
            blurb: item.description || "",
          };

          return { ...base, ...(overrides[item.id] || {}) };
        });

        setProducts(mapped);
      } else {
        setProducts(staticBouquets.map((b) => ({ ...b, ...(overrides[b.id] || {}) })));
      }
    } catch (err) {
      console.warn("Product fetch exception:", err);
      setProducts(staticBouquets.map((b) => ({ ...b, ...(overrides[b.id] || {}) })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_PRODUCTS) {
        fetchProducts();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [fetchProducts]);

  return { products, refreshProducts: fetchProducts, loading };
}

export function saveProductLocalOverride(id: string, patch: Partial<Bouquet>) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    const map = raw ? JSON.parse(raw) : {};
    map[id] = { ...(map[id] || {}), ...patch };
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(map));
  } catch {}
}
