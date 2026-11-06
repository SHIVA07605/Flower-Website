import { useEffect, useMemo, useRef } from "react";
import { Link } from "@tanstack/react-router";
import gsap from "gsap";

import floralTop from "@/assets/floral-top-long.webp";
import floralBottom from "@/assets/floral-bottom.webp";
import { createFallingLeaves } from "@/lib/falling-leaves";
import { contentImage } from "@/lib/site-content";
import { useCart } from "./cart";
import { formatPrice } from "./products";
import { useProductView } from "./product-view";
import { useStorefront } from "./storefront";
import { UserMenu } from "./UserMenu";

/** The arc looks best with up to nine reels. */
const MAX_REELS = 9;

/* ---------------- Arc geometry ---------------- */

interface ArcPose {
  x: number;
  z: number;
  rotationY: number;
  y: number;
}

function arcPose(offset: number, spacing: number): ArcPose {
  const d = Math.abs(offset);
  return {
    x: offset * spacing,
    z: 50 - Math.pow(d, 1.15) * 52,
    rotationY: -offset * 9,
    y: d * 4,
  };
}

/* ---------------- Icons ---------------- */

function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M20.5 3.5C11 3.5 4.5 8.5 4.5 15.5c0 1.6.4 3 1 4.2C7 13 11 9.5 16 7.5c-4 2.6-7.4 6.6-9 12 1.3.9 2.9 1.3 4.6 1.3 7 0 10-7.6 8.9-17.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ml-0.5 h-3 w-3" aria-hidden="true">
      <path
        d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M5 8h14l-1 12H6L5 8Z" strokeLinejoin="round" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------- Hero ---------------- */

