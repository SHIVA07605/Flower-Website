import goldenHour from "@/assets/products/golden-hour-roses.jpg";
import blushPeony from "@/assets/products/blush-peony.jpg";
import wildflower from "@/assets/products/wildflower-jar.jpg";
import driedPampas from "@/assets/products/dried-pampas.jpg";
import ranunculus from "@/assets/products/ranunculus-posy.jpg";
import whiteLily from "@/assets/products/white-lily.jpg";
import sunflower from "@/assets/products/sunflower-wrap.jpg";

export type Occasion = "birthday" | "anniversary" | "sympathy" | "just-because";

export interface Bouquet {
  id: string;
  name: string;
  maker: string;
  price: number;
  image: string;
  flowers: string[];
  palette: string;
  occasions: Occasion[];
  blurb: string;
}

/** Shared catalog: shown on the page and used by the AI bouquet finder. Priced in Rupees (₹). */
export const bouquets: Bouquet[] = [
  {
    id: "wildflower-jar",
    name: "Meadow Jar",
    maker: "Wildroot",
    price: 1299,
    image: wildflower,
    flowers: ["cornflower", "chamomile", "cosmos", "buttercup", "wild grasses"],
    palette: "blue, pink and buttery yellow",
    occasions: ["just-because", "birthday"],
    blurb: "A loose, just-picked jar of seasonal wildflowers.",
  },
  {
    id: "blush-peony",
    name: "Blush Peony Cloud",
    maker: "Petalcraft",
    price: 2499,
    image: blushPeony,
    flowers: ["peony", "garden rose", "spray rose"],
    palette: "soft blush and pale pink",
    occasions: ["anniversary", "birthday"],
    blurb: "Big, romantic peonies and garden roses in a cream vase.",
  },
  {
    id: "ranunculus-posy",
    name: "Coral Ranunculus Posy",
    maker: "Petalcraft",
    price: 1699,
    image: ranunculus,
    flowers: ["ranunculus", "sweet pea"],
    palette: "coral, peach and candy pink",
    occasions: ["birthday", "just-because"],
    blurb: "A bright hand-tied posy of ranunculus and sweet peas.",
  },
  {
    id: "golden-hour-roses",
    name: "Golden Hour Roses",
    maker: "Field & Stem",
    price: 1999,
    image: goldenHour,
    flowers: ["yellow garden rose", "mimosa", "fern"],
    palette: "golden yellow and green",
    occasions: ["birthday", "anniversary", "just-because"],
    blurb: "Our signature yellow garden roses and mimosa in kraft wrap.",
  },
  {
    id: "white-lily",
    name: "White Lily Grace",
    maker: "Stillwater",
    price: 2799,
    image: whiteLily,
    flowers: ["lily", "white rose", "lisianthus", "eucalyptus"],
    palette: "pure white and silver-green",
    occasions: ["sympathy"],
    blurb: "A calm, all-white arrangement in a low stone bowl.",
  },
  {
    id: "sunflower-wrap",
    name: "Sunshine Wrap",
    maker: "Wildroot",
    price: 1499,
    image: sunflower,
    flowers: ["sunflower", "gerbera", "billy buttons", "solidago"],
    palette: "sunny yellow and orange",
    occasions: ["birthday", "just-because"],
    blurb: "Sunflowers and gerberas wrapped like a ray of light.",
  },
  {
    id: "dried-pampas",
    name: "Dried Pampas Bundle",
    maker: "Field & Stem",
    price: 1199,
    image: driedPampas,
    flowers: ["pampas grass", "bunny tails", "wheat", "strawflower"],
    palette: "cream, wheat and dusty pink",
    occasions: ["just-because", "anniversary"],
    blurb: "Everlasting dried stems that stay beautiful for months.",
  },
];

/** Formats price in Indian Rupees (₹) */
export const formatPrice = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export const getBouquet = (id: string) => bouquets.find((b) => b.id === id);
