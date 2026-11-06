import { bouquets, OCCASIONS, type Bouquet, type Occasion } from "@/components/shop/products";

/**
 * A row of the Supabase `products` table. For a base bouquet (same id as in products.ts)
 * every null column means "keep the original"; any other id is a bouquet the admin added.
 */
export interface ProductRow {
  id: string;
  name: string | null;
  maker: string | null;
  price: number | string | null;
  image_url: string | null;
  flowers: string[] | null;
  palette: string | null;
  occasions: string[] | null;
  blurb: string | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  sort_order: number | null;
  updated_at?: string | null;
}

export interface CatalogItem extends Bouquet {
  isActive: boolean;
  isFeatured: boolean;
  /** Added by the admin (not part of products.ts). */
  isCustom: boolean;
  /** A base bouquet with admin overrides. */
  isEdited: boolean;
  sortOrder: number;
}

const BASE_IDS = new Set(bouquets.map((b) => b.id));
export const isBaseBouquetId = (id: string) => BASE_IDS.has(id);

const text = (value: string | null | undefined) => {
  const t = value?.trim();
  return t ? t : undefined;
};

const positivePrice = (value: number | string | null | undefined) => {
  const n = Number(value);
  return value !== null && value !== undefined && Number.isFinite(n) && n > 0 ? n : undefined;
};

const list = (value: string[] | null | undefined) => {
  const items = (value ?? []).map((v) => v.trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
};

export const isOccasion = (value: string): value is Occasion =>
  (OCCASIONS as readonly string[]).includes(value);

const occasionList = (value: string[] | null | undefined) => {
  const items = (value ?? []).filter(isOccasion);
  return items.length > 0 ? items : undefined;
};

/** Default position of a base bouquet; admin-added bouquets go after them unless reordered. */
export const baseSortOrder = (index: number) => (index + 1) * 10;

function applyOverrides(base: Bouquet, index: number, row: ProductRow | undefined): CatalogItem {
  return {
    ...base,
    name: text(row?.name) ?? base.name,
    maker: text(row?.maker) ?? base.maker,
    price: positivePrice(row?.price) ?? base.price,
    image: text(row?.image_url) ?? base.image,
    flowers: list(row?.flowers) ?? base.flowers,
    palette: text(row?.palette) ?? base.palette,
    occasions: occasionList(row?.occasions) ?? base.occasions,
    blurb: text(row?.blurb) ?? base.blurb,
    isActive: row?.is_active ?? true,
    isFeatured: row?.is_featured ?? base.bestSeller ?? false,
    isCustom: false,
    isEdited: row !== undefined,
    sortOrder: row?.sort_order ?? baseSortOrder(index),
  };
}

function customItem(row: ProductRow, index: number): CatalogItem | null {
  const name = text(row.name);
  const price = positivePrice(row.price);
  if (!name || price === undefined) return null;
  return {
    id: row.id,
    name,
    maker: text(row.maker) ?? "Reelmark Studio",
    price,
    image: text(row.image_url) ?? bouquets[0]!.image,
    flowers: list(row.flowers) ?? ["seasonal blooms"],
    palette: text(row.palette) ?? "seasonal colours",
    occasions: occasionList(row.occasions) ?? ["just-because"],
    blurb: text(row.blurb) ?? "",
    isActive: row.is_active ?? true,
    isFeatured: row.is_featured ?? false,
    isCustom: true,
    isEdited: false,
    sortOrder: row.sort_order ?? baseSortOrder(bouquets.length + index),
  };
}

/**
 * The live catalog: products.ts with the admin's database edits layered on top.
 * Hidden bouquets are dropped unless `includeHidden` is set (admin views).
 */
export function mergeCatalog(
  rows: readonly ProductRow[],
  opts: { includeHidden?: boolean } = {},
): CatalogItem[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const items = bouquets.map((b, i) => applyOverrides(b, i, byId.get(b.id)));
  rows
    .filter((r) => !BASE_IDS.has(r.id))
    .forEach((r, i) => {
      const item = customItem(r, i);
      if (item) items.push(item);
    });
  items.sort((a, b) => a.sortOrder - b.sortOrder);
  return opts.includeHidden ? items : items.filter((i) => i.isActive);
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "bouquet"
  );
}
