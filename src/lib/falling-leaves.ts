import gsap from "gsap";

interface FallingLeavesOptions {
  /** Max leaves alive at once. */
  max?: number;
  /** ms between spawns. */
  interval?: number;
  /** Fraction of width (each side) leaves spawn in. */
  edgeBand?: number;
  /** Rects leaves fade out over (in viewport coords). */
  avoid?: () => DOMRect[];
}

const COLORS = ["var(--sage)", "var(--gold)", "var(--petal)", "oklch(0.62 0.09 160)"];

const LEAF_PATH = "M12 2C6 6 4 12 6 18c1.6 2.4 4 3.6 6 4 2-.4 4.4-1.6 6-4 2-6 0-12-6-16Z";

/** Spawns small leaves/petals that drift down the edges of a container. */
export function createFallingLeaves(container: HTMLElement, opts: FallingLeavesOptions = {}) {
  const max = opts.max ?? 14;
  const interval = opts.interval ?? 700;
  const edgeBand = opts.edgeBand ?? 0.22;
  let alive = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const tweens = new Set<gsap.core.Timeline>();

  const spawn = () => {
    if (alive >= max || document.hidden) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const left = Math.random() < 0.5;
    const band = w * edgeBand;
    const x = left ? Math.random() * band : w - Math.random() * band;
    const size = gsap.utils.random(12, 22);

    const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    el.setAttribute("viewBox", "0 0 24 24");
    el.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size}px;opacity:0;pointer-events:none;`;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", LEAF_PATH);
    path.setAttribute("fill", COLORS[Math.floor(Math.random() * COLORS.length)]!);
    path.setAttribute("opacity", "0.85");
    el.appendChild(path);
    container.appendChild(el);
    alive++;

    const drift = gsap.utils.random(-80, 80);
    const duration = gsap.utils.random(7, 11);
    const tl = gsap.timeline({
      onUpdate: () => {
        if (!opts.avoid) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const over = opts
          .avoid()
          .some((a) => cx > a.left && cx < a.right && cy > a.top && cy < a.bottom);
        if (over) gsap.to(el, { opacity: 0, duration: 0.5, overwrite: "auto" });
      },
      onComplete: () => {
        el.remove();
        alive--;
        tweens.delete(tl);
      },
    });
    tl.set(el, { x, y: -30, rotation: gsap.utils.random(0, 360) })
      .to(el, { opacity: 0.9, duration: 1 }, 0)
      .to(
        el,
        {
          y: h + 40,
          x: x + drift,
          rotation: `+=${gsap.utils.random(180, 520)}`,
          duration,
          ease: "none",
        },
        0,
      )
      .to(el, { opacity: 0, duration: 1.2 }, duration - 1.2);
    tweens.add(tl);
  };

  return {
    start() {
      if (timer) return;
      spawn();
      timer = setInterval(spawn, interval);
    },
    destroy() {
      if (timer) clearInterval(timer);
      tweens.forEach((t) => t.kill());
      tweens.clear();
      container.replaceChildren();
    },
  };
}
