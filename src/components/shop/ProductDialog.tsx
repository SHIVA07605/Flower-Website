import { useEffect, useState } from "react";
import { Minus, Plus, ShoppingBag, Star } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCart } from "./cart";
import { formatPrice, OCCASION_LABELS } from "./products";
import { useProductView } from "./product-view";
import { useStorefront } from "./storefront";

/** Bouquet quick view, opened from reels, best sellers and the gallery. */
export function ProductDialog() {
  const { productId, close } = useProductView();
  const { findProduct, reviewsFor } = useStorefront();
  const { add, openCart } = useCart();
  const [qty, setQty] = useState(1);

  useEffect(() => setQty(1), [productId]);

  const item = productId ? findProduct(productId) : undefined;
  const reviews = item ? reviewsFor(item.id).slice(0, 3) : [];

  return (
    <Dialog open={item !== undefined} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[92vh] max-w-3xl gap-0 overflow-y-auto rounded-3xl border-none bg-card p-0 sm:grid-cols-2 sm:rounded-3xl">
        {item && (
          <>
            <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-auto sm:h-full sm:min-h-[460px]">
              <img
                src={item.image}
                alt={item.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span className="glass-pill absolute left-4 top-4 rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-media-foreground">
                {item.maker}
              </span>
            </div>

            <div className="flex flex-col p-6 sm:p-8">
              <DialogTitle className="font-display text-3xl font-extrabold leading-none tracking-[-0.04em] text-foreground">
                {item.name}
              </DialogTitle>
              <p className="mt-2 font-display text-2xl font-bold text-primary">
                {formatPrice(item.price)}
              </p>
              {item.rating && (
                <p className="mt-2 flex items-center gap-1 text-xs text-ink-soft">
                  <Star className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden="true" />
                  <span className="font-bold text-foreground">{item.rating[0]}</span>
                  <span>({item.rating[1]} reviews)</span>
                </p>
              )}
              <DialogDescription className="mt-4 leading-relaxed text-muted-foreground">
                {item.blurb || `Hand-tied by ${item.maker} the morning it ships.`}
              </DialogDescription>

              <dl className="mt-5 space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                    Stems
                  </dt>
                  <dd className="mt-1.5 flex flex-wrap gap-1.5">
                    {item.flowers.map((f) => (
                      <span
                        key={f}
                        className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium capitalize text-secondary-foreground"
                      >
                        {f}
                      </span>
                    ))}
                  </dd>
                </div>
                <div className="flex gap-6">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                      Colours
                    </dt>
                    <dd className="mt-1 capitalize text-foreground">{item.palette}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                      Good for
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {item.occasions.map((o) => OCCASION_LABELS[o]).join(", ")}
                    </dd>
                  </div>
                </div>
              </dl>

              {reviews.length > 0 && (
                <div className="mt-5 space-y-2.5 border-t border-border/70 pt-4">
                  {reviews.map((r) => (
                    <blockquote key={r.id} className="text-sm">
                      <span className="flex gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                        {Array.from({ length: r.rating }).map((_, s) => (
                          <Star
                            key={s}
                            className="h-3 w-3 fill-gold text-gold"
                            aria-hidden="true"
                          />
                        ))}
                      </span>
                      <p className="mt-1 text-foreground">"{r.body}"</p>
                      <footer className="mt-0.5 text-xs text-ink-soft">— {r.authorName}</footer>
                    </blockquote>
                  ))}
                </div>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
                <div className="flex items-center rounded-full border border-border bg-background">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-ink-soft hover:text-foreground"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold" aria-live="polite">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(20, q + 1))}
                    aria-label="Increase quantity"
                    className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-ink-soft hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    add(item.id, qty);
                    close();
                  }}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-primary px-5 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/5"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add to bag
                </button>
                <button
                  type="button"
                  onClick={() => {
                    add(item.id, qty);
                    close();
                    openCart();
                  }}
                  className="bg-cta shadow-cta flex w-full cursor-pointer items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"
                >
                  <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                  Buy now · {formatPrice(item.price * qty)}
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
