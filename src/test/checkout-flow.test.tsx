import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CartDrawer } from "@/components/shop/CartDrawer";
import { CartProvider, useCart } from "@/components/shop/cart";
import { StorefrontProvider } from "@/components/shop/storefront";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content";
import type { StorefrontPayload } from "@/lib/storefront-data";

const placeOrder = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
  Link: ({ children, to, search: _search, ...rest }: Record<string, unknown>) => (
    <a href={String(to)} {...(rest as object)}>
      {children as React.ReactNode}
    </a>
  ),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, openAuth: vi.fn() }),
}));

vi.mock("@/lib/account.functions", () => ({
  placeOrder: (args: unknown) => placeOrder(args),
}));

const payload: StorefrontPayload = {
  content: { ...DEFAULT_SITE_CONTENT },
  productRows: [],
  reviews: [],
  dbReady: true,
};

function AddButton() {
  const { add, openCart } = useCart();
  return (
    <>
      <button onClick={() => add("blush-peony", 2)}>add peonies</button>
      <button onClick={openCart}>open bag</button>
    </>
  );
}

function renderShop() {
  return render(
    <StorefrontProvider data={payload}>
      <CartProvider>
        <AddButton />
        <CartDrawer />
      </CartProvider>
    </StorefrontProvider>,
  );
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("checkout flow", () => {
  beforeEach(() => {
    localStorage.clear();
    placeOrder.mockReset();
  });

  it("adds to the bag, prices it and places an order with the right details", async () => {
    placeOrder.mockResolvedValue({
      ok: true,
      data: { orderNumber: "RM-10001", total: 5897.64, email: "priya@example.com" },
    });
    renderShop();

    fireEvent.click(screen.getByText("add peonies"));
    fireEvent.click(screen.getByText("open bag"));

    const bag = await screen.findByRole("dialog");
    expect(within(bag).getByText("Blush Peony Cloud")).toBeInTheDocument();
    // 2 × ₹2,499 = ₹4,998, above the ₹999 free-delivery minimum.
    expect(within(bag).getAllByText("₹4,998").length).toBeGreaterThan(0);
    expect(within(bag).getByText("You've unlocked free standard delivery")).toBeInTheDocument();

    fireEvent.click(within(bag).getByText("Checkout"));

    // Submitting empty shows field errors instead of calling the server.
    fireEvent.click(await screen.findByRole("button", { name: /Place order/ }));
    expect(await screen.findByText("Please enter your name")).toBeInTheDocument();
    expect(placeOrder).not.toHaveBeenCalled();

    type("Full name", "Priya Sharma");
    type("Email", "Priya@Example.com");
    type("Mobile", "98765 43210");
    type("Recipient's name", "Anita Rao");
    type("Recipient's mobile", "9123456780");
    type("Address", "12 MG Road, Indiranagar");
    type("City", "Bengaluru");
    type("Pincode", "560038");
    type("Handwritten card message (free)", "Happy birthday!");

    // GST 18% on ₹4,998 = ₹899.64 → total ₹5,897.64
    expect(screen.getByRole("button", { name: /Place order · ₹5,897\.64/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Place order/ }));

    await waitFor(() => expect(placeOrder).toHaveBeenCalledTimes(1));
    const sent = placeOrder.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(sent.data).toMatchObject({
      items: [{ id: "blush-peony", qty: 2 }],
      customer: { name: "Priya Sharma", email: "Priya@Example.com" },
      recipient: { name: "Anita Rao", city: "Bengaluru", pincode: "560038" },
      delivery: { slot: "standard", cardMessage: "Happy birthday!" },
    });
    // Prices are never sent — the server works them out from the catalog.
    expect(JSON.stringify(sent.data)).not.toContain("2499");

    expect(await screen.findByText("RM-10001")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("reelmark_cart_v1") ?? "[]")).toEqual([]);
  });

  it("shows the server's reason when an order is refused", async () => {
    placeOrder.mockResolvedValue({ ok: false, error: "Same-day orders close at 2pm." });
    renderShop();
    fireEvent.click(screen.getByText("add peonies"));
    fireEvent.click(screen.getByText("open bag"));
    fireEvent.click(within(await screen.findByRole("dialog")).getByText("Checkout"));

    const forMe = screen.getByLabelText("These flowers are for me");
    fireEvent.click(forMe);
    type("Full name", "Priya Sharma");
    type("Email", "priya@example.com");
    type("Mobile", "9876543210");
    type("Address", "12 MG Road, Indiranagar");
    type("City", "Bengaluru");
    type("Pincode", "560038");
    fireEvent.click(screen.getByRole("button", { name: /Place order/ }));

    expect(await screen.findByText("Same-day orders close at 2pm.")).toBeInTheDocument();
    const sent = placeOrder.mock.calls[0]?.[0] as { data: { recipient: { name: string } } };
    expect(sent.data.recipient.name).toBe("Priya Sharma");
  });

  it("keeps the bag between visits", async () => {
    const first = renderShop();
    fireEvent.click(screen.getByText("add peonies"));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("reelmark_cart_v1") ?? "[]")).toEqual([
        { id: "blush-peony", qty: 2 },
      ]),
    );
    first.unmount();

    renderShop();
    fireEvent.click(screen.getByText("open bag"));
    expect(await screen.findByText("Blush Peony Cloud")).toBeInTheDocument();
  });
});
