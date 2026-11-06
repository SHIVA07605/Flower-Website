import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RotateCcw, Save } from "lucide-react";

import bouquetCenter from "@/assets/bouquet-center.webp";
import floralBottom from "@/assets/floral-bottom.webp";
import floralTop from "@/assets/floral-top-long.webp";
import maker1 from "@/assets/makers/maker-1.jpg";
import maker2 from "@/assets/makers/maker-2.jpg";
import maker3 from "@/assets/makers/maker-3.jpg";
import maker4 from "@/assets/makers/maker-4.jpg";
import { formatPrice } from "@/components/shop/products";
import { saveSiteContent } from "@/lib/admin.functions";
import { computeTotals, readBillingSettings } from "@/lib/billing";
import { DEFAULT_SITE_CONTENT, type ContentKey, type SiteContent } from "@/lib/site-content";
import { getStorefront } from "@/lib/store.functions";
import {
  AdminField,
  adminInput,
  ErrorNote,
  ImageUploadButton,
  LoadingRows,
  Panel,
  useAdminAction,
} from "./shared";

const CONTENT_KEY = ["admin", "content"];

function useContent() {
  return useQuery({
    queryKey: CONTENT_KEY,
    queryFn: async () => (await getStorefront()).content,
  });
}

function useSaveContent(success: string) {
  return useAdminAction(
    (updates: Partial<Record<ContentKey, string>>) => saveSiteContent({ data: updates }),
    { success, invalidate: [CONTENT_KEY, ["admin", "dashboard"]] },
  );
}

/** Local edits over the saved content, plus what changed since the last save. */
function useDraft(content: SiteContent | undefined, keys: readonly ContentKey[]) {
  const [draft, setDraft] = useState<Partial<Record<ContentKey, string>>>({});
  useEffect(() => {
    if (!content) return;
    setDraft(Object.fromEntries(keys.map((k) => [k, content[k]])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);
  const changes = useMemo(() => {
    const out: Partial<Record<ContentKey, string>> = {};
    if (!content) return out;
    for (const k of keys) {
      const value = draft[k];
      if (value !== undefined && value !== content[k]) {
        // Saving the default text is the same as clearing the edit.
        out[k] = value.trim() === DEFAULT_SITE_CONTENT[k] ? "" : value;
      }
    }
    return out;
  }, [draft, content, keys]);
  return { draft, setDraft, changes, dirty: Object.keys(changes).length > 0 };
}

/* ---------------- Copy ---------------- */

interface FieldDef {
  key: ContentKey;
  label: string;
  multiline?: boolean;
}

const COPY_GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Hero",
    fields: [
      { key: "hero_kicker", label: "Badge above the headline" },
      { key: "hero_cta", label: "Button label" },
      { key: "hero_title_1", label: "Headline, line 1" },
      { key: "hero_title_2", label: "Headline, line 2" },
      { key: "hero_subtitle", label: "Intro paragraph", multiline: true },
      { key: "hero_note_tap", label: "Handwritten note by the reels", multiline: true },
      { key: "hero_note_sameday", label: "Handwritten note by the button" },
    ],
  },
  {
    title: "Delivery promises",
    fields: [1, 2, 3, 4].flatMap((n) => [
      { key: `delivery_promise_${n}_title` as ContentKey, label: `Promise ${n} — title` },
      { key: `delivery_promise_${n}_body` as ContentKey, label: `Promise ${n} — detail` },
    ]),
  },
  {
    title: "Bouquet gallery",
    fields: [
      { key: "gallery_kicker", label: "Badge" },
      { key: "gallery_title", label: "Heading" },
      { key: "gallery_desc", label: "Paragraph", multiline: true },
    ],
  },
  {
    title: "Occasions",
    fields: [
      { key: "occasions_kicker", label: "Badge" },
      { key: "occasions_title", label: "Heading" },
      { key: "occasions_desc", label: "Paragraph", multiline: true },
    ],
  },
  {
    title: "AI bouquet finder",
    fields: [
      { key: "finder_kicker", label: "Badge" },
      { key: "finder_title", label: "Heading" },
      { key: "finder_desc", label: "Paragraph", multiline: true },
    ],
  },
  {
    title: "Best sellers",
    fields: [
      { key: "bestsellers_kicker", label: "Badge" },
      { key: "bestsellers_title", label: "Heading" },
      { key: "bestsellers_sub", label: "Side note", multiline: true },
    ],
  },
  {
    title: "Reviews",
    fields: [
      { key: "reviews_kicker", label: "Badge" },
      { key: "reviews_title", label: "Heading" },
    ],
  },
  {
    title: "Makers",
    fields: [
      { key: "makers_kicker", label: "Badge" },
      { key: "makers_title", label: "Heading" },
      { key: "makers_desc", label: "Paragraph", multiline: true },
    ],
  },
  {
    title: "Newsletter",
    fields: [
      { key: "newsletter_kicker", label: "Handwritten line" },
      { key: "newsletter_title", label: "Heading" },
      { key: "newsletter_desc", label: "Paragraph", multiline: true },
      { key: "newsletter_cta", label: "Button label" },
    ],
  },
  {
    title: "Footer",
    fields: [
      { key: "footer_tagline", label: "Tagline" },
      { key: "footer_copyright", label: "Copyright line" },
    ],
  },
];

const COPY_KEYS = COPY_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

function SaveBar({ dirty, saving, label }: { dirty: boolean; saving: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={!dirty || saving}
      className="bg-cta shadow-cta flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {saving ? "Publishing…" : dirty ? label : "All changes published"}
    </button>
  );
}

export function CopyPanel() {
  const query = useContent();
  const save = useSaveContent("Copy published to the storefront.");
  const { draft, setDraft, changes, dirty } = useDraft(query.data, COPY_KEYS);

  if (query.isPending) return <LoadingRows />;
  if (query.isError) return <ErrorNote message={query.error.message} />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (dirty) save.mutate(changes);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="sticky top-[4.25rem] z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#faf8f5]/90 px-1 py-2 backdrop-blur">
        <div>
          <h2 className="font-display text-2xl font-bold">Storefront copy</h2>
          <p className="text-sm text-ink-soft">Every heading and line of text on the shop page.</p>
        </div>
        <SaveBar dirty={dirty} saving={save.isPending} label="Publish changes" />
      </div>

      {COPY_GROUPS.map((group) => (
        <Panel key={group.title} title={group.title}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {group.fields.map((f) => {
              const value = draft[f.key] ?? "";
              const isDefault = value.trim() === DEFAULT_SITE_CONTENT[f.key];
              return (
                <div key={f.key} className={f.multiline ? "sm:col-span-2" : ""}>
                  <AdminField
                    label={f.label}
                    hint={
                      !isDefault && (
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((d) => ({ ...d, [f.key]: DEFAULT_SITE_CONTENT[f.key] }))
                          }
                          className="inline-flex cursor-pointer items-center gap-1 font-semibold text-primary hover:underline"
                        >
                          <RotateCcw className="h-3 w-3" /> Restore original
                        </button>
                      )
                    }
                  >
                    {f.multiline ? (
                      <textarea
                        className={`${adminInput} resize-y`}
                        rows={2}
                        value={value}
                        onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                      />
                    ) : (
                      <input
                        className={adminInput}
                        value={value}
                        onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                      />
                    )}
                  </AdminField>
                </div>
              );
            })}
          </div>
        </Panel>
      ))}
    </form>
  );
}

