import { Plus, Star } from "lucide-react";

import { useCart } from "./cart";
import { SectionHeading } from "./SectionHeading";
import { bouquets, formatPrice } from "./products";
import { useSiteContent } from "@/hooks/use-site-content";

const bestIds = ["golden-hour-roses", "blush-peony", "ranunculus-posy", "sunflower-wrap"];
const ratings: Record<string, [number, number]> = {
  "golden-hour-roses": [4.9, 812],
  "blush-peony": [4.9, 604],
  "ranunculus-posy": [4.8, 451],
  "sunflower-wrap": [4.8, 389],
};

export function BestSellers() {
  const { add } = useCart();
  const { getText } = useSiteContent();
  const items = bestIds.map((id) => bouquets.find((b) => b.id === id)!);

  return (
    <section
      id="best-sellers"
      data-trail-section
      aria-labelledby="best-title"
      className="relative px-4 py-24 sm:px-8"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <SectionHeading
          id="best-title"
          kicker={getText("bestsellers_kicker", "Best sellers")}
          title={getText("bestsellers_title", "The bouquets everyone's sending")}
          align="left"
        />
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          {getText("bestsellers_sub", "Restocked every morning. Order by 2pm for delivery today.")}
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((b) => {
          const [rating, count] = ratings[b.id]!;
          return (
            <article key={b.id} className="group flex flex-col">
              <div className="reel-card relative aspect-[4/5] overflow-hidden rounded-3xl">
                <img
                  src={b.image}
                  alt={b.name}
                  width={768}
                  height={1088}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <span className="absolute left-3 top-3 glass-pill rounded-full px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-media-foreground">
                  {b.maker}
                </span>
              </div>
              <div className="mt-4 flex items-start justify-between gap-3 px-1">
                <div>
                  <h3 className="font-display text-xl font-bold tracking-[-0.03em] text-foreground">
                    {b.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{b.maker}</p>
                </div>
                <span className="font-display text-lg font-bold text-foreground">
                  {formatPrice(b.price)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                <span className="flex items-center gap-1 text-xs text-ink-soft">
                  <Star className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden="true" />
                  <span className="font-bold text-foreground">{rating}</span>
                  <span>({count})</span>
                </span>
                <button
                  type="button"
                  onClick={() => add(b.id)}
                  aria-label={`Add ${b.name} to cart`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-semibold text-secondary-foreground transition-all hover:bg-primary hover:text-primary-foreground"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
