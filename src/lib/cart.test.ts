import { describe, expect, it } from "vitest";
import { cartSubtotal, normalizeQuantity } from "./cart";
describe("cart rules", () => {
  it("calculates selected variant totals", () =>
    expect(
      cartSubtotal([
        { productId: "print-wild-flowers", variantId: "16x20", quantity: 2 },
      ]),
    ).toBe(17000));
  it("limits original paintings to one", () =>
    expect(normalizeQuantity("original-golden-hour", 4)).toBe(1));
  it("rejects unknown products", () =>
    expect(normalizeQuantity("not-real", 1)).toBe(0));
});