/* ---------------- Pictures ---------------- */

const PICTURES: { key: ContentKey; label: string; where: string; original: string }[] = [
  {
    key: "image_hero_floral_top",
    label: "Hero floral spray",
    where: "Top corners of the hero",
    original: floralTop,
  },
  {
    key: "image_hero_floral_bottom",
    label: "Hero floral corner",
    where: "Bottom corners of the hero",
    original: floralBottom,
  },
  {
    key: "image_bouquet_center",
    label: "Signature bouquet",
    where: "Centre of the gallery section",
    original: bouquetCenter,
  },
  {
    key: "image_maker_1",
    label: "Rosa Alvarez · Petalcraft",
    where: "Makers section",
    original: maker1,
  },
  {
    key: "image_maker_2",
    label: "Theo Marsh · Field & Stem",
    where: "Makers section",
    original: maker2,
  },
  {
    key: "image_maker_3",
    label: "Meera Iyer · Stillwater",
    where: "Makers section",
    original: maker3,
  },
  {
    key: "image_maker_4",
    label: "Ama Boateng · Wildroot",
    where: "Makers section",
    original: maker4,
  },
];

const PICTURE_KEYS = PICTURES.map((p) => p.key);

export function PicturesPanel() {
  const query = useContent();
  const save = useSaveContent("Pictures updated on the storefront.");
  const { draft, setDraft, changes, dirty } = useDraft(query.data, PICTURE_KEYS);

  if (query.isPending) return <LoadingRows />;
  if (query.isError) return <ErrorNote message={query.error.message} />;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) save.mutate(changes);
      }}
      className="space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Pictures</h2>
          <p className="text-sm text-ink-soft">
            Swap any photo on the page. Bouquet photos are changed under Bouquets & prices.
          </p>
        </div>
        <SaveBar dirty={dirty} saving={save.isPending} label="Publish pictures" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PICTURES.map((pic) => {
          const custom = (draft[pic.key] ?? "").trim();
          return (
            <Panel key={pic.key} className="!p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold">{pic.label}</h3>
                  <p className="text-[0.7rem] text-ink-soft">{pic.where}</p>
                </div>
                {custom && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-bold text-emerald-800">
                    Custom
                  </span>
                )}
              </div>
              <div className="mt-3 aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-[#faf8f5]">
                <img
                  src={custom || pic.original}
                  alt=""
                  className="h-full w-full object-contain p-2"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className={adminInput}
                  type="url"
                  placeholder="https:// link, or upload →"
                  value={draft[pic.key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [pic.key]: e.target.value }))}
                />
                <ImageUploadButton
                  onUploaded={(url) => setDraft((d) => ({ ...d, [pic.key]: url }))}
                />
              </div>
              {custom && (
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, [pic.key]: "" }))}
                  className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-ink-soft hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" /> Use the original photo
                </button>
              )}
            </Panel>
          );
        })}
      </div>
    </form>
  );
}

