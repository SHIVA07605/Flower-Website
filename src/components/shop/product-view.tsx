import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface ProductViewValue {
  productId: string | null;
  show: (id: string) => void;
  close: () => void;
}

const ProductViewContext = createContext<ProductViewValue | null>(null);

/** Which bouquet's quick view is open — any section can open it. */
export function ProductViewProvider({ children }: { children: ReactNode }) {
  const [productId, setProductId] = useState<string | null>(null);
  const show = useCallback((id: string) => setProductId(id), []);
  const close = useCallback(() => setProductId(null), []);
  const value = useMemo(() => ({ productId, show, close }), [productId, show, close]);
  return <ProductViewContext.Provider value={value}>{children}</ProductViewContext.Provider>;
}

export function useProductView() {
  const ctx = useContext(ProductViewContext);
  if (!ctx) throw new Error("useProductView must be used inside ProductViewProvider");
  return ctx;
}
