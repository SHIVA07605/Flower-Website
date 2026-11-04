import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import bouquet from "@/assets/bouquet-center.webp";
import kitchenVase from "@/assets/reviews/review-2.jpg";
import { createFallingLeaves } from "@/lib/falling-leaves";
import { bouquets, formatPrice } from "./products";
import { useSiteContent } from "@/hooks/use-site-content";

interface Tile {
  image: string;
  label: string;
  price?: number;
  side: "left" | "right";
  x: string;
  top: string;
  width: string;
  rotate: number;
  depth: number;
}

const byId = (id: string) => bouquets.find((b) => b.id === id)!;

/** Product photos arranged in the space around the bouquet (desktop). */
const tiles: Tile[] = [
  {
    ...pick("blush-peony"),
    side: "left",
    x: "5.5%",
    top: "4%",
    width: "clamp(120px,11vw,190px)",
    rotate: -6,
    depth: 1.2,
  },
  {
    ...pick("wildflower-jar"),
    side: "left",
    x: "19%",
    top: "-4%",
    width: "clamp(96px,8.5vw,150px)",
    rotate: 5,
    depth: 0.6,
  },
  {
    ...pick("dried-pampas"),
    side: "left",
    x: "4.5%",
    top: "54%",
    width: "clamp(110px,10vw,170px)",
    rotate: 3,
    depth: 0.9,
  },
  {
    ...pick("ranunculus-posy"),
    side: "left",
    x: "17.5%",
    top: "40%",
    width: "clamp(130px,12vw,210px)",
    rotate: -3,
    depth: 1.5,
  },
  {
    ...pick("sunflower-wrap"),
    side: "right",
    x: "5.5%",
    top: "2%",
    width: "clamp(120px,11vw,190px)",
    rotate: 6,
    depth: 1.1,
  },
  {
    image: kitchenVase,
    label: "Delivered this morning",
    side: "right",
    x: "19%",
    top: "-6%",
    width: "clamp(96px,8.5vw,150px)",
    rotate: -4,
    depth: 0.7,
  },
  {
    ...pick("white-lily"),
    side: "right",
    x: "4.5%",
    top: "56%",
    width: "clamp(110px,10vw,170px)",
    rotate: -3,
    depth: 1,
  },
  {
    ...pick("golden-hour-roses"),
    side: "right",
    x: "17.5%",
    top: "40%",
    width: "clamp(130px,12vw,210px)",
    rotate: 4,
    depth: 1.4,
  },
];

function pick(id: string) {
  const b = byId(id);
  return { image: b.image, label: b.name, price: b.price };
}

/**
 * About section: the signature bouquet blooms in the centre, framed by real
 * product photos that drift at different depths as you scroll.
 */
