import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Star, Trash2, X } from "lucide-react";

import { deleteReview, listAdminReviews, moderateReview } from "@/lib/admin.functions";
import { unwrap } from "@/lib/result";
import type { ReviewStatus } from "@/lib/reviews";
import { EmptyState, ErrorNote, LoadingRows, Panel, useAdminAction } from "./shared";

const REVIEWS_KEY = ["admin", "reviews"];
const FILTERS: { id: ReviewStatus | "all"; label: string }[] = [
  { id: "pending", label: "Waiting" },
  { id: "approved", label: "Published" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

export function ReviewsPanel() {
  const [filter, setFilter] = useState<ReviewStatus | "all">("pending");
  const query = useQuery({
    queryKey: REVIEWS_KEY,
    queryFn: async () => unwrap(await listAdminReviews()),
  });
  const invalidate = [REVIEWS_KEY, ["admin", "dashboard"]];
  const moderate = useAdminAction(
    (input: { id: string; status: ReviewStatus }) => moderateReview({ data: input }),
    {
      success: (r) =>
        r.status === "approved"
          ? "Published — it's now in the storefront reviews."
          : r.status === "rejected"
            ? "Review rejected."
            : "Moved back to waiting.",
      invalidate,
    },
  );
  const remove = useAdminAction((id: string) => deleteReview({ data: { id } }), {
    success: "Review deleted.",
    invalidate,
  });

  const all = query.data ?? [];
  const reviews = filter === "all" ? all : all.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Reviews</h2>
          <p className="text-sm text-ink-soft">
            Shopper reviews appear on the storefront only after you publish them.
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-border bg-white p-1 text-xs font-semibold">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`cursor-pointer rounded-full px-3 py-1 ${
                filter === f.id ? "bg-primary text-primary-foreground" : "text-ink-soft"
              }`}
            >
              {f.label} ({f.id === "all" ? all.length : all.filter((r) => r.status === f.id).length}
              )
            </button>
          ))}
        </div>
      </div>

      <Panel className="!p-0 overflow-hidden">
        {query.isPending ? (
          <LoadingRows />
        ) : query.isError ? (
          <div className="p-5">
            <ErrorNote message={query.error.message} />
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState>Nothing here right now.</EmptyState>
        ) : (
          <ul className="divide-y divide-border/60">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">{r.authorName}</span>
                    <span className="text-ink-soft">on {r.productName}</span>
                    <span className="flex gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${s < r.rating ? "fill-gold text-gold" : "text-border"}`}
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-foreground">"{r.body}"</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {new Date(r.createdAt).toLocaleDateString("en-IN")} ·{" "}
                    <span className="capitalize">{r.status}</span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {r.status !== "approved" && (
                    <button
                      type="button"
                      disabled={moderate.isPending}
                      onClick={() => moderate.mutate({ id: r.id, status: "approved" })}
                      className="flex cursor-pointer items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" /> Publish
                    </button>
                  )}
                  {r.status !== "rejected" && (
                    <button
                      type="button"
                      disabled={moderate.isPending}
                      onClick={() => moderate.mutate({ id: r.id, status: "rejected" })}
                      className="flex cursor-pointer items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-muted disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      {r.status === "approved" ? "Unpublish" : "Reject"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() =>
                      window.confirm("Delete this review for good?") && remove.mutate(r.id)
                    }
                    className="cursor-pointer rounded-full p-1.5 text-ink-soft hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete review</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
