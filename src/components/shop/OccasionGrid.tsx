import { ArrowUpRight } from "lucide-react";

import { SectionHeading } from "./SectionHeading";
import { bouquets, type Occasion } from "./products";

const occasions: { id: Occasion; label: string; note: string; image: string }[] = [
  {
    id: "birthday",
    label: "Birthday",
    note: "Bright, joyful, a little loud",
    image: bouquets.find((b) => b.id === "sunflower-wrap")!.image,
  },
  {
    id: "anniversary",
    label: "Anniversary",
    note: "Peonies, roses, all the romance",
    image: bouquets.find((b) => b.id === "blush-peony")!.image,
  },
  {
    id: "sympathy",
    label: "Sympathy",
    note: "Calm whites, gently said",
    image: bouquets.find((b) => b.id === "white-lily")!.image,
  },
  {
    id: "just-because",
    label: "Just because",
    note: "No reason needed",
    image: bouquets.find((b) => b.id === "wildflower-jar")!.image,
  },
];

export const occasionLabel = (id: Occasion) => occasions.find((o) => o.id === id)!.label;

export function OccasionGrid({ onPick }: { onPick: (o: Occasion) => void }) {
  return (
    <section
      id="occasions"
      data-trail-section
      aria-labelledby="occasions-title"
      className="relative px-4 py-24 sm:px-8"
    >
      <SectionHeading
        id="occasions-title"
        kicker="Shop by occasion"
        title="Whatever the moment, there's a bouquet"
      >
        Pick a moment and our bouquet finder will start from there.
      </SectionHeading>

      <div className="mx-auto mt-12 grid max-w-6xl grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        {occasions.map((o, i) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            className={`group relative aspect-[3/4] overflow-hidden rounded-3xl text-left shadow-card outline-none ring-offset-4 ring-offset-background transition-transform duration-500 hover:-translate-y-1.5 focus-visible:ring-2 focus-visible:ring-ring ${i % 2 ? "lg:translate-y-8 lg:hover:translate-y-6" : ""}`}
          >
            <img
              src={o.image}
              alt=""
              width={768}
              height={1088}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <span className="bg-media-fade absolute inset-0" />
            <span className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full glass-pill text-media-foreground transition-transform duration-300 group-hover:rotate-45">
              <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="absolute inset-x-0 bottom-0 p-5">
              <span className="block font-display text-[clamp(1.4rem,2.2vw,2rem)] font-extrabold leading-none tracking-[-0.04em] text-media-foreground">
                {o.label}
              </span>
              <span className="mt-1.5 block text-sm text-media-foreground/85">{o.note}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
