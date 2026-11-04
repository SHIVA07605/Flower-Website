import { useState, type FormEvent } from "react";
import { Star, MessageSquarePlus, Loader2 } from "lucide-react";

import review1 from "@/assets/reviews/review-1.jpg";
import review2 from "@/assets/reviews/review-2.jpg";
import review3 from "@/assets/reviews/review-3.jpg";
import { SectionHeading } from "./SectionHeading";
import { bouquets } from "./products";
import { useComments } from "@/hooks/use-comments";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const img = (id: string) => bouquets.find((b) => b.id === id)?.image ?? review1;

const staticReviews = [
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
    photo: img("white-lily"),
    name: "Grace O.",
    bouquet: "White Lily Grace",
    quote: "Gentle, dignified and exactly right. The card was written so beautifully.",
    rating: 5,
  },
  {
    photo: img("wildflower-jar"),
    name: "Leo M.",
    bouquet: "Meadow Jar",
    quote: "Looks like it was picked from a field that morning. My desk has never looked better.",
    rating: 5,
  },
  {
    photo: img("sunflower-wrap"),
    name: "Aisha R.",
    bouquet: "Sunshine Wrap",
    quote: "Sent it for a birthday and got a video call within minutes. Pure joy.",
    rating: 5,
  },
];

export function Reviews() {
  const { comments, addComment } = useComments();
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBouquet, setSelectedBouquet] = useState(bouquets[0].id);
  const [commentText, setCommentText] = useState("");
  const [rating, setRating] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map dynamic comments to review card structure
  const dynamicReviews = comments.map((c, i) => {
    const bouquetObj = bouquets.find((b) => b.id === c.product_id) || bouquets[i % bouquets.length];
    return {
      photo: bouquetObj.image,
      name: c.author_name || "Verified Customer",
      bouquet: bouquetObj.name,
      quote: c.comment_text,
      rating: c.rating || 5,
    };
  });

  // Combine dynamic + static so the marquee is always full and rich
  const combinedReviews = [...dynamicReviews, ...staticReviews];
  const loop = [...combinedReviews, ...combinedReviews];

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await addComment(commentText, rating, selectedBouquet);
      if (!error) {
        setCommentText("");
        setModalOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section data-trail-section aria-labelledby="reviews-title" className="relative py-24">
      <div className="px-4 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <SectionHeading
            id="reviews-title"
            kicker="4.9 from 18,000+ reviews"
            title="Sent with love, received with joy"
          />
          {user && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-foreground shadow-sm transition-transform hover:-translate-y-0.5 cursor-pointer"
            >
              <MessageSquarePlus className="h-4 w-4 text-primary" />
              Write a Review
            </button>
          )}
        </div>
      </div>

      <div className="group relative mt-12 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
        <ul className="animate-marquee flex w-max gap-5 px-3 group-hover:[animation-play-state:paused]">
          {loop.map((r, i) => (
            <li
              key={i}
              aria-hidden={i >= combinedReviews.length}
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

      {/* Review Submission Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-[#faf8f5] p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-bold text-foreground">
              Share Your Experience
            </DialogTitle>
            <DialogDescription className="text-sm text-ink-soft">
              Your feedback helps indie florists thrive. Reviews are verified before publishing.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitReview} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Select Bouquet
              </label>
              <select
                value={selectedBouquet}
                onChange={(e) => setSelectedBouquet(e.target.value)}
                className="w-full rounded-2xl border border-border bg-white p-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                {bouquets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (${b.price})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 cursor-pointer transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-6 w-6 ${
                        star <= rating ? "fill-gold text-gold" : "text-border"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Your Words
              </label>
              <textarea
                required
                rows={3}
                placeholder="How did the flowers arrive? How did they brighten the room?"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="w-full rounded-2xl border border-border bg-white p-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-cta shadow-cta rounded-full px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Submit Review"
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
