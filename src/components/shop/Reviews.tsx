import { useState, type FormEvent } from "react";
import { Loader2, MessageSquarePlus, Star } from "lucide-react";
import { toast } from "sonner";

import review1 from "@/assets/reviews/review-1.jpg";
import review2 from "@/assets/reviews/review-2.jpg";
import review3 from "@/assets/reviews/review-3.jpg";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { submitReview } from "@/lib/store.functions";
import { formatPrice, getBaseBouquet } from "./products";
import { SectionHeading } from "./SectionHeading";
import { useStorefront } from "./storefront";

const photoOf = (id: string) => getBaseBouquet(id)?.image ?? review1;

/** Launch testimonials; approved shopper reviews are shown in front of these. */
const testimonials = [
  {
    photo: review1,
    name: "Hannah K.",
    bouquet: "Coral Ranunculus Posy",
    quote: "Arrived two hours after I ordered and she cried happy tears at the door.",
    rating: 5,
  },
  {
    photo: review2,
    name: "Priya S.",
    bouquet: "Golden Hour Roses",
    quote: "Still gorgeous on day nine. The mimosa makes the whole kitchen smell like spring.",
    rating: 5,
  },
  {
    photo: review3,
    name: "Martin D.",
    bouquet: "Blush Peony Cloud",
    quote: "Thirty years married and these are the flowers she'll remember. Worth every penny.",
    rating: 5,
  },
  {
    photo: photoOf("white-lily"),
    name: "Grace O.",
    bouquet: "White Lily Grace",
    quote: "Gentle, dignified and exactly right. The card was written so beautifully.",
    rating: 5,
  },
  {
    photo: photoOf("wildflower-jar"),
    name: "Leo M.",
    bouquet: "Meadow Jar",
    quote: "Looks like it was picked from a field that morning. My desk has never looked better.",
    rating: 5,
  },
  {
    photo: photoOf("sunflower-wrap"),
    name: "Aisha R.",
    bouquet: "Sunshine Wrap",
    quote: "Sent it for a birthday and got a video call within minutes. Pure joy.",
    rating: 5,
  },
];

export function Reviews() {
  const { content, reviews, catalog, findProduct } = useStorefront();
  const { user, openAuth } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const shopperReviews = reviews.map((r) => {
    const product = findProduct(r.productId);
    return {
      photo: product?.image ?? photoOf(r.productId),
      name: r.authorName,
      bouquet: product?.name ?? "Reelmark bouquet",
      quote: r.body,
      rating: r.rating,
    };
  });
  const all = [...shopperReviews, ...testimonials];
  const loop = [...all, ...all];

  const startReview = () => {
    if (!user) {
      toast.info("Sign in to share your review.");
      openAuth("login");
      return;
    }
    setProductId((id) => id || catalog[0]?.id || "");
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitReview({ data: { productId, rating, body } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Thank you! Your review will appear once our team approves it.");
      setBody("");
      setRating(5);
      setModalOpen(false);
    } catch {
      setError("We couldn't send your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section data-trail-section aria-labelledby="reviews-title" className="relative py-24">
      <div className="px-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            id="reviews-title"
            kicker={content.reviews_kicker}
            title={content.reviews_title}
            align="left"
          />
          <button
            type="button"
            onClick={startReview}
            className="inline-flex cursor-pointer items-center gap-2 self-start rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-transform hover:-translate-y-0.5 sm:self-auto"
          >
            <MessageSquarePlus className="h-4 w-4 text-primary" aria-hidden="true" />
            Write a review
          </button>
        </div>
      </div>

      <div className="group relative mt-12 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
        <ul className="animate-marquee flex w-max gap-5 px-3 group-hover:[animation-play-state:paused]">
          {loop.map((r, i) => (
            <li
              key={i}
              aria-hidden={i >= all.length}
              className="paper-panel flex w-[300px] shrink-0 flex-col overflow-hidden rounded-3xl sm:w-[340px]"
            >
              <img
                src={r.photo}
                alt={`${r.name}'s ${r.bouquet}`}
                width={768}
                height={768}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                  {Array.from({ length: r.rating }).map((_, s) => (
                    <Star key={s} className="h-4 w-4 fill-gold text-gold" aria-hidden="true" />
                  ))}
                </div>
                <p className="mt-3 leading-relaxed text-foreground">"{r.quote}"</p>
                <p className="mt-auto pt-4 text-sm">
                  <span className="font-bold text-foreground">{r.name}</span>
                  <span className="text-muted-foreground"> · {r.bouquet}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-[#faf8f5] p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-bold text-foreground">
              Share your experience
            </DialogTitle>
            <DialogDescription className="text-sm text-ink-soft">
              Your words help indie florists thrive. Reviews are checked by our team before they're
              published.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="mt-2 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-foreground">Bouquet</span>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full rounded-2xl border border-border bg-white p-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                {catalog.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({formatPrice(b.price)})
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="mb-1 block text-xs font-semibold text-foreground">Rating</span>
              <div className="flex gap-2" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={star === rating}
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                    onClick={() => setRating(star)}
                    className="cursor-pointer p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-6 w-6 ${star <= rating ? "fill-gold text-gold" : "text-border"}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-foreground">Your words</span>
              <textarea
                required
                rows={4}
                maxLength={1000}
                placeholder="How did the flowers arrive? How did they brighten the room?"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-2xl border border-border bg-white p-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="cursor-pointer rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || productId === ""}
                className="bg-cta shadow-cta flex cursor-pointer items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Submit review
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
