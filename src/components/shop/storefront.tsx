import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";

import { readBillingSettings, type BillingSettings } from "@/lib/billing";
import { mergeCatalog, type CatalogItem } from "@/lib/catalog";
import type { PublicReview } from "@/lib/reviews";
import type { SiteContent } from "@/lib/site-content";
import { onStoreUpdate } from "@/lib/store-sync";
import type { StorefrontPayload } from "@/lib/storefront-data";

interface StorefrontValue {
  content: SiteContent;
  /** Live, visible catalog: products.ts plus the admin's edits. */
  catalog: CatalogItem[];
  reviews: PublicReview[];
  billing: BillingSettings;
  dbReady: boolean;
  findProduct: (id: string) => CatalogItem | undefined;
  reviewsFor: (id: string) => PublicReview[];
}

const StorefrontContext = createContext<StorefrontValue | null>(null);

/** Shares the server-loaded storefront data with every section on the page. */
export function StorefrontProvider({
  data,
  children,
}: {
  data: StorefrontPayload;
  children: ReactNode;
}) {
  const router = useRouter();

  // An admin saving in another tab of this browser refreshes this page's data right away.
  useEffect(() => onStoreUpdate(() => void router.invalidate()), [router]);

  const value = useMemo<StorefrontValue>(() => {
    const catalog = mergeCatalog(data.productRows);
    return {
      content: data.content,
      catalog,
      reviews: data.reviews,
      billing: readBillingSettings(data.content),
      dbReady: data.dbReady,
      findProduct: (id) => catalog.find((p) => p.id === id),
      reviewsFor: (id) => data.reviews.filter((r) => r.productId === id),
    };
  }, [data]);

  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
}

export function useStorefront(): StorefrontValue {
  const ctx = useContext(StorefrontContext);
  if (!ctx) throw new Error("useStorefront must be used inside StorefrontProvider");
  return ctx;
}
