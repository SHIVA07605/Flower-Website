import { useEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";

interface Geometry {
  d: string;
  width: number;
  height: number;
  blooms: { x: number; y: number }[];
}

interface Petal {
  len: number;
  x: number;
  y: number;
  rot: number;
  hue: "gold" | "petal" | "sage";
  size: number;
}

const PETAL = "M0 -7C4 -4 4 3 0 7C-4 3 -4 -4 0 -7Z";

/** Build a wandering path that runs down the side gutters and crosses over between sections. */
function buildPath(wrapper: HTMLElement): Geometry {
  const W = wrapper.clientWidth;
  const H = wrapper.scrollHeight;
  const mobile = W < 768;
  const gutter = mobile ? 12 : Math.max(22, Math.min(64, (W - 1152) / 4 + 26));
  const xs = [gutter, mobile ? gutter : W - gutter];
  const sections = Array.from(
    wrapper.querySelectorAll<HTMLElement>(":scope > [data-trail-section]"),
  );
  const boundaries = sections.map((s) => s.offsetTop).filter((y) => y > 80 && y < H - 80);

  let side = 0;
  let y = 0;
  let d = `M ${xs[0]} 0`;
  const blooms: { x: number; y: number }[] = [];

  const wiggleTo = (toY: number) => {
    const x = xs[side]!;
    const span = toY - y;
    if (span <= 0) return;
    const steps = Math.max(1, Math.round(span / 260));
    const step = span / steps;
    for (let i = 0; i < steps; i++) {
      const y1 = y + step * (i + 1);
      const bend = (i % 2 ? -1 : 1) * (mobile ? 5 : 14) * (side === 0 ? 1 : -1);
      d += ` Q ${x + bend} ${y + step * (i + 0.5)} ${x} ${y1}`;
    }
    y = toY;
  };

  for (const b of boundaries) {
    const cross = mobile ? 0 : 90;
    wiggleTo(b - cross);
    if (mobile) {
      blooms.push({ x: xs[0]!, y: b });
      continue;
    }
    const from = xs[side]!;
    const next = side === 0 ? 1 : 0;
    const to = xs[next]!;
    d += ` C ${from} ${b + 20}, ${to} ${b - 20}, ${to} ${b + cross}`;
    blooms.push({ x: (from + to) / 2, y: b });
    side = next;
    y = b + cross;
  }
  wiggleTo(H - 40);

  return { d, width: W, height: H, blooms };
}

/**
 * A slim line that grows as you scroll, weaving between sections and leaving
 * a trail of petals. Each crossing between sections blooms as the line reaches it.
 */
export function PetalTrail({ children }: { children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const tipRef = useRef<SVGGElement>(null);
  const [geo, setGeo] = useState<Geometry | null>(null);
  const [petals, setPetals] = useState<Petal[]>([]);
  const [bloomLens, setBloomLens] = useState<number[]>([]);
  const petalRefs = useRef<(SVGPathElement | null)[]>([]);
  const bloomRefs = useRef<(SVGGElement | null)[]>([]);

  // Measure + rebuild on resize / content changes.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setGeo(buildPath(wrapper)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrapper);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // Once the path exists, sample it for petals, bloom positions and a y→length lookup.
  const lookup = useRef<{ ys: Float32Array; lens: Float32Array; total: number } | null>(null);
  useEffect(() => {
    const path = pathRef.current;
    if (!path || !geo) return;
    const total = path.getTotalLength();
    const N = 800;
    const ys = new Float32Array(N + 1);
    const lens = new Float32Array(N + 1);
    let maxY = 0;
    for (let i = 0; i <= N; i++) {
      const l = (total * i) / N;
      const p = path.getPointAtLength(l);
      maxY = Math.max(maxY, p.y);
      ys[i] = maxY;
      lens[i] = l;
    }
    lookup.current = { ys, lens, total };
    path.style.strokeDasharray = `${total}`;
    path.style.strokeDashoffset = `${total}`;

    const list: Petal[] = [];
    const hues: Petal["hue"][] = ["gold", "petal", "sage"];
    for (let l = 120, i = 0; l < total - 40; l += 150, i++) {
      const p = path.getPointAtLength(l);
      const side = i % 2 ? 1 : -1;
      list.push({
        len: l,
        x: p.x + side * 9,
        y: p.y,
        rot: (i * 67) % 360,
        hue: hues[i % 3]!,
        size: 0.8 + ((i * 37) % 5) / 10,
      });
    }
    setPetals(list);

    setBloomLens(
      geo.blooms.map((b) => {
        let idx = 0;
        while (idx < N && ys[idx]! < b.y) idx++;
        return lens[idx]!;
      }),
    );
  }, [geo]);

  // Drive the line from scroll position.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const path = pathRef.current;
    if (!wrapper || !path || !geo) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let current = 0;

    const lengthForY = (targetY: number) => {
      const lk = lookup.current;
      if (!lk) return 0;
      const { ys, lens } = lk;
      let lo = 0;
      let hi = ys.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (ys[mid]! < targetY) lo = mid + 1;
        else hi = mid;
      }
      return lens[lo]!;
    };

    const render = () => {
      const lk = lookup.current;
      if (!lk) return;
      const top = wrapper.getBoundingClientRect().top;
      const targetY = window.innerHeight * 0.6 - top;
      const target = Math.max(0, Math.min(lk.total, lengthForY(targetY)));
      current = reduced ? target : current + (target - current) * 0.14;
      path.style.strokeDashoffset = `${lk.total - current}`;

      const tip = tipRef.current;
      if (tip) {
        const p = path.getPointAtLength(current);
        const q = path.getPointAtLength(Math.min(lk.total, current + 2));
        const angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI + 90;
        tip.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${angle})`);
        tip.style.opacity = current > 4 && current < lk.total - 4 ? "1" : "0";
      }

      petalRefs.current.forEach((el, i) => {
        const pt = petals[i];
        if (!el || !pt) return;
        const on = current >= pt.len;
        el.style.opacity = on ? "0.9" : "0";
        el.style.transform = `translate(${pt.x}px, ${pt.y}px) rotate(${pt.rot + (on ? 0 : -90)}deg) scale(${on ? pt.size : 0.2})`;
      });

      bloomRefs.current.forEach((el, i) => {
        const len = bloomLens[i];
        if (!el || len === undefined) return;
        el.dataset["on"] = current >= len ? "true" : "false";
      });
    };

    gsap.ticker.add(render);
    return () => gsap.ticker.remove(render);
  }, [geo, petals, bloomLens]);

  const hueVar = {
    gold: "var(--gold)",
    petal: "var(--petal)",
    sage: "oklch(0.62 0.09 160)",
  } as const;

  return (
    <div ref={wrapperRef} className="relative">
      {children}
      {geo && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-30"
          width={geo.width}
          height={geo.height}
          viewBox={`0 0 ${geo.width} ${geo.height}`}
        >
          <defs>
            <linearGradient
              id="trail-grad"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="0"
              y2={geo.height}
            >
              <stop offset="0%" stopColor="var(--gold)" />
              <stop offset="50%" stopColor="oklch(0.6 0.1 160)" />
              <stop offset="100%" stopColor="var(--primary)" />
            </linearGradient>
          </defs>
          {/* Faint guide of the full route */}
          <path
            d={geo.d}
            fill="none"
            stroke="var(--primary)"
            strokeOpacity="0.08"
            strokeWidth="1.5"
            strokeDasharray="2 7"
            strokeLinecap="round"
          />
          {/* Growing line */}
          <path
            ref={pathRef}
            d={geo.d}
            fill="none"
            stroke="url(#trail-grad)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {petals.map((p, i) => (
            <path
              key={i}
              ref={(el) => {
                petalRefs.current[i] = el;
              }}
              d={PETAL}
              fill={hueVar[p.hue]}
              style={{
                opacity: 0,
                transition: "opacity .5s ease, transform .6s cubic-bezier(.2,.9,.3,1.4)",
              }}
            />
          ))}

          {geo.blooms.map((b, i) => (
            <g
              key={i}
              ref={(el) => {
                bloomRefs.current[i] = el;
              }}
              data-on="false"
              transform={`translate(${b.x} ${b.y})`}
              className="group/bloom"
            >
              <g className="origin-center scale-0 transition-transform duration-700 ease-[cubic-bezier(.2,.9,.3,1.5)] group-data-[on=true]/bloom:scale-100">
                {[0, 72, 144, 216, 288].map((r) => (
                  <path
                    key={r}
                    d="M0 -13C5 -9 5 -3 0 0C-5 -3 -5 -9 0 -13Z"
                    fill="var(--gold)"
                    transform={`rotate(${r})`}
                  />
                ))}
                <circle r="3.5" fill="var(--primary)" />
              </g>
            </g>
          ))}

          {/* Leading petal */}
          <g ref={tipRef} style={{ opacity: 0, transition: "opacity .3s" }}>
            <circle r="9" fill="var(--gold)" fillOpacity="0.25" />
            <path d="M0 -9C5 -5 5 4 0 9C-5 4 -5 -5 0 -9Z" fill="var(--petal)" />
          </g>
        </svg>
      )}
    </div>
  );
}
