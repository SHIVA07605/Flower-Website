import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import type { CatalogItem } from "@/lib/catalog";
import { useStorefront } from "./storefront";

interface StoredLine {
  id: string;
  qty: number;
}

export interface CartLine {
  item: CatalogItem;
  qty: number;
}

interface CartContextValue {
  /** Lines for bouquets that are still available, in the order they were added. */
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (id: string, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  openCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "reelmark_cart_v1";
const MAX_QTY = 20;

function readStoredCart(): StoredLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((l): StoredLine[] => {
      const line = l as Partial<StoredLine>;
      return typeof line.id === "string" && typeof line.qty === "number" && line.qty > 0
        ? [{ id: line.id, qty: Math.min(MAX_QTY, Math.floor(line.qty)) }]
        : [];
    });
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { findProduct } = useStorefront();
  const [stored, setStored] = useState<StoredLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setOpen] = useState(false);

  // The bag lives in this browser only. Read it after hydration so SSR markup matches.
  useEffect(() => {
    setStored(readStoredCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Private mode or full storage: the bag still works for this visit.
    }
  }, [stored, hydrated]);

  const openCart = useCallback(() => setOpen(true), []);

  const add = useCallback(
    (id: string, qty = 1) => {
      const item = findProduct(id);
      if (!item) {
        toast.error("Sorry, that bouquet isn't available right now.");
        return;
      }
      setStored((prev) => {
        const existing = prev.find((l) => l.id === id);
        if (existing) {
          return prev.map((l) => (l.id === id ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l));
        }
        return [...prev, { id, qty: Math.min(MAX_QTY, qty) }];
      });
      toast.success(`${item.name} added to your bag`, {
        action: { label: "View bag", onClick: () => setOpen(true) },
      });
    },
    [findProduct],
  );

  const setQty = useCallback((id: string, qty: number) => {
    setStored((prev) =>
      qty <= 0
        ? prev.filter((l) => l.id !== id)
        : prev.map((l) => (l.id === id ? { ...l, qty: Math.min(MAX_QTY, qty) } : l)),
    );
  }, []);

  const remove = useCallback((id: string) => {
    setStored((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const clear = useCallback(() => setStored([]), []);

  const value = useMemo<CartContextValue>(() => {
    const lines = stored.flatMap((l): CartLine[] => {
      const item = findProduct(l.id);
      return item ? [{ item, qty: l.qty }] : [];
    });
    return {
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotal: lines.reduce((sum, l) => sum + l.item.price * l.qty, 0),
      add,
      setQty,
      remove,
      clear,
      isOpen,
      setOpen,
      openCart,
    };
  }, [stored, findProduct, add, setQty, remove, clear, isOpen, openCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
