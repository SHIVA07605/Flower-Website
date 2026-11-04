import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PenLine, Plus, Wand2 } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { findBouquet } from "@/lib/bouquet-finder.functions";
import { BUDGET_MAX, BUDGET_MIN, type FinderResult } from "@/lib/bouquet-finder.shared";
import { useCart } from "./cart";
import { SectionHeading } from "./SectionHeading";
import { formatPrice, getBouquet, type Occasion } from "./products";

const occasionChips: { id: Occasion; label: string; prompt: string }[] = [
  {
    id: "birthday",
    label: "Birthday",
    prompt: "My best friend's 30th birthday, she loves bright colours",
  },
  {
    id: "anniversary",
    label: "Anniversary",
    prompt: "Our 10th wedding anniversary, something romantic",
  },
  {
    id: "sympathy",
    label: "Sympathy",
    prompt: "Sympathy flowers for a colleague who lost her mother",
  },
  {
    id: "just-because",
    label: "Just because",
    prompt: "Just because, to cheer up my sister after a long week",
  },
];

const flowerChips = [
  "Roses",
  "Peonies",
  "Sunflowers",
  "Lilies",
  "Wildflowers",
  "Ranunculus",
  "Dried stems",
];

export function BouquetFinder({ preset }: { preset: { occasion: Occasion; n: number } | null }) {
  const find = useServerFn(findBouquet);
  const { add } = useCart();

  const [occasion, setOccasion] = useState("");
  const [flowers, setFlowers] = useState<string[]>([]);
  const [extraFlowers, setExtraFlowers] = useState("");
  const [budget, setBudget] = useState(1999);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinderResult | null>(null);

  useEffect(() => {
    if (!preset) return;
    const chip = occasionChips.find((c) => c.id === preset.occasion);
    if (chip) setOccasion(chip.prompt);
  }, [preset]);

  const toggleFlower = (f: string) =>
    setFlowers((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (occasion.trim().length < 2) {
      setError("Tell us a little about the occasion first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await find({
        data: {
          occasion: occasion.trim(),
          flowers: [...flowers, extraFlowers.trim()].filter(Boolean).join(", "),
          budget,
        },
      });
      if (res.ok) setResult(res.result);
      else setError(res.error);
    } catch {
      setError("We couldn't reach the bouquet finder. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const best = result ? getBouquet(result.bestId) : undefined;
  const alt = result?.alternateId ? getBouquet(result.alternateId) : undefined;

  return (
    <section
      id="finder"
      data-trail-section
      aria-labelledby="finder-title"
      className="relative isolate px-4 py-24 sm:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="orb left-[10%] top-[10%] h-[28rem] w-[28rem] bg-orb-mint" />
        <div className="orb bottom-0 right-[8%] h-[30rem] w-[30rem] bg-orb-gold" />
      </div>

      <SectionHeading
        id="finder-title"
        kicker="AI Bouquet Finder"
        title="Tell us the moment, we'll pick the stems"
      >
        Describe the occasion, the flowers they love and what you'd like to spend. Our AI florist
        matches it to the best bouquet in today's studio.
      </SectionHeading>

      <div className="mx-auto mt-12 grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_1fr]">
        {/* Form */}
        <form onSubmit={onSubmit} className="paper-panel rounded-3xl p-6 sm:p-8">
          <label htmlFor="occasion" className="text-sm font-bold tracking-tight text-foreground">
            What's the occasion?
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {occasionChips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setOccasion(c.prompt)}
                className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-primary hover:text-primary"
              >
                {c.label}
              </button>
            ))}
          </div>
          <textarea
            id="occasion"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            maxLength={400}
            rows={3}
            placeholder="e.g. A thank-you for my neighbour who watered my plants all summer"
            className="mt-3 w-full resize-none rounded-2xl border border-input bg-card px-4 py-3 text-[0.95rem] text-foreground outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
          />

          <p className="mt-6 text-sm font-bold tracking-tight text-foreground">Preferred flowers</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {flowerChips.map((f) => {
              const on = flowers.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleFlower(f)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    on
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-ink-soft hover:border-primary hover:text-primary"
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
          <input
            value={extraFlowers}
            onChange={(e) => setExtraFlowers(e.target.value)}
            maxLength={120}
            placeholder="Anything else? Colours, scents, flowers to avoid…"
            aria-label="Other flower preferences"
            className="mt-3 w-full rounded-full border border-input bg-card px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
          />

          <div className="mt-6 flex items-baseline justify-between">
            <p id="budget-label" className="text-sm font-bold tracking-tight text-foreground">
              Budget
            </p>
            <p className="font-display text-2xl font-extrabold tracking-[-0.04em] text-primary">
              up to {formatPrice(budget)}
            </p>
          </div>
          <Slider
            aria-labelledby="budget-label"
            className="mt-4"
            min={BUDGET_MIN}
            max={BUDGET_MAX}
            step={5}
            value={[budget]}
            onValueChange={([v]) => setBudget(v ?? budget)}
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{formatPrice(BUDGET_MIN)}</span>
            <span>{formatPrice(BUDGET_MAX)}</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-cta mt-8 flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-base font-bold tracking-tight text-primary-foreground shadow-cta transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-80"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Wand2 className="h-5 w-5" aria-hidden="true" />
            )}
            {loading ? "Our florist is choosing…" : "Find my bouquet"}
          </button>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
            >
              {error}
            </p>
          )}
        </form>

        {/* Result */}
        <div
          aria-live="polite"
          className="paper-panel relative flex min-h-[520px] flex-col overflow-hidden rounded-3xl"
        >
          {loading ? (
            <div className="flex flex-1 flex-col gap-4 p-6 sm:p-8">
              <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-muted" />
              <div className="h-7 w-2/3 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-full animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded-full bg-muted" />
              <p className="mt-auto text-center font-hand text-2xl text-primary">
                Snipping stems, checking colours…
              </p>
            </div>
          ) : best && result ? (
            <div className="flex flex-1 flex-col">
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <img
                  src={best.image}
                  alt={best.name}
                  width={768}
                  height={1088}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <span className="bg-media-fade absolute inset-0" />
                <span className="absolute left-4 top-4 rounded-full bg-gold px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-fern">
                  Best match
                </span>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-media-foreground/80">
                      {best.maker}
                    </p>
                    <p className="font-display text-3xl font-extrabold leading-none tracking-[-0.04em] text-media-foreground">
                      {best.name}
                    </p>
                  </div>
                  <span className="glass-pill rounded-full px-3 py-1 text-sm font-bold text-media-foreground">
                    {formatPrice(best.price)}
                  </span>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-6 sm:p-7">
                <h3 className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
                  {result.headline}
                </h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{result.reason}</p>
                {result.overBudget && (
                  <p className="mt-3 text-sm font-medium text-accent-foreground">
                    Nothing in the studio fits that budget yet, so this is our most affordable
                    bouquet.
                  </p>
                )}
                <div className="mt-4 flex gap-3 rounded-2xl bg-gold-soft px-4 py-3">
                  <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <p className="font-hand text-xl leading-6 text-foreground">"{result.cardNote}"</p>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => add(best.id)}
                    className="bg-cta flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-primary-foreground shadow-cta transition-transform hover:-translate-y-0.5"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add to cart
                  </button>
                  {alt && (
                    <button
                      type="button"
                      onClick={() => add(alt.id)}
                      className="flex items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-4 text-left text-sm transition-colors hover:border-primary"
                    >
                      <img
                        src={alt.image}
                        alt=""
                        width={40}
                        height={40}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <span>
                        <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Also lovely
                        </span>
                        <span className="block font-semibold text-foreground">
                          {alt.name} · {formatPrice(alt.price)}
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="flex -space-x-6">
                {["sunflower-wrap", "blush-peony", "white-lily"].map((id, i) => {
                  const b = getBouquet(id)!;
                  return (
                    <img
                      key={id}
                      src={b.image}
                      alt=""
                      width={768}
                      height={1088}
                      loading="lazy"
                      className="reel-card h-36 w-28 rounded-2xl object-cover"
                      style={{ rotate: `${(i - 1) * 8}deg`, translate: `0 ${i === 1 ? -10 : 0}px` }}
                    />
                  );
                })}
              </div>
              <p className="mt-8 font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
                Your bouquet will bloom here
              </p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Fill in the form and we'll match you with a bouquet, plus a card message to go with
                it.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
