import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Minus,
  PenLine,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
} from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { placeOrder } from "@/lib/account.functions";
import {
  amountToFreeDelivery,
  computeTotals,
  promoMatches,
  type DeliverySlot,
} from "@/lib/billing";
import {
  checkoutSchema,
  DELIVERY_SLOT_LABEL,
  deliveryWindow,
  formatDeliveryDate,
  type CheckoutInput,
} from "@/lib/orders";
import { useCart } from "./cart";
import { formatPrice } from "./products";
import { useStorefront } from "./storefront";

type Step = "bag" | "details" | "done";

interface FormState {
  name: string;
  email: string;
  phone: string;
  forMyself: boolean;
  recipientName: string;
  recipientPhone: string;
  address: string;
  city: string;
  pincode: string;
  date: string;
  slot: DeliverySlot;
  cardMessage: string;
  promo: string;
  website: string;
}

const blankForm = (date: string): FormState => ({
  name: "",
  email: "",
  phone: "",
  forMyself: false,
  recipientName: "",
  recipientPhone: "",
  address: "",
  city: "",
  pincode: "",
  date,
  slot: "standard",
  cardMessage: "",
  promo: "",
  website: "",
});

const fieldClass =
  "w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10";

function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
}) {
  // Errors and hints sit outside the <label> so they aren't read as part of the field's name.
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-foreground/80">{label}</span>
        {children}
      </label>
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function CartDrawer() {
  const cart = useCart();
  const { billing, dbReady } = useStorefront();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("bag");
  const [dates, setDates] = useState(() => deliveryWindow());
  const [form, setForm] = useState<FormState>(() => blankForm(dates.earliest));
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<{
    orderNumber: string;
    total: number;
    email: string;
  } | null>(null);

  // Re-check the 2pm same-day cut-off whenever the bag is opened.
  useEffect(() => {
    if (cart.isOpen) setDates(deliveryWindow());
  }, [cart.isOpen]);

  // Start over at the bag the next time the drawer opens after an order.
  useEffect(() => {
    if (!cart.isOpen && step === "done") {
      setStep("bag");
      setPlaced(null);
    }
  }, [cart.isOpen, step]);

  // Keep the chosen date valid (e.g. the 2pm same-day cut-off passed while browsing).
  useEffect(() => {
    setForm((f) =>
      f.date < dates.earliest || f.date > dates.latest ? { ...f, date: dates.earliest } : f,
    );
  }, [dates]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const totals = computeTotals(
    cart.lines.map((l) => ({ price: l.item.price, qty: l.qty })),
    billing,
    { slot: form.slot, promoApplied: appliedPromo !== null },
  );
  const toFree = amountToFreeDelivery(totals.subtotal - totals.discount, billing);

  const goToDetails = () => {
    if (user) {
      setForm((f) => ({
        ...f,
        name: f.name || user.name,
        email: f.email || (user.email ?? ""),
      }));
    }
    setStep("details");
  };

  const applyPromo = () => {
    const code = form.promo.trim().toUpperCase();
    if (!code) return;
    if (promoMatches(code, billing)) {
      setAppliedPromo(code);
      setPromoError(null);
    } else {
      setAppliedPromo(null);
      setPromoError("That code isn't valid.");
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const payload: CheckoutInput = {
      items: cart.lines.map((l) => ({ id: l.item.id, qty: l.qty })),
      customer: { name: form.name, email: form.email, phone: form.phone },
      recipient: {
        name: form.forMyself ? form.name : form.recipientName,
        phone: form.forMyself ? form.phone : form.recipientPhone,
        address: form.address,
        city: form.city,
        pincode: form.pincode,
      },
      delivery: { date: form.date, slot: form.slot, cardMessage: form.cardMessage },
      ...(appliedPromo ? { promoCode: appliedPromo } : {}),
      ...(form.website ? { website: form.website } : {}),
    };

    const parsed = checkoutSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        next[key] ??= issue.message;
      }
      setErrors(next);
      setSubmitError("Please check the highlighted fields.");
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await placeOrder({ data: payload });
      if (!result.ok) {
        setSubmitError(result.error);
        if (/promo|code/i.test(result.error)) setAppliedPromo(null);
        return;
      }
      setPlaced(result.data);
      cart.clear();
      setAppliedPromo(null);
      setForm((f) => ({
        ...blankForm(dates.earliest),
        name: f.name,
        email: f.email,
        phone: f.phone,
      }));
      setStep("done");
    } catch {
      setSubmitError("We couldn't reach the shop. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const err = (key: string) => errors[key];

  return (
    <Sheet open={cart.isOpen} onOpenChange={cart.setOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 bg-background p-0 sm:max-w-md"
      >
        <div className="flex items-center gap-3 border-b border-border/70 px-5 py-4 pr-12">
          {step === "details" && (
            <button
              type="button"
              onClick={() => setStep("bag")}
              aria-label="Back to bag"
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-ink-soft hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <SheetTitle className="font-display text-xl font-bold tracking-tight">
              {step === "bag" ? "Your bag" : step === "details" ? "Checkout" : "Order placed"}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {step === "bag"
                ? `${cart.count} ${cart.count === 1 ? "bouquet" : "bouquets"}`
                : step === "details"
                  ? "Delivery details · pay on delivery"
                  : "Thank you for shopping with an indie florist"}
            </SheetDescription>
          </div>
        </div>

        {step === "done" && placed ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-secondary text-primary">
              <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
            </span>
            <p className="mt-5 font-display text-2xl font-bold tracking-tight">
              {placed.orderNumber}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your florist has the order. Pay {formatPrice(placed.total)} by cash or UPI when it
              arrives. Follow every step — confirmed, hand-tied, out for delivery — from your orders
              page.
            </p>
            <Link
              to="/account"
              search={user ? {} : { order: placed.orderNumber, email: placed.email }}
              onClick={() => cart.setOpen(false)}
              className="bg-cta shadow-cta mt-6 rounded-full px-6 py-3 text-sm font-bold text-primary-foreground"
            >
              Track my order
            </Link>
            <button
              type="button"
              onClick={() => cart.setOpen(false)}
              className="mt-3 cursor-pointer text-sm font-semibold text-ink-soft hover:text-foreground"
            >
              Continue shopping
            </button>
          </div>
        ) : cart.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-muted text-ink-soft">
              <ShoppingBag className="h-7 w-7" aria-hidden="true" />
            </span>
            <p className="mt-5 font-display text-xl font-bold">Your bag is empty</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Find something lovely in today's best sellers.
            </p>
            <a
              href="#best-sellers"
              onClick={() => cart.setOpen(false)}
              className="bg-cta shadow-cta mt-6 rounded-full px-6 py-3 text-sm font-bold text-primary-foreground"
            >
              Browse bouquets
            </a>
          </div>
        ) : step === "bag" ? (
          <>
            <ul className="flex-1 divide-y divide-border/60 overflow-y-auto px-5">
              {cart.lines.map(({ item, qty }) => (
                <li key={item.id} className="flex gap-3.5 py-4">
                  <img
                    src={item.image}
                    alt=""
                    className="h-20 w-16 shrink-0 rounded-xl object-cover"
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.maker}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => cart.remove(item.id)}
                        aria-label={`Remove ${item.name}`}
                        className="cursor-pointer rounded-full p-1.5 text-ink-soft hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center rounded-full border border-border">
                        <button
                          type="button"
                          onClick={() => cart.setQty(item.id, qty - 1)}
                          aria-label="Decrease quantity"
                          className="grid h-8 w-8 cursor-pointer place-items-center text-ink-soft hover:text-foreground"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-bold">{qty}</span>
                        <button
                          type="button"
                          onClick={() => cart.setQty(item.id, qty + 1)}
                          aria-label="Increase quantity"
                          className="grid h-8 w-8 cursor-pointer place-items-center text-ink-soft hover:text-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="font-bold text-foreground">
                        {formatPrice(item.price * qty)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-border/70 bg-card px-5 py-4">
              <div className="flex items-center gap-2 text-xs text-ink-soft">
                <Truck className="h-4 w-4 text-primary" aria-hidden="true" />
                {toFree > 0
                  ? `Add ${formatPrice(toFree)} more for free delivery`
                  : "You've unlocked free standard delivery"}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{
                    width: `${Math.min(100, ((totals.subtotal - totals.discount) / Math.max(1, billing.freeDeliveryThreshold)) * 100)}%`,
                  }}
                />
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-display text-2xl font-extrabold tracking-tight">
                  {formatPrice(totals.subtotal)}
                </span>
              </div>
              <button
                type="button"
                onClick={goToDetails}
                className="bg-cta shadow-cta mt-4 w-full cursor-pointer rounded-full py-3.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"
              >
                Checkout
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              {!dbReady && (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                  Online ordering opens as soon as the shop finishes setting up. You can still fill
                  in your details.
                </p>
              )}

              <fieldset className="space-y-3">
                <legend className="text-sm font-bold text-foreground">Your details</legend>
                <Field label="Full name" error={err("customer.name")}>
                  <input
                    className={fieldClass}
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Email" error={err("customer.email")}>
                    <input
                      className={fieldClass}
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                    />
                  </Field>
                  <Field label="Mobile" error={err("customer.phone")}>
                    <input
                      className={fieldClass}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="98765 43210"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                    />
                  </Field>
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-bold text-foreground">Deliver to</legend>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                  <input
                    type="checkbox"
                    checked={form.forMyself}
                    onChange={(e) => update("forMyself", e.target.checked)}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  These flowers are for me
                </label>
                {!form.forMyself && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Recipient's name" error={err("recipient.name")}>
                      <input
                        className={fieldClass}
                        value={form.recipientName}
                        onChange={(e) => update("recipientName", e.target.value)}
                      />
                    </Field>
                    <Field label="Recipient's mobile" error={err("recipient.phone")}>
                      <input
                        className={fieldClass}
                        type="tel"
                        inputMode="tel"
                        value={form.recipientPhone}
                        onChange={(e) => update("recipientPhone", e.target.value)}
                      />
                    </Field>
                  </div>
                )}
                <Field label="Address" error={err("recipient.address")}>
                  <textarea
                    className={`${fieldClass} resize-none`}
                    rows={2}
                    autoComplete="street-address"
                    placeholder="Flat / house no., street, landmark"
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City" error={err("recipient.city")}>
                    <input
                      className={fieldClass}
                      autoComplete="address-level2"
                      value={form.city}
                      onChange={(e) => update("city", e.target.value)}
                    />
                  </Field>
                  <Field label="Pincode" error={err("recipient.pincode")}>
                    <input
                      className={fieldClass}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={6}
                      value={form.pincode}
                      onChange={(e) => update("pincode", e.target.value.replace(/\D/g, ""))}
                    />
                  </Field>
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-bold text-foreground">Delivery</legend>
                <Field
                  label="Date"
                  error={err("delivery.date")}
                  hint={
                    dates.sameDayOpen
                      ? "Order by 2pm for delivery today."
                      : "Same-day orders closed at 2pm — earliest is tomorrow."
                  }
                >
                  <input
                    className={fieldClass}
                    type="date"
                    min={dates.earliest}
                    max={dates.latest}
                    value={form.date}
                    onChange={(e) => update("date", e.target.value)}
                  />
                </Field>
                <div className="grid gap-2" role="radiogroup" aria-label="Delivery speed">
                  {(["standard", "express"] as const).map((slot) => {
                    const fee =
                      slot === "express"
                        ? `+${formatPrice(billing.expressSurcharge)}`
                        : toFree > 0
                          ? formatPrice(billing.standardDelivery)
                          : "Free";
                    return (
                      <label
                        key={slot}
                        className={`flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                          form.slot === slot
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="slot"
                            checked={form.slot === slot}
                            onChange={() => update("slot", slot)}
                            className="accent-[var(--primary)]"
                          />
                          {DELIVERY_SLOT_LABEL[slot]}
                        </span>
                        <span className="font-semibold">{fee}</span>
                      </label>
                    );
                  })}
                </div>
                <Field
                  label="Handwritten card message (free)"
                  error={err("delivery.cardMessage")}
                  hint={`${form.cardMessage.length}/240`}
                >
                  <textarea
                    className={`${fieldClass} resize-none font-hand text-lg leading-6`}
                    rows={3}
                    maxLength={240}
                    placeholder="Happy birthday! Wish I could be there…"
                    value={form.cardMessage}
                    onChange={(e) => update("cardMessage", e.target.value)}
                  />
                </Field>
              </fieldset>

              {/* Honeypot: hidden from people, tempting to bots. */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
                value={form.website}
                onChange={(e) => update("website", e.target.value)}
              />

              {billing.promoCode !== "" && billing.promoPercent > 0 && (
                <div>
                  <span className="mb-1 block text-xs font-semibold text-foreground/80">
                    Promo code
                  </span>
                  {appliedPromo ? (
                    <p className="flex items-center justify-between rounded-xl bg-secondary px-3.5 py-2.5 text-sm text-secondary-foreground">
                      <span className="flex items-center gap-2 font-semibold">
                        <Tag className="h-4 w-4" aria-hidden="true" />
                        {appliedPromo} · {billing.promoPercent}% off
                      </span>
                      <button
                        type="button"
                        onClick={() => setAppliedPromo(null)}
                        className="cursor-pointer text-xs font-semibold underline"
                      >
                        Remove
                      </button>
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        className={`${fieldClass} uppercase`}
                        placeholder="e.g. from the newsletter"
                        value={form.promo}
                        onChange={(e) => update("promo", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            applyPromo();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={applyPromo}
                        className="cursor-pointer rounded-xl border border-border px-4 text-sm font-semibold hover:border-primary hover:text-primary"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                  {promoError && (
                    <span role="alert" className="mt-1 block text-xs font-medium text-destructive">
                      {promoError}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-border/70 bg-card px-5 py-4">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <dt>Subtotal</dt>
                  <dd>{formatPrice(totals.subtotal)}</dd>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-primary">
                    <dt>Discount</dt>
                    <dd>−{formatPrice(totals.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <dt>Delivery · {formatDeliveryDate(form.date || dates.earliest)}</dt>
                  <dd>{totals.deliveryFee === 0 ? "Free" : formatPrice(totals.deliveryFee)}</dd>
                </div>
                {totals.tax > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <dt>GST ({billing.taxRate}%)</dt>
                    <dd>{formatPrice(totals.tax)}</dd>
                  </div>
                )}
                <div className="flex justify-between pt-1 text-base font-bold text-foreground">
                  <dt>Total · pay on delivery</dt>
                  <dd>{formatPrice(totals.total)}</dd>
                </div>
              </dl>
              {submitError && (
                <p
                  role="alert"
                  className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
                >
                  {submitError}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || !dbReady}
                className="bg-cta shadow-cta mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <PenLine className="h-4 w-4" aria-hidden="true" />
                )}
                {submitting ? "Placing your order…" : `Place order · ${formatPrice(totals.total)}`}
              </button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
