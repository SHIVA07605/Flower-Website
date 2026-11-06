import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Pencil, Plus, RotateCcw, Star, Trash2 } from "lucide-react";

import {
  getBaseBouquet,
  OCCASION_LABELS,
  OCCASIONS,
  formatPrice,
} from "@/components/shop/products";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { listAdminProducts, removeProduct, saveProduct } from "@/lib/admin.functions";
import { productInputSchema, type ProductInput } from "@/lib/admin-types";
import type { CatalogItem } from "@/lib/catalog";
import { unwrap } from "@/lib/result";
import {
  AdminField,
  adminInput,
  EmptyState,
  ErrorNote,
  ImageUploadButton,
  LoadingRows,
  Panel,
  useAdminAction,
} from "./shared";

/** The editor's view of a bouquet. `imageUrl: null` keeps a base bouquet's original photo. */
function toInput(p: CatalogItem): ProductInput {
  const base = getBaseBouquet(p.id);
  return {
    id: p.id,
    name: p.name,
    maker: p.maker,
    price: p.price,
    imageUrl: base && p.image === base.image ? null : p.image,
    flowers: p.flowers,
    palette: p.palette,
    occasions: p.occasions,
    blurb: p.blurb,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    sortOrder: p.sortOrder,
  };
}

const PRODUCTS_KEY = ["admin", "products"];

