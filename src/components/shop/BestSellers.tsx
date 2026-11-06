import { Plus, Star } from "lucide-react";

import { useCart } from "./cart";
import { formatPrice } from "./products";
import { useProductView } from "./product-view";
import { SectionHeading } from "./SectionHeading";
import { useStorefront } from "./storefront";

export function BestSellers() {
  const { add } = useCart();
  const { show } = useProductView();
  const { content, catalog } = useStorefront();
  const featured = catalog.filter((b) => b.isFeatured);
  // Never leave the section empty: fall back to the first bouquets if none are featured.
  const items = (featured.length > 0 ? featured : catalog).slice(0, 8);

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
          kicker={content.bestsellers_kicker}
          title={content.bestsellers_title}
          align="left"
        />
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          {content.bestsellers_sub}
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((b) => (
          <article key={b.id} className="group flex flex-col">
            <button
              type="button"
              onClick={() => show(b.id)}
              aria-label={`View ${b.name}`}
              className="reel-card relative aspect-[4/5] cursor-pointer overflow-hidden rounded-3xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img
                src={b.image}
                alt={b.name}
                width={768}
                height={1088}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <span className="glass-pill absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-media-foreground">
                {b.maker}
              </span>
            </button>
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
              {b.rating ? (
                <span className="flex items-center gap-1 text-xs text-ink-soft">
                  <Star className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden="true" />
                  <span className="font-bold text-foreground">{b.rating[0]}</span>
                  <span>({b.rating[1]})</span>
                </span>
              ) : (
                <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-accent-foreground">
                  New
                </span>
              )}
              <button
                type="button"
                onClick={() => add(b.id)}
                aria-label={`Add ${b.name} to bag`}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-semibold text-secondary-foreground transition-all hover:bg-primary hover:text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
