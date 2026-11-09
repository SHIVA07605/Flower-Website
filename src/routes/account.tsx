import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, PackageSearch, RefreshCw, Star } from "lucide-react";

import { OrderCard } from "@/components/orders/OrderDetails";
import { UserMenu } from "@/components/shop/UserMenu";
import { useAuth } from "@/hooks/use-auth";
import { getMyAccount, trackOrder } from "@/lib/account.functions";
import { lastOrderEmail } from "@/lib/last-order";
import type { OrderRecord } from "@/lib/orders";
import { unwrap } from "@/lib/result";
import type { ReviewStatus } from "@/lib/reviews";

/** Only the order number travels in the URL; the email never does (see lib/last-order). */
interface AccountSearch {
  order?: string;
}

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [{ title: "My orders — Reelmark" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (search: Record<string, unknown>): AccountSearch =>
    typeof search["order"] === "string" ? { order: search["order"] } : {},
  component: AccountPage,
});

function AccountPage() {
  const { user, loading } = useAuth();
  const search = Route.useSearch();

  return (
    <div className="min-h-screen bg-background">
      <header className="px-4 pt-4 sm:px-8">
        <nav className="nav-glass mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-full py-2 pl-4 pr-2 sm:pl-5">
          <Link
            to="/"
            className="font-display text-xl font-extrabold tracking-[-0.03em] text-foreground"
          >
            Reelmark
          </Link>
          <div className="flex items-center gap-1.5">
            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:text-foreground sm:flex"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Continue shopping
            </Link>
            <UserMenu />
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading" />
          </div>
        ) : user ? (
          <SignedInAccount firstName={user.name.split(" ")[0] ?? user.name} email={user.email} />
        ) : (
          <SignedOutAccount search={search} />
        )}
      </main>
    </div>
  );
}

const REVIEW_STATUS_STYLE: Record<ReviewStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-slate-100 text-slate-600",
};

function SignedInAccount({ firstName, email }: { firstName: string; email: string | null }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["account", user?.id],
    queryFn: async () => unwrap(await getMyAccount()),
    // Status changes made in the admin dashboard show up here without a reload.
    refetchInterval: 30_000,
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-hand text-2xl text-primary">Hello {firstName},</p>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.04em] text-foreground">
            Your orders
          </h1>
          {email && <p className="mt-1 text-sm text-muted-foreground">{email}</p>}
        </div>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-ink-soft hover:text-foreground"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      {query.isPending ? (
        <div className="mt-10 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-3xl bg-muted" />
          ))}
        </div>
      ) : query.isError ? (
        <p
          role="alert"
          className="mt-8 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {query.error.message}
        </p>
      ) : (
        <>
          <section className="mt-8 space-y-4" aria-label="Orders">
            {query.data.orders.length === 0 ? (
              <div className="paper-panel rounded-3xl p-10 text-center">
                <PackageSearch className="mx-auto h-8 w-8 text-ink-soft" aria-hidden="true" />
                <p className="mt-3 font-display text-xl font-bold">No orders yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  When you send flowers, you can follow every step here.
                </p>
                <Link
                  to="/"
                  hash="best-sellers"
                  className="bg-cta shadow-cta mt-5 inline-block rounded-full px-6 py-3 text-sm font-bold text-primary-foreground"
                >
                  Shop bouquets
                </Link>
              </div>
            ) : (
              query.data.orders.map((order) => <OrderCard key={order.id} order={order} />)
            )}
          </section>

          {query.data.reviews.length > 0 && (
            <section className="mt-12" aria-labelledby="my-reviews">
              <h2 id="my-reviews" className="font-display text-2xl font-bold tracking-tight">
                Your reviews
              </h2>
              <ul className="mt-4 space-y-3">
                {query.data.reviews.map((r) => (
                  <li key={r.id} className="paper-panel rounded-2xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{r.productName}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${REVIEW_STATUS_STYLE[r.status]}`}
                      >
                        {r.status === "pending" ? "Awaiting approval" : r.status}
                      </span>
                    </div>
                    <span className="mt-1 flex gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                      {Array.from({ length: r.rating }).map((_, s) => (
                        <Star
                          key={s}
                          className="h-3.5 w-3.5 fill-gold text-gold"
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                    <p className="mt-1.5 text-sm text-foreground">"{r.body}"</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}

function SignedOutAccount({ search }: { search: AccountSearch }) {
  const { openAuth } = useAuth();
  const [orderNumber, setOrderNumber] = useState(search.order ?? "");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<OrderRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const autoTracked = useRef(false);

  const track = async (lookup: { orderNumber: string; email: string }) => {
    setSearching(true);
    setError(null);
    try {
      const res = await trackOrder({ data: lookup });
      if (!res.ok) {
        setError(res.error);
        setResult(null);
      } else if (!res.data) {
        setError("We couldn't find an order with that number and email.");
        setResult(null);
      } else {
        setResult(res.data);
      }
    } catch {
      setError("We couldn't reach the shop. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  // Arriving from the checkout confirmation link in this tab: look the order up straight away.
  useEffect(() => {
    if (autoTracked.current || !search.order) return;
    const savedEmail = lastOrderEmail(search.order);
    if (!savedEmail) return;
    autoTracked.current = true;
    setEmail(savedEmail);
    void track({ orderNumber: search.order, email: savedEmail });
  }, [search.order]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.04em] text-foreground">
          Track your flowers
        </h1>
        <p className="mt-2 max-w-lg text-muted-foreground">
          Sign in to see every order you've placed, or look one up with its order number and the
          email you used.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="paper-panel flex flex-col rounded-3xl p-6">
          <h2 className="font-display text-xl font-bold">Have an account?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your orders, delivery updates and reviews in one place.
          </p>
          <div className="mt-auto flex gap-2 pt-5">
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="bg-cta shadow-cta cursor-pointer rounded-full px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => openAuth("signup")}
              className="cursor-pointer rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:border-primary hover:text-primary"
            >
              Create account
            </button>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void track({ orderNumber, email });
          }}
          className="paper-panel rounded-3xl p-6"
        >
          <h2 className="font-display text-xl font-bold">Track an order</h2>
          <div className="mt-4 space-y-3">
            <input
              required
              placeholder="Order number, e.g. RM-10001"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm uppercase outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            <input
              required
              type="email"
              placeholder="Email used for the order"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            <button
              type="submit"
              disabled={searching}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-primary py-2.5 text-sm font-bold text-primary hover:bg-primary/5 disabled:opacity-60"
            >
              {searching && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Find my order
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </form>
      </div>

      {result && <OrderCard order={result} />}
    </div>
  );
}
