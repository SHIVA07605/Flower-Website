import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import floralBottom from "@/assets/floral-bottom.webp";
import { subscribeNewsletter } from "@/lib/store.functions";
import { useStorefront } from "./storefront";

const emailSchema = z.string().trim().email("Please enter a valid email").max(254);

export function Newsletter() {
  const { content } = useStorefront();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [offer, setOffer] = useState<{ code: string | null; percent: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please enter a valid email");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await subscribeNewsletter({ data: { email: parsed.data } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEmail("");
      setOffer({ code: result.data.promoCode, percent: result.data.promoPercent });
      toast.success("You're on the list — welcome to the Reelmark letter!");
    } catch {
      setError("We couldn't sign you up just now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.info(`Your code is ${code}`);
    }
  };

  return (
    <section
      data-trail-section
      aria-labelledby="news-title"
      className="relative px-4 pb-16 pt-12 sm:px-8"
    >
      <div className="bg-fern-panel relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] px-6 py-14 text-fern-foreground shadow-card sm:px-14 sm:py-16">
        <img
          src={floralBottom}
          alt=""
          aria-hidden="true"
          width={1024}
          height={1024}
          loading="lazy"
          className="pointer-events-none absolute -bottom-16 -right-16 w-[clamp(200px,30vw,380px)] -scale-x-100 opacity-95"
        />
        <div className="relative max-w-xl">
          <p className="font-hand text-2xl text-gold">{content.newsletter_kicker}</p>
          <h2
            id="news-title"
            className="mt-2 font-display text-[clamp(2rem,4.4vw,3.4rem)] font-extrabold leading-[0.98] tracking-[-0.05em]"
          >
            {content.newsletter_title}
          </h2>
          <p className="mt-3 leading-relaxed text-fern-foreground/80">{content.newsletter_desc}</p>

          {offer ? (
            <div className="mt-7 rounded-3xl border border-fern-foreground/20 bg-fern-foreground/10 p-5">
              {offer.code ? (
                <>
                  <p className="text-sm text-fern-foreground/80">
                    Here's {offer.percent}% off your first bouquet — enter it at checkout:
                  </p>
                  <button
                    type="button"
                    onClick={() => copyCode(offer.code ?? "")}
                    className="mt-3 inline-flex cursor-pointer items-center gap-3 rounded-full bg-gold px-6 py-3 font-display text-xl font-extrabold tracking-wider text-fern"
                  >
                    {offer.code}
                    {copied ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span className="sr-only">{copied ? "Copied" : "Copy code"}</span>
                  </button>
                </>
              ) : (
                <p className="text-sm text-fern-foreground/85">
                  You're subscribed. Look out for new drops and seasonal stems.
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col gap-3 sm:flex-row">
              <label htmlFor="news-email" className="sr-only">
                Email address
              </label>
              <input
                id="news-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
                autoComplete="email"
                placeholder="you@example.com"
                className="flex-1 rounded-full border border-fern-foreground/20 bg-fern-foreground/10 px-5 py-3.5 text-fern-foreground outline-none placeholder:text-fern-foreground/50 focus:border-gold focus:ring-4 focus:ring-gold/20"
              />
              <button
                type="submit"
                disabled={submitting}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-full bg-gold px-7 py-3.5 font-bold tracking-tight text-fern transition-transform hover:-translate-y-0.5 disabled:opacity-80"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {content.newsletter_cta}
              </button>
            </form>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-gold">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const { content } = useStorefront();

  return (
    <footer className="px-4 pb-10 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground md:flex-row">
        <p className="font-display text-lg font-extrabold tracking-[-0.03em] text-foreground">
          Reelmark
        </p>
        <p className="text-center">{content.footer_tagline}</p>
        <nav aria-label="Footer" className="flex items-center gap-4">
          <Link to="/account" className="font-semibold text-foreground hover:text-primary">
            Track an order
          </Link>
          <span>{content.footer_copyright}</span>
        </nav>
      </div>
    </footer>
  );
}
