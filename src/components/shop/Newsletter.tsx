import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";

import floralBottom from "@/assets/floral-bottom.webp";
import { useSiteContent } from "@/hooks/use-site-content";

const emailSchema = z.string().trim().email("Please enter a valid email").max(255);

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { getText } = useSiteContent();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please enter a valid email");
      return;
    }
    setError(null);
    setEmail("");
    toast.success("You're in! Your 15% code is on its way.");
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
          <p className="font-hand text-2xl text-gold">
            {getText("newsletter_kicker", "a little something for you")}
          </p>
          <h2
            id="news-title"
            className="mt-2 font-display text-[clamp(2rem,4.4vw,3.4rem)] font-extrabold leading-[0.98] tracking-[-0.05em]"
          >
            {getText("newsletter_title", "15% off your first bouquet")}
          </h2>
          <p className="mt-3 leading-relaxed text-fern-foreground/80">
            {getText(
              "newsletter_desc",
              "Join the Reelmark letter for new drops, seasonal stems and florist tips. Your code arrives instantly."
            )}
          </p>
          <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="news-email" className="sr-only">
              Email address
            </label>
            <input
              id="news-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              placeholder="you@example.com"
              className="flex-1 rounded-full border border-fern-foreground/20 bg-fern-foreground/10 px-5 py-3.5 text-fern-foreground outline-none placeholder:text-fern-foreground/50 focus:border-gold focus:ring-4 focus:ring-gold/20"
            />
            <button
              type="submit"
              className="rounded-full bg-gold px-7 py-3.5 font-bold tracking-tight text-fern transition-transform hover:-translate-y-0.5 cursor-pointer"
            >
              Get my 15% off
            </button>
          </form>
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
  const { getText } = useSiteContent();

  return (
    <footer className="px-4 pb-10 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground sm:flex-row">
        <p className="font-display text-lg font-extrabold tracking-[-0.03em] text-foreground">
          Reelmark
        </p>
        <p>
          {getText("footer_tagline", "Hand-tied by independent florists · Same-day delivery")}
        </p>
        <p>
          {getText("footer_copyright", `© ${new Date().getFullYear()} Reelmark`)}
        </p>
      </div>
    </footer>
  );
}
