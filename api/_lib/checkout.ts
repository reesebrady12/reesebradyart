export type CartRequestItem = {
  productId: string;
  variantId?: string;
  quantity: number;
};
export function validateCheckout(body: { items?: unknown }): CartRequestItem[] {
  if (!Array.isArray(body.items) || body.items.length === 0)
    throw new Error("Your cart is empty.");
  if (body.items.length > 50) throw new Error("Your cart has too many items.");
  return body.items.map((raw) => {
    if (!raw || typeof raw !== "object")
      throw new Error("An item in your cart is invalid.");
    const { productId, variantId, quantity } = raw as Record<string, unknown>;
    if (
      typeof productId !== "string" ||
      (variantId !== undefined && typeof variantId !== "string") ||
      !Number.isInteger(quantity) ||
      Number(quantity) < 1 ||
      Number(quantity) > 99
    )
      throw new Error("An item in your cart is invalid.");
    return {
      productId,
      variantId: variantId as string | undefined,
      quantity: Number(quantity),
    };
  });
}
