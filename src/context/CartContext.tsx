import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { itemKey } from "../lib/cart";
import { useCatalog } from "./CatalogContext";
import type { CartItem } from "../types";
import { canPurchase } from "../lib/artwork";

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (productId: string, variantId?: string, quantity?: number) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (
    productId: string,
    variantId: string | undefined,
    quantity: number,
  ) => void;
  clearCart: () => void;
};

const STORAGE_KEY = "reesebradyart-cart-v1";
const CartContext = createContext<CartContextValue | null>(null);

const readCart = (): CartItem[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function CartProvider({ children }: { children: ReactNode }) {
  const { products } = useCatalog();
  const [items, setItems] = useState<CartItem[]>(readCart);
  const clearCart = useCallback(
    () => setItems((current) => (current.length ? [] : current)),
    [],
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: items.reduce((sum, item) => {
        const product = products.find((entry) => entry.id === item.productId);
        const price = item.variantId
          ? product?.variants?.find((variant) => variant.id === item.variantId)
              ?.priceInCents
          : product?.priceInCents;
        return sum + (price ?? 0) * item.quantity;
      }, 0),
      addItem(productId, variantId, quantity = 1) {
        const product = products.find((entry) => entry.id === productId);
        if (
          !product ||
          !canPurchase(product) ||
          (product.variants?.length && !variantId)
        )
          return;
        setItems((current) => {
          const incoming = { productId, variantId, quantity };
          const key = itemKey(incoming);
          const existing = current.find((item) => itemKey(item) === key);
          const nextQuantity =
            product.type === "original"
              ? 1
              : Math.max(
                  1,
                  Math.min(
                    99,
                    Math.floor((existing?.quantity ?? 0) + quantity),
                  ),
                );
          if (!nextQuantity) return current;
          if (existing)
            return current.map((item) =>
              itemKey(item) === key
                ? { ...item, quantity: nextQuantity }
                : item,
            );
          return [...current, { ...incoming, quantity: nextQuantity }];
        });
      },
      removeItem(productId, variantId) {
        setItems((current) =>
          current.filter(
            (item) => itemKey(item) !== itemKey({ productId, variantId }),
          ),
        );
      },
      updateQuantity(productId, variantId, quantity) {
        const product = products.find((entry) => entry.id === productId);
        const normalized =
          !product || !canPurchase(product)
            ? 0
            : product.type === "original"
              ? 1
              : Math.max(1, Math.min(99, Math.floor(quantity)));
        if (!normalized) return;
        setItems((current) =>
          current.map((item) =>
            itemKey(item) === itemKey({ productId, variantId })
              ? { ...item, quantity: normalized }
              : item,
          ),
        );
      },
      clearCart,
    }),
    [items, clearCart, products],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// This hook intentionally lives beside its provider so they share one private context.
// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
