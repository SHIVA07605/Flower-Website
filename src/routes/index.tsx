import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { BestSellers } from "@/components/shop/BestSellers";
import { BouquetFinder } from "@/components/shop/BouquetFinder";
import { BouquetGallery } from "@/components/shop/BouquetGallery";
import { CartProvider } from "@/components/shop/cart";
import { CartDrawer } from "@/components/shop/CartDrawer";
import { DeliveryBar } from "@/components/shop/DeliveryBar";
import { Makers } from "@/components/shop/Makers";
import { Footer, Newsletter } from "@/components/shop/Newsletter";
import { OccasionGrid } from "@/components/shop/OccasionGrid";
import { PetalTrail } from "@/components/shop/PetalTrail";
import { ProductDialog } from "@/components/shop/ProductDialog";
import { ProductViewProvider } from "@/components/shop/product-view";
import { ReelmarkHero } from "@/components/shop/ReelmarkHero";
import { Reviews } from "@/components/shop/Reviews";
import { StorefrontProvider } from "@/components/shop/storefront";
import type { Occasion } from "@/components/shop/products";
import { getStorefront } from "@/lib/store.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reelmark — Fresh bouquets from indie florists, delivered today" },
      {
        name: "description",
        content:
          "Shop hand-tied bouquets from independent florists, find the perfect flowers with our AI bouquet finder, and get same-day delivery.",
      },
      { property: "og:title", content: "Reelmark — Fresh bouquets from indie florists" },
      {
        property: "og:description",
        content:
          "Hand-tied bouquets, an AI bouquet finder and same-day delivery with a 7-day freshness guarantee.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  // Live copy, prices and approved reviews, rendered on the server for every visit.
  loader: () => getStorefront(),
  component: Index,
});

function Index() {
  const data = Route.useLoaderData();
  const [preset, setPreset] = useState<{ occasion: Occasion; n: number } | null>(null);

  const pickOccasion = (occasion: Occasion) => {
    setPreset((p) => ({ occasion, n: (p?.n ?? 0) + 1 }));
    document.getElementById("finder")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <StorefrontProvider data={data}>
      <CartProvider>
        <ProductViewProvider>
          <main className="bg-background">
            <ReelmarkHero />
            <PetalTrail>
              <DeliveryBar />
              <BouquetGallery />
              <OccasionGrid onPick={pickOccasion} />
              <BouquetFinder preset={preset} />
              <BestSellers />
              <Reviews />
              <Makers />
              <Newsletter />
            </PetalTrail>
            <Footer />
          </main>
          <CartDrawer />
          <ProductDialog />
        </ProductViewProvider>
      </CartProvider>
    </StorefrontProvider>
  );
}
