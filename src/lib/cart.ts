import { getProduct } from "../data/products";
import type { CartItem } from "../types";

export const itemKey = (item: Pick<CartItem, "productId" | "variantId">) =>
  `${item.productId}:${item.variantId ?? "default"}`;

export const itemUnitPrice = (item: CartItem) => {
  const product = getProduct(item.productId);
  if (!product) return 0;
  if (!item.variantId) return product.priceInCents;
  return (
    product.variants?.find((variant) => variant.id === item.variantId)
      ?.priceInCents ?? 0
  );
};

export const cartSubtotal = (items: CartItem[]) =>
  items.reduce((total, item) => total + itemUnitPrice(item) * item.quantity, 0);

export const normalizeQuantity = (productId: string, quantity: number) => {
  const product = getProduct(productId);
  if (!product || product.sold) return 0;
  if (product.type === "original") return 1;
  return Math.max(1, Math.min(99, Math.floor(quantity)));
};
