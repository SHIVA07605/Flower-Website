import maker1 from "@/assets/makers/maker-1.jpg";
import maker2 from "@/assets/makers/maker-2.jpg";
import maker3 from "@/assets/makers/maker-3.jpg";
import maker4 from "@/assets/makers/maker-4.jpg";
import { contentImage } from "@/lib/site-content";
import { SectionHeading } from "./SectionHeading";
import { useStorefront } from "./storefront";

export function Makers() {
  const { content } = useStorefront();

  const makersList = [
    {
      photo: contentImage(content, "image_maker_1", maker1),
      name: "Rosa Alvarez",
      studio: "Petalcraft",
      craft: "Garden roses & romantic posies",
    },
    {
      photo: contentImage(content, "image_maker_2", maker2),
      name: "Theo Marsh",
      studio: "Field & Stem",
      craft: "Dried stems & golden wraps",
    },
    {
      photo: contentImage(content, "image_maker_3", maker3),
      name: "Meera Iyer",
      studio: "Stillwater",
      craft: "Quiet, all-white sympathy work",
    },
    {
      photo: contentImage(content, "image_maker_4", maker4),
      name: "Ama Boateng",
      studio: "Wildroot",
      craft: "Wild, just-picked meadow jars",
    },
  ];

  return (
    <section
      id="makers"
      data-trail-section
      aria-labelledby="makers-title"
      className="relative px-4 py-24 sm:px-8"
    >
      <SectionHeading id="makers-title" kicker={content.makers_kicker} title={content.makers_title}>
        {content.makers_desc}
      </SectionHeading>

      <div className="mx-auto mt-12 grid max-w-6xl grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {makersList.map((m, i) => (
          <figure key={m.name} className={`group ${i % 2 ? "sm:mt-10" : ""}`}>
            <div className="reel-card relative aspect-[4/5] overflow-hidden rounded-3xl">
              <img
                src={m.photo}
                alt={`${m.name} of ${m.studio}`}
                width={768}
                height={960}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <span className="absolute left-3 top-3 glass-pill rounded-full px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-media-foreground">
                {m.studio}
              </span>
            </div>
            <figcaption className="mt-3 px-1">
              <p className="font-display text-lg font-bold tracking-[-0.03em] text-foreground">
                {m.name}
              </p>
              <p className="text-sm text-muted-foreground">{m.craft}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