export function BouquetGallery() {
  const { getImage } = useSiteContent();
  const centerBouquetImg = getImage("image_bouquet_center", bouquet);
  const sectionRef = useRef<HTMLElement>(null);
  const leavesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    gsap.registerPlugin(ScrollTrigger);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set("[data-g-reveal], [data-tile], [data-bouquet-enter], [data-halo]", {
          opacity: 1,
          y: 0,
        });
        return;
      }

      gsap
        .timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: section, start: "top 85%", end: "top 15%", scrub: 1.2 },
        })
        .fromTo(
          "[data-bouquet-enter]",
          { y: 160, scale: 0.55, rotation: -10, opacity: 0 },
          { y: 0, scale: 1, rotation: 0, opacity: 1, ease: "power2.out" },
          0,
        )
        .fromTo(
          "[data-halo]",
          { scale: 0.4, opacity: 0 },
          { scale: 1, opacity: 1, ease: "power1.out" },
          0,
        )
        .fromTo(
          "[data-tile]",
          { opacity: 0, y: 90, scale: 0.85 },
          { opacity: 1, y: 0, scale: 1, stagger: 0.05, ease: "power2.out" },
          0.1,
        )
        .fromTo(
          "[data-g-reveal]",
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, stagger: 0.08, ease: "power2.out" },
          0.15,
        );

      // Depth parallax: closer photos travel further.
      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
        const depth = Number(el.dataset["parallax"] ?? 1);
        gsap.fromTo(
          el,
          { y: 50 * depth },
          {
            y: -70 * depth,
            ease: "none",
            scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 1 },
          },
        );
      });

      gsap.to("[data-bouquet-sway]", {
        rotation: 2.2,
        duration: 3.6,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        startAt: { rotation: -2.2 },
      });
      gsap.to("[data-halo]", { rotation: 360, duration: 60, ease: "none", repeat: -1 });
      gsap.utils.toArray<HTMLElement>("[data-tile-float]").forEach((el, i) => {
        gsap.fromTo(
          el,
          { y: -6 },
          {
            y: 6,
            duration: gsap.utils.random(2.4, 3.4),
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            delay: i * 0.2,
          },
        );
      });
    }, section);

    const bouquetEl = section.querySelector<HTMLElement>("[data-bouquet-sway]");
    const tileEls = Array.from(section.querySelectorAll<HTMLElement>("[data-tile]"));
    const leaves =
      leavesRef.current && !reduced
        ? createFallingLeaves(leavesRef.current, {
            max: 12,
            interval: 800,
            edgeBand: 0.1,
            avoid: () =>
              [...tileEls, ...(bouquetEl ? [bouquetEl] : [])].map((el) =>
                el.getBoundingClientRect(),
              ),
          })
        : null;
    const leafTrigger = leaves
      ? ScrollTrigger.create({
          trigger: section,
          start: "top 60%",
          once: true,
          onEnter: () => leaves.start(),
        })
      : null;

    return () => {
      leafTrigger?.kill();
      leaves?.destroy();
      ctx.revert();
    };
  }, []);

  return (
    <section
      id="about"
      ref={sectionRef}
      data-trail-section
      aria-labelledby="bouquet-title"
      className="relative isolate w-full overflow-hidden bg-background py-20 sm:py-24"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="orb left-[-8%] top-[20%] h-[30rem] w-[30rem] bg-orb-sage" />
        <div className="orb bottom-[5%] right-[-10%] h-[34rem] w-[34rem] bg-orb-gold" />
      </div>
      <div
        ref={leavesRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
      />

      <div className="relative z-40 mx-auto flex w-full max-w-3xl flex-col items-center px-6 text-center">
        <p
          data-g-reveal
          className="reveal-init rounded-full bg-kicker px-4 py-1.5 text-sm font-semibold tracking-tight text-kicker-foreground ring-1 ring-kicker-foreground/15"
        >
          The Reelmark Bouquet
        </p>
        <h2
          id="bouquet-title"
          data-g-reveal
          className="reveal-init mt-4 font-display text-[clamp(2rem,min(5vw,7vh),4.25rem)] font-extrabold leading-[0.95] tracking-[-0.05em] text-balance text-foreground"
        >
          Every stem, gathered in one place
        </h2>
        <p
          data-g-reveal
          className="reveal-init mt-3 max-w-lg text-[clamp(0.95rem,1.2vw,1.05rem)] leading-relaxed text-muted-foreground"
        >
          Our florists cut, condition and hand-tie every bouquet the morning it ships. These are a
          few of today's favourites, straight from the studio bench.
        </p>
      </div>

      {/* Stage */}
      <div className="relative mx-auto mt-6 h-[min(78vh,760px)] w-full max-w-[1500px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2"
        >
          <div
            data-halo
            className="bouquet-halo reveal-init h-[min(80vh,60vw)] w-[min(80vh,60vw)] rounded-full"
          />
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div data-bouquet-enter className="reveal-init">
            <div data-bouquet-sway className="origin-bottom">
              <img
                src={centerBouquetImg}
                alt="A large bouquet of yellow garden roses, anemones and mimosa tied with a gold ribbon"
                width={1024}
                height={1216}
                loading="lazy"
                className="relative block h-[min(52vh,100vw)] w-auto drop-shadow-[0_24px_30px_oklch(0.3_0.05_80/0.2)] sm:h-[min(66vh,50vw,680px)]"
              />
            </div>
          </div>
        </div>

        {/* Product photos filling the space around the bouquet */}
        <div className="absolute inset-0 z-20 hidden lg:block">
          {tiles.map((t, i) => (
            <div
              key={i}
              data-parallax={t.depth}
              className="absolute"
              style={{ [t.side]: t.x, top: t.top, width: t.width }}
            >
              <figure
                data-tile
                className="reveal-init group relative aspect-[3/4.2] w-full"
                style={{ rotate: `${t.rotate}deg` }}
              >
                <span
                  data-tile-float
                  className="reel-card absolute inset-0 block overflow-hidden rounded-2xl"
                >
                  <img
                    src={t.image}
                    alt={t.label}
                    width={768}
                    height={1088}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <span className="bg-media-fade absolute inset-0" />
                  <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
                    <span className="line-clamp-2 text-[0.72rem] font-semibold leading-tight tracking-tight text-media-foreground">
                      {t.label}
                    </span>
                    {t.price !== undefined && (
                      <span className="glass-pill shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold text-media-foreground">
                        {formatPrice(t.price)}
                      </span>
                    )}
                  </figcaption>
                </span>
              </figure>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile / tablet: photos sit under the bouquet */}
      <div className="relative z-20 mx-auto -mt-6 grid max-w-2xl grid-cols-3 gap-3 px-6 lg:hidden">
        {tiles.slice(0, 6).map((t, i) => (
          <figure
            key={i}
            data-tile
            className="reveal-init reel-card relative aspect-[3/4] overflow-hidden rounded-xl"
          >
            <img
              src={t.image}
              alt={t.label}
              width={768}
              height={1088}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <span className="bg-media-fade absolute inset-0" />
            <figcaption className="absolute inset-x-0 bottom-0 p-2 text-[0.65rem] font-semibold leading-tight text-media-foreground">
              {t.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