/* ---------------- Billing & promo ---------------- */

const BILLING_FIELDS: { key: ContentKey; label: string; hint: string; suffix?: string }[] = [
  {
    key: "billing_standard_delivery",
    label: "Standard delivery fee (₹)",
    hint: "Charged below the free-delivery minimum.",
  },
  {
    key: "billing_free_shipping_threshold",
    label: "Free delivery minimum (₹)",
    hint: "Bag total (after discount) for free standard delivery.",
  },
  {
    key: "billing_express_delivery",
    label: "Express surcharge (₹)",
    hint: "Added for 3-hour express delivery.",
  },
  {
    key: "billing_tax_rate",
    label: "GST added at checkout (%)",
    hint: "Set to 0 if your prices already include GST.",
  },
  {
    key: "promo_code",
    label: "Welcome promo code",
    hint: "Shown after newsletter sign-up; valid on a first order.",
  },
  { key: "promo_percent", label: "Promo discount (%)", hint: "Set to 0 to switch the offer off." },
];

const BILLING_FIELD_KEYS = BILLING_FIELDS.map((f) => f.key);

export function BillingPanel() {
  const query = useContent();
  const save = useSaveContent("Billing rules saved — checkout uses them right away.");
  const { draft, setDraft, changes, dirty } = useDraft(query.data, BILLING_FIELD_KEYS);

  if (query.isPending) return <LoadingRows />;
  if (query.isError) return <ErrorNote message={query.error.message} />;

  const preview = readBillingSettings({ ...query.data, ...draft } as SiteContent);
  const example = (subtotal: number) =>
    computeTotals([{ price: subtotal, qty: 1 }], preview, {
      slot: "standard",
      promoApplied: false,
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) save.mutate(changes);
      }}
      className="space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Billing & promo</h2>
          <p className="text-sm text-ink-soft">
            The checkout and the server use exactly these rules to price every order.
          </p>
        </div>
        <SaveBar dirty={dirty} saving={save.isPending} label="Save rules" />
      </div>

      <Panel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {BILLING_FIELDS.map((f) => (
            <AdminField key={f.key} label={f.label} hint={f.hint}>
              <input
                className={`${adminInput} ${f.key === "promo_code" ? "uppercase" : ""}`}
                inputMode={f.key === "promo_code" ? "text" : "decimal"}
                value={draft[f.key] ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    [f.key]: f.key === "promo_code" ? e.target.value.toUpperCase() : e.target.value,
                  }))
                }
              />
            </AdminField>
          ))}
        </div>
      </Panel>

      <Panel title="What shoppers will pay" description="Live preview with the values above.">
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {[1299, 2499].map((subtotal) => {
            const t = example(subtotal);
            return (
              <div key={subtotal} className="rounded-2xl bg-[#faf8f5] p-4">
                <p className="font-semibold">A {formatPrice(subtotal)} bouquet</p>
                <p className="mt-1 text-ink-soft">
                  Delivery {t.deliveryFee === 0 ? "free" : formatPrice(t.deliveryFee)}
                  {t.tax > 0 ? ` · GST ${formatPrice(t.tax)}` : ""}
                </p>
                <p className="mt-1 font-display text-xl font-bold">{formatPrice(t.total)}</p>
              </div>
            );
          })}
        </div>
      </Panel>
    </form>
  );
}