export function ProductsPanel() {
  const [editing, setEditing] = useState<CatalogItem | "new" | null>(null);
  const query = useQuery({
    queryKey: PRODUCTS_KEY,
    queryFn: async () => unwrap(await listAdminProducts()),
  });

  const save = useAdminAction((input: ProductInput) => saveProduct({ data: input }), {
    success: "Saved — the storefront shows it straight away.",
    invalidate: [PRODUCTS_KEY],
  });
  const remove = useAdminAction((id: string) => removeProduct({ data: { id } }), {
    success: (r) => (r.reset ? "Bouquet reset to its original details." : "Bouquet deleted."),
    invalidate: [PRODUCTS_KEY],
  });

  const products = query.data ?? [];
  const nextSort = products.reduce((max, p) => Math.max(max, p.sortOrder), 0) + 10;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Bouquets & prices</h2>
          <p className="text-sm text-ink-soft">
            Every change here updates the reels, best sellers, gallery, bag and AI finder.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="bg-cta shadow-cta flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add bouquet
        </button>
      </div>

      <Panel className="!p-0 overflow-hidden">
        {query.isPending ? (
          <LoadingRows />
        ) : query.isError ? (
          <div className="p-5">
            <ErrorNote message={query.error.message} />
          </div>
        ) : products.length === 0 ? (
          <EmptyState>No bouquets yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-border/60">
            {products.map((p) => (
              <li
                key={p.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap ${p.isActive ? "" : "bg-muted/40"}`}
              >
                <img
                  src={p.image}
                  alt=""
                  className={`h-14 w-12 shrink-0 rounded-xl object-cover ${p.isActive ? "" : "opacity-50 grayscale"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                    {p.name}
                    {p.isFeatured && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-gold-soft px-2 py-0.5 text-[0.65rem] font-bold text-accent-foreground">
                        <Star className="h-3 w-3" aria-hidden="true" /> Best seller
                      </span>
                    )}
                    {!p.isActive && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[0.65rem] font-bold text-slate-700">
                        Hidden
                      </span>
                    )}
                    {p.isCustom && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[0.65rem] font-bold text-sky-800">
                        Added by you
                      </span>
                    )}
                    {p.isEdited && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[0.65rem] font-bold text-violet-800">
                        Edited
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-ink-soft">
                    {p.maker} · {p.occasions.map((o) => OCCASION_LABELS[o]).join(", ")}
                  </p>
                </div>
                <span className="w-24 text-right font-display text-lg font-bold">
                  {formatPrice(p.price)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title={p.isActive ? "Hide from the shop" : "Show in the shop"}
                    disabled={save.isPending}
                    onClick={() => save.mutate({ ...toInput(p), isActive: !p.isActive })}
                    className="cursor-pointer rounded-full p-2 text-ink-soft hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    {p.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    <span className="sr-only">{p.isActive ? "Hide" : "Show"}</span>
                  </button>
                  <button
                    type="button"
                    title="Edit"
                    onClick={() => setEditing(p)}
                    className="cursor-pointer rounded-full p-2 text-ink-soft hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit {p.name}</span>
                  </button>
                  {(p.isCustom || p.isEdited) && (
                    <button
                      type="button"
                      title={p.isCustom ? "Delete" : "Reset to original"}
                      disabled={remove.isPending}
                      onClick={() => {
                        const prompt = p.isCustom
                          ? `Delete "${p.name}"? This can't be undone.`
                          : `Reset "${p.name}" to its original name, price and photo?`;
                        if (window.confirm(prompt)) remove.mutate(p.id);
                      }}
                      className="cursor-pointer rounded-full p-2 text-ink-soft hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    >
                      {p.isCustom ? (
                        <Trash2 className="h-4 w-4" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      <span className="sr-only">{p.isCustom ? "Delete" : "Reset"}</span>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ProductEditor
        target={editing}
        nextSort={nextSort}
        saving={save.isPending}
        onClose={() => setEditing(null)}
        onSave={(input) => save.mutate(input, { onSuccess: () => setEditing(null) })}
      />
    </div>
  );
}

const blankProduct = (sortOrder: number): ProductInput => ({
  name: "",
  maker: "",
  price: 1499,
  imageUrl: "",
  flowers: [],
  palette: "",
  occasions: ["just-because"],
  blurb: "",
  isActive: true,
  isFeatured: false,
  sortOrder,
});

function ProductEditor({
  target,
  nextSort,
  saving,
  onClose,
  onSave,
}: {
  target: CatalogItem | "new" | null;
  nextSort: number;
  saving: boolean;
  onClose: () => void;
  onSave: (input: ProductInput) => void;
}) {
  const [form, setForm] = useState<ProductInput>(blankProduct(nextSort));
  const [flowersText, setFlowersText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const base = target && target !== "new" ? getBaseBouquet(target.id) : undefined;

  useEffect(() => {
    if (!target) return;
    const initial = target === "new" ? blankProduct(nextSort) : toInput(target);
    setForm(initial);
    setFlowersText(initial.flowers.join(", "));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const previewImage = form.imageUrl || base?.image || "";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const input: ProductInput = {
      ...form,
      flowers: flowersText
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean),
      imageUrl: form.imageUrl ? form.imageUrl : base ? null : "",
    };
    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    if (!base && !input.imageUrl) {
      setError("Add a photo for the new bouquet (paste a link or upload one).");
      return;
    }
    setError(null);
    onSave(input);
  };

  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetTitle className="font-display text-2xl font-bold">
          {target === "new" ? "New bouquet" : `Edit ${target?.name ?? ""}`}
        </SheetTitle>
        <SheetDescription>
          {base
            ? "Changes are layered over the original bouquet — reset any time from the list."
            : "Shown everywhere bouquets appear, including the AI finder."}
        </SheetDescription>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="flex gap-4">
            {previewImage ? (
              <img
                src={previewImage}
                alt=""
                className="h-28 w-24 shrink-0 rounded-2xl object-cover"
              />
            ) : (
              <span className="grid h-28 w-24 shrink-0 place-items-center rounded-2xl bg-muted text-xs text-ink-soft">
                No photo
              </span>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <AdminField
                label="Photo"
                hint={
                  base
                    ? "Leave empty to use the original photo."
                    : "Paste an https:// link or upload."
                }
              >
                <input
                  className={adminInput}
                  placeholder="https://…"
                  value={form.imageUrl ?? ""}
                  onChange={(e) => set("imageUrl", e.target.value)}
                />
              </AdminField>
              <div className="flex gap-2">
                <ImageUploadButton onUploaded={(url) => set("imageUrl", url)} />
                {base && form.imageUrl && (
                  <button
                    type="button"
                    onClick={() => set("imageUrl", null)}
                    className="cursor-pointer text-xs font-semibold text-ink-soft hover:text-foreground"
                  >
                    Use original
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AdminField label="Name">
              <input
                className={adminInput}
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </AdminField>
            <AdminField label="Florist studio">
              <input
                className={adminInput}
                required
                value={form.maker}
                onChange={(e) => set("maker", e.target.value)}
              />
            </AdminField>
            <AdminField label="Price (₹)">
              <input
                className={adminInput}
                type="number"
                min={1}
                step={1}
                required
                value={Number.isFinite(form.price) ? form.price : ""}
                onChange={(e) => set("price", e.target.valueAsNumber)}
              />
            </AdminField>
            <AdminField label="Position" hint="Lower numbers show first.">
              <input
                className={adminInput}
                type="number"
                min={0}
                step={1}
                value={form.sortOrder}
                onChange={(e) =>
                  set("sortOrder", Math.max(0, Math.round(e.target.valueAsNumber || 0)))
                }
              />
            </AdminField>
          </div>

          <AdminField label="Flowers" hint="Separate with commas, e.g. garden rose, mimosa, fern">
            <input
              className={adminInput}
              value={flowersText}
              onChange={(e) => setFlowersText(e.target.value)}
            />
          </AdminField>
          <AdminField label="Colours">
            <input
              className={adminInput}
              placeholder="e.g. soft blush and pale pink"
              value={form.palette}
              onChange={(e) => set("palette", e.target.value)}
            />
          </AdminField>
          <AdminField label="Description">
            <textarea
              className={`${adminInput} resize-none`}
              rows={2}
              maxLength={300}
              value={form.blurb}
              onChange={(e) => set("blurb", e.target.value)}
            />
          </AdminField>

          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-foreground/80">Occasions</legend>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => {
                const on = form.occasions.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set(
                        "occasions",
                        on ? form.occasions.filter((x) => x !== o) : [...form.occasions, o],
                      )
                    }
                    className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold ${
                      on
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-ink-soft"
                    }`}
                  >
                    {OCCASION_LABELS[o]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-5">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Visible in the shop
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => set("isFeatured", e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Show in Best sellers
            </label>
          </div>

          {error && <ErrorNote message={error} />}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-cta shadow-cta flex cursor-pointer items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save bouquet
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