export function ReelmarkHero() {
  const { count, openCart } = useCart();
  const { content, catalog } = useStorefront();
  const { show: showProduct } = useProductView();
  const topFloralSrc = contentImage(content, "image_hero_floral_top", floralTop);
  const bottomFloralSrc = contentImage(content, "image_hero_floral_bottom", floralBottom);
  const reelProducts = useMemo(() => catalog.slice(0, MAX_REELS), [catalog]);

  // Read inside the GSAP effect without re-running the intro animation.
  const reelIdsRef = useRef<string[]>([]);
  reelIdsRef.current = reelProducts.map((p) => p.id);
  const showProductRef = useRef(showProduct);
  showProductRef.current = showProduct;

  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const leavesRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<HTMLButtonElement[]>([]);
  const activeRef = useRef(Math.floor(reelProducts.length / 2));
  const readyRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    activeRef.current = Math.floor(reelProducts.length / 2);
    const cards = cardRefs.current.slice(0, reelProducts.length).filter(Boolean);

    const getSpacing = () => {
      const w = cards[0]?.offsetWidth ?? 200;
      const available = stage.parentElement?.clientWidth ?? window.innerWidth;
      return Math.min(w * 1.1, (available - w * 0.4) / (cards.length - 1));
    };

    const poses = () => {
      const spacing = getSpacing();
      return cards.map((_, i) => arcPose(i - activeRef.current, spacing));
    };

    const ctx = gsap.context(() => {
      gsap.set(cards, { xPercent: -50, transformOrigin: "50% 50%", force3D: true });

      if (reduced) {
        cards.forEach((card, i) => gsap.set(card, { ...poses()[i]!, opacity: 1 }));
        gsap.set("[data-reveal], [data-line]", { clearProps: "all", opacity: 1, y: 0 });
        readyRef.current = true;
        return;
      }

      gsap.set(cards, { x: 0, y: 40, z: -1400, rotationY: 0, opacity: 0 });
      gsap.set("[data-draw]", { strokeDasharray: 400, strokeDashoffset: 400 });

      const tl = gsap.timeline({
        defaults: { ease: "expo.out" },
        onComplete: () => {
          readyRef.current = true;
        },
      });

      tl.to("[data-orb]", { opacity: 1, duration: 2.4, stagger: 0.15, ease: "sine.out" }, 0)
        .fromTo(
          "[data-floral]",
          { opacity: 0, scale: 0.86, rotation: (i) => (i % 2 ? 6 : -6) },
          { opacity: 1, scale: 1, rotation: 0, duration: 2, stagger: 0.12, ease: "power3.out" },
          0.05,
        )
        .fromTo("[data-nav]", { opacity: 0, y: -18 }, { opacity: 1, y: 0, duration: 1.2 }, 0.35)
        .fromTo("[data-kicker]", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1 }, 0.5)
        .to("[data-line]", { y: 0, duration: 1.3, stagger: 0.12 }, 0.6)
        .fromTo("[data-sub]", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.2 }, 0.95);

      const targets = poses();
      const center = activeRef.current;
      cards.forEach((card, i) => {
        tl.to(
          card,
          { ...targets[i]!, opacity: 1, duration: 2, ease: "expo.out" },
          1.05 + Math.abs(i - center) * 0.09,
        );
      });

      tl.fromTo(
        "[data-cta]",
        { opacity: 0, y: 20, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 1.2 },
        1.7,
      )
        .fromTo("[data-note]", { opacity: 0 }, { opacity: 1, duration: 0.8, stagger: 0.2 }, 2)
        .to(
          "[data-draw]",
          { strokeDashoffset: 0, duration: 1.4, stagger: 0.2, ease: "power2.inOut" },
          2.05,
        );

      // Ambient orb drift
      gsap.utils.toArray<HTMLElement>("[data-orb]").forEach((orb, i) => {
        gsap.to(orb, {
          x: gsap.utils.random(-80, 80),
          y: gsap.utils.random(-60, 60),
          duration: gsap.utils.random(10, 16),
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: i * 0.4,
        });
      });

      // Ambient float: every reel gently bobs and sways on its own rhythm.
      gsap.utils.toArray<HTMLElement>("[data-float]").forEach((el, i) => {
        gsap.fromTo(
          el,
          { y: -7, rotation: -1.2 },
          {
            y: 7,
            rotation: 1.2,
            duration: gsap.utils.random(2.6, 3.6),
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: 1.6 + i * 0.22,
          },
        );
      });
    }, root);

    /* ---- Centre reel follows the cursor ---- */
    const follows = cards.map((c) => c.querySelector<HTMLElement>("[data-follow]")!);
    gsap.set(follows, { transformPerspective: 900, transformOrigin: "50% 50%" });
    // Long, soft easing so the reel glides after the cursor instead of snapping to it.
    const followEase = { duration: 1.8, ease: "power2.out" };
    const followTo = follows.map((el) => ({
      x: gsap.quickTo(el, "x", followEase),
      y: gsap.quickTo(el, "y", followEase),
      rx: gsap.quickTo(el, "rotationX", { duration: 2, ease: "power2.out" }),
      ry: gsap.quickTo(el, "rotationY", { duration: 2, ease: "power2.out" }),
    }));
    let lastPointer: { x: number; y: number } | null = null;

    const followCursor = () => {
      const active = activeRef.current;
      followTo.forEach((f, i) => {
        if (!lastPointer || i !== active || !readyRef.current) {
          f.x(0);
          f.y(0);
          f.rx(0);
          f.ry(0);
          return;
        }
        const r = cards[i]!.getBoundingClientRect();
        const dx = gsap.utils.clamp(
          -1,
          1,
          (lastPointer.x - (r.left + r.width / 2)) / (window.innerWidth / 2),
        );
        const dy = gsap.utils.clamp(
          -1,
          1,
          (lastPointer.y - (r.top + r.height / 2)) / (window.innerHeight / 2),
        );
        f.x(dx * 60);
        f.y(dy * 22);
        f.ry(dx * 6);
        f.rx(-dy * 4);
      });
    };

    /* ---- Mouse parallax on the whole arc ---- */
    const rotY = gsap.quickTo(stage, "rotationY", { duration: 1.2, ease: "power3.out" });
    const rotX = gsap.quickTo(stage, "rotationX", { duration: 1.2, ease: "power3.out" });
    const panX = gsap.quickTo(stage, "x", { duration: 1.4, ease: "power3.out" });
    const panY = gsap.quickTo(stage, "y", { duration: 1.4, ease: "power3.out" });

    const onMove = (e: PointerEvent) => {
      if (reduced || e.pointerType === "touch") return;
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      rotY(nx * 10);
      rotX(-ny * 7);
      panX(nx * 36);
      panY(ny * 18);
      lastPointer = { x: e.clientX, y: e.clientY };
      followCursor();
    };
    const onLeave = () => {
      lastPointer = null;
      followCursor();
    };
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);

    /* ---- Hover: push forward, dim siblings ---- */
    const hoverIn = (idx: number) => {
      if (!readyRef.current) return;
      const p = poses();
      cards.forEach((card, i) => {
        const hovered = i === idx;
        gsap.to(card, {
          z: hovered ? p[i]!.z + 100 : p[i]!.z,
          scale: hovered ? 1.06 : 1,
          filter: hovered ? "brightness(1.08) saturate(1.05)" : "brightness(0.82) saturate(0.9)",
          duration: 0.7,
          ease: "power3.out",
          overwrite: "auto",
        });
      });
    };
    const hoverOut = () => {
      if (!readyRef.current) return;
      const p = poses();
      cards.forEach((card, i) =>
        gsap.to(card, {
          z: p[i]!.z,
          scale: 1,
          filter: "brightness(1) saturate(1)",
          duration: 0.8,
          ease: "power3.out",
          overwrite: "auto",
        }),
      );
    };

    /* ---- Click a reel to bring it to the centre ---- */
    const focus = (idx: number) => {
      activeRef.current = idx;
      const p = poses();
      cards.forEach((card, i) =>
        gsap.to(card, {
          ...p[i]!,
          z: i === idx ? p[i]!.z + 100 : p[i]!.z,
          scale: i === idx ? 1.06 : 1,
          duration: 1.2,
          ease: "expo.out",
          overwrite: "auto",
        }),
      );
      followCursor();
    };

    const handlers = cards.map((card, i) => {
      const enter = () => hoverIn(i);
      // First tap brings a reel to the centre; tapping the centred reel opens it to shop.
      const click = () => {
        if (!readyRef.current && !reduced) return;
        const id = reelIdsRef.current[i];
        if (activeRef.current === i && id) showProductRef.current(id);
        else focus(i);
      };
      card.addEventListener("pointerenter", enter);
      card.addEventListener("focus", enter);
      card.addEventListener("pointerleave", hoverOut);
      card.addEventListener("blur", hoverOut);
      card.addEventListener("click", click);
      return { card, enter, click };
    });

    /* ---- Re-layout on resize ---- */
    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!readyRef.current) return;
        cards.forEach((card, i) =>
          gsap.to(card, { ...poses()[i]!, duration: 0.6, ease: "power2.out" }),
        );
      }, 120);
    };
    window.addEventListener("resize", onResize);

    /* ---- Falling leaves ---- */
    // Leaves fall along the side edges and fade out over the reels and headline.
    const floats = cards.map((c) => c.querySelector<HTMLElement>("[data-float]")!);
    const headline = root.querySelector<HTMLElement>("#hero-title");
    const leaves =
      leavesRef.current && !reduced
        ? createFallingLeaves(leavesRef.current, {
            avoid: () =>
              [...floats, ...(headline ? [headline] : [])].map((el) => el.getBoundingClientRect()),
          })
        : null;
    const leafStart = leaves ? setTimeout(() => leaves.start(), 300) : undefined;

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimer);
      if (leafStart) clearTimeout(leafStart);
      handlers.forEach(({ card, enter, click }) => {
        card.removeEventListener("pointerenter", enter);
        card.removeEventListener("focus", enter);
        card.removeEventListener("pointerleave", hoverOut);
        card.removeEventListener("blur", hoverOut);
        card.removeEventListener("click", click);
      });
      leaves?.destroy();
      ctx.revert();
      gsap.killTweensOf(follows);
      gsap.set(follows, { clearProps: "all" });
      readyRef.current = false;
    };
  }, [reelProducts]);

  return (
    <section
      ref={rootRef}
      className="relative isolate flex min-h-screen w-full flex-col overflow-hidden bg-background"
      aria-labelledby="hero-title"
    >
      {/* Ambient depth orbs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div
          data-orb
          className="orb reveal-init left-[-10%] top-[-15%] h-[38rem] w-[38rem] bg-orb-gold"
        />
        <div
          data-orb
          className="orb reveal-init right-[-12%] top-[10%] h-[34rem] w-[34rem] bg-orb-sage"
        />
        <div
          data-orb
          className="orb reveal-init bottom-[-20%] left-[25%] h-[40rem] w-[46rem] bg-orb-mint"
        />
        <div
          data-orb
          className="orb reveal-init bottom-[-10%] right-[5%] h-[26rem] w-[26rem] bg-orb-gold"
        />
      </div>

      {/* Corner florals */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20">
        <img
          data-floral
          src={topFloralSrc}
          alt=""
          width={720}
          height={1234}
          className="floral reveal-init left-[-1.5rem] top-[-1.5rem] w-[clamp(180px,min(24vw,40vh),400px)] origin-top-left"
        />
        <div className="floral right-[-1.5rem] top-[-1.5rem] w-[clamp(180px,min(24vw,40vh),400px)] -scale-x-100">
          <img
            data-floral
            src={topFloralSrc}
            alt=""
            width={720}
            height={1234}
            className="reveal-init block w-full origin-top-left"
          />
        </div>
        <img
          data-floral
          src={bottomFloralSrc}
          alt=""
          width={1024}
          height={1024}
          className="floral reveal-init bottom-[-3.5rem] left-[-3.5rem] w-[clamp(260px,33vw,560px)] origin-bottom-left"
        />
        <div className="floral bottom-[-3.5rem] right-[-3.5rem] w-[clamp(260px,33vw,560px)] -scale-x-100">
          <img
            data-floral
            src={bottomFloralSrc}
            alt=""
            width={1024}
            height={1024}
            className="reveal-init block w-full origin-bottom-left"
          />
        </div>
      </div>

      {/* Falling leaves layer */}
      <div
        ref={leavesRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
      />

      {/* Navbar */}
      <header data-nav className="reveal-init relative z-40 px-4 pt-4 sm:px-8">
        <nav className="nav-glass mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-full py-2 pl-4 pr-2 sm:pl-5">
          <Link to="/" className="flex items-center gap-2 text-foreground">
            <LeafMark className="h-6 w-6 text-primary" />
            <span className="font-display text-xl font-extrabold tracking-[-0.03em]">Reelmark</span>
          </Link>

          <ul className="hidden items-center gap-8 text-[0.95rem] font-medium text-ink-soft md:flex">
            {[
              ["Shop", "#best-sellers"],
              ["Occasions", "#occasions"],
              ["Bouquet Finder", "#finder"],
              ["Makers", "#makers"],
            ].map(([item, href]) => (
              <li key={item}>
                <a
                  href={href}
                  className="relative transition-colors hover:text-primary after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-primary after:transition-all hover:after:w-full"
                >
                  {item}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={openCart}
              aria-label={`Open bag, ${count} ${count === 1 ? "item" : "items"}`}
              className="flex cursor-pointer items-center gap-2 rounded-full px-2.5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-nav-ghost sm:px-3"
            >
              <BagIcon />
              <span className="hidden sm:inline">Bag</span>
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.7rem] font-bold text-primary-foreground">
                {count}
              </span>
            </button>
            <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-border sm:block" />
            <UserMenu />
          </div>
        </nav>
      </header>

      {/* Copy */}
      <div className="relative z-40 mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-8 text-center sm:pt-[min(3.5rem,5vh)]">
        <p
          data-kicker
          className="reveal-init rounded-full bg-kicker px-4 py-1.5 text-sm font-semibold tracking-tight text-kicker-foreground ring-1 ring-kicker-foreground/15 backdrop-blur-sm"
        >
          {content.hero_kicker}
        </p>

        <h1
          id="hero-title"
          className="mt-6 font-display text-[clamp(2.75rem,min(7.4vw,10.5vh),6.25rem)] font-extrabold leading-[0.92] tracking-[-0.055em] text-foreground"
        >
          <span className="block overflow-hidden pb-[0.08em]">
            <span data-line className="line-init block">
              {content.hero_title_1}
            </span>
          </span>
          <span className="block overflow-hidden pb-[0.08em]">
            <span data-line className="line-init block">
              {content.hero_title_2}
            </span>
          </span>
        </h1>

        <p
          data-sub
          className="reveal-init mt-5 max-w-xl text-[clamp(1rem,1.4vw,1.15rem)] leading-relaxed text-muted-foreground"
        >
          {content.hero_subtitle}
        </p>
      </div>

      {/* 3D carousel */}
      <div className="relative z-10 mt-6 flex-1 sm:mt-8">
        <div className="stage-perspective relative mx-auto h-[clamp(240px,min(26vw,34vh),330px)] w-full max-w-[1500px]">
          <div ref={stageRef} className="preserve-3d pointer-events-none absolute inset-0">
            {reelProducts.map((p, i) => (
              <button
                key={p.id}
                ref={(el) => {
                  if (el) cardRefs.current[i] = el;
                }}
                type="button"
                aria-label={`Play reel: ${p.name} by ${p.maker}, ${formatPrice(p.price)}`}
                className="reveal-init group pointer-events-auto absolute left-1/2 top-0 aspect-[3/4.3] w-[clamp(150px,min(14vw,23vh),215px)] cursor-pointer rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span data-follow className="absolute inset-0 block">
                  <span
                    data-float
                    className="reel-card absolute inset-0 block overflow-hidden rounded-2xl"
                  >
                    <img
                      src={p.image}
                      alt={p.name}
                      width={768}
                      height={1152}
                      loading={i === 3 ? "eager" : "lazy"}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <span className="bg-media-fade absolute inset-0" />
                    <span className="absolute inset-x-0 top-0 p-3">
                      <span className="glass-pill inline-block rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-media-foreground">
                        {p.maker}
                      </span>
                    </span>
                    <span className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3">
                      <span className="line-clamp-1 text-[0.8rem] font-semibold tracking-tight text-media-foreground">
                        {p.name}
                      </span>
                      <span className="flex items-center justify-between">
                        <span className="glass-pill grid h-8 w-8 place-items-center rounded-full text-media-foreground transition-transform group-hover:scale-110">
                          <PlayIcon />
                        </span>
                        <span className="glass-pill rounded-full px-2.5 py-1 text-xs font-bold tracking-tight text-media-foreground">
                          {formatPrice(p.price)}
                        </span>
                      </span>
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* "Tap a reel" note */}
        <div
          data-note
          aria-hidden="true"
          className="reveal-init pointer-events-none absolute right-[8%] top-[-5.5rem] z-40 hidden flex-col items-center lg:flex"
        >
          <span className="rotate-[12deg] whitespace-pre-line text-center font-hand text-2xl leading-6 text-primary">
            {content.hero_note_tap}
          </span>
          <svg
            viewBox="0 0 60 90"
            className="ml-[-2.5rem] h-20 w-12 text-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path data-draw d="M40 4c8 20 2 44-22 76" />
            <path data-draw d="M12 66l6 15 13-7" />
          </svg>
        </div>
      </div>

      {/* CTA */}
      <div className="relative z-40 flex justify-center pb-10 pt-6">
        <div data-cta className="reveal-init relative">
          <div className="rounded-full border-2 border-dashed border-primary/35 p-1.5">
            <a
              href="#best-sellers"
              className="bg-cta group flex items-center gap-2 rounded-full px-9 py-4 text-base font-bold tracking-tight text-primary-foreground shadow-cta transition-transform duration-300 hover:-translate-y-0.5 hover:scale-[1.02]"
            >
              {content.hero_cta}
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          </div>

          <div
            data-note
            aria-hidden="true"
            className="reveal-init pointer-events-none absolute right-full top-1/2 mr-3 hidden items-end sm:flex"
          >
            <span className="mb-[-1.5rem] rotate-[18deg] whitespace-nowrap font-hand text-2xl text-primary">
              {content.hero_note_sameday}
            </span>
            <svg
              viewBox="0 0 70 50"
              className="h-12 w-16 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path data-draw d="M6 44C14 22 34 10 62 12" />
              <path data-draw d="M50 4l12 8-11 9" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
